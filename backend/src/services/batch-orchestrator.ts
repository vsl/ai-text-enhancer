/**
 * Batch Orchestrator Service
 * 
 * Processes multiple assistant tasks in parallel within a single API request.
 * Each assistant makes an independent LLM call with its own model, role, and options.
 * 
 * Platform-agnostic - uses only standard TypeScript/JavaScript APIs.
 */

import type { UserProfile } from '../types/auth.types.ts';
import type {
  BatchRequest,
  BatchResponse,
  AssistantConfiguration,
  BatchResult,
  BatchSelection,
  SuccessResult,
  ErrorResult
} from '../types/api.types.ts';
import type { AssistantProcessingResult } from '../types/orchestration.types.ts';
import { PromptBuilder } from './prompt-builder.ts';
import { LLMConnectorFactory } from '../connectors/llm-connectors/factory.ts';
import type { LLMConnector } from '../types/llm.types.ts';
import { QuotaService } from './quota-service.ts';
import { AuthorizationService } from './authorization-service.ts';
import { getModelById } from '../config/models.config.ts';
import { getRoleById } from '../config/roles.config.ts';
import { getLimitsForTier } from '../config/tier-limits.config.ts';
import type { LLMProviderConfig } from '../types/config.types.ts';
import { LLMError, LLMTimeoutError } from '../errors/llm-errors.ts';
import { parseTextOutput } from '../config/output-contract.config.ts';
import { validateBatchRequest } from './request-validator.ts';
import { addTraceMetadata, traceRun } from '../observability/tracing.ts';
import type { ResultSelector } from './jev-result-selector.ts';

export class BatchOrchestrator {
  private promptBuilder: PromptBuilder;
  private connectors: Map<string, LLMConnector>;
  private quotaService: QuotaService;
  private authzService: AuthorizationService;
  private readonly taskTimeoutMs: number;
  private readonly exposeErrorDetails: boolean;
  private readonly resultSelector?: ResultSelector;

  constructor(
    providers: LLMProviderConfig[],
    quotaService: QuotaService,
    authzService: AuthorizationService,
    taskTimeoutMs: number = 30000,
    exposeErrorDetails: boolean = false,
    resultSelector?: ResultSelector,
  ) {
    this.promptBuilder = new PromptBuilder();
    this.connectors = LLMConnectorFactory.createAll(providers);
    this.quotaService = quotaService;
    this.authzService = authzService;
    this.taskTimeoutMs = taskTimeoutMs;
    this.exposeErrorDetails = exposeErrorDetails;
    this.resultSelector = resultSelector;
  }

  /**
   * Process batch of assistant tasks
   * Each assistant = independent LLM call processed in parallel
   * 
   * Partial success pattern: If batch size exceeds tier limit,
   * first N assistants (within limit) are processed normally,
   * excess assistants get TIER_BATCH_SIZE_EXCEEDED error.
   */
  async processBatch(
    user: UserProfile,
    input: unknown,
    requestId: string = crypto.randomUUID(),
  ): Promise<BatchResponse> {
    // 1. Validate the untrusted API payload (batch size remains a partial-success limit)
    const request: BatchRequest = validateBatchRequest(input, user);

    // 2. Split assistants into processable and exceeded based on tier limit
    const tierLimits = getLimitsForTier(user.tier);
    const { processable, exceeded } = this.splitByTierLimit(
      request.assistants,
      tierLimits.maxBatchSize
    );

    // 3. Create error results for exceeded assistants
    const exceededResults: AssistantProcessingResult[] = exceeded.map(assistant => ({
      id: assistant.id,
      success: false,
      error: {
        code: 'TIER_BATCH_SIZE_EXCEEDED',
        message: `Batch position exceeds ${user.tier} tier limit of ${tierLimits.maxBatchSize} assistants`
      }
    }));

    // 4. If no processable assistants, return early with all errors
    if (processable.length === 0) {
      const results: BatchResult[] = exceededResults.map(r => this.toApiResult(r));
      return { results, selection: { status: 'skipped', reason: 'NOT_ENOUGH_VALID_RESULTS' } };
    }

    // 5. Estimate total token usage (rough estimate for pre-flight check)
    const estimatedTokens = this.estimateTotalTokens(processable);

    // 6. Check user quota (pre-flight) - throws on failure
    this.quotaService.requireQuota(user, estimatedTokens);

    // 7. Validate model access for processable assistants - throws on failure
    this.validateAllModelAccess(user, processable);

    // 8. Process processable assistants in parallel
    const processingResults = await this.processAllAssistants(processable, user, requestId);

    // 9. Calculate actual token usage from successful tasks
    const totalTokensUsed = processingResults
      .filter(r => r.success && r.tokensUsed)
      .reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    // 10. Report token usage (post-flight)
    if (totalTokensUsed > 0) {
      try {
        await this.quotaService.reportUsage(
          user.userId,
          totalTokensUsed,
          'batch', // aggregated model identifier
          requestId,
        );
      } catch (error) {
        // Log but don't fail - user already got results
        //todo: need to implement
        //console.error('[ORCHESTRATOR] Failed to report token usage:', error);
      }
    }

    // 11. Combine processed and exceeded results, convert to API format
    const allResults: AssistantProcessingResult[] = [
      ...processingResults,
      ...exceededResults
    ];
    
    const results: BatchResult[] = allResults.map(r => this.toApiResult(r));
    const validResults = results.filter((result): result is SuccessResult =>
      result.status === 'success' && result.enhancedText.trim().length > 0
    );
    const selection = await this.selectResult(request, validResults, requestId);

    return { results, selection };
  }

  private async selectResult(
    request: BatchRequest,
    validResults: SuccessResult[],
    requestId: string,
  ): Promise<BatchSelection> {
    if (validResults.length === 0) {
      return { status: 'skipped', reason: 'NOT_ENOUGH_VALID_RESULTS' };
    }
    if (!this.resultSelector) {
      return { status: 'unavailable', reason: 'JUDGE_FAILED' };
    }

    try {
      return await this.resultSelector.select(request, validResults, requestId);
    } catch (error) {
      console.error(`[ORCHESTRATOR][${requestId}] Jev selection failed:`, conciseError(error));
      return { status: 'unavailable', reason: 'JUDGE_FAILED' };
    }
  }

  /**
   * Split assistants into processable (within tier limit) and exceeded
   * Preserves original order - first N are processable, rest are exceeded
   */
  private splitByTierLimit(
    assistants: AssistantConfiguration[],
    maxBatchSize: number
  ): { processable: AssistantConfiguration[]; exceeded: AssistantConfiguration[] } {
    return {
      processable: assistants.slice(0, maxBatchSize),
      exceeded: assistants.slice(maxBatchSize)
    };
  }

  /**
   * Validate user has access to all requested models
   */
  private validateAllModelAccess(
    user: UserProfile,
    assistants: AssistantConfiguration[]
  ): void {
    for (const assistant of assistants) {
      const model = getModelById(assistant.model);
      
      if (!model) {
        throw new Error(`Unknown model: ${assistant.model}`);
      }

      this.authzService.requireModelAccess(user, assistant.model);
    }
  }

  /**
   * Estimate total tokens for all assistants (rough estimate)
   */
  private estimateTotalTokens(assistants: AssistantConfiguration[]): number {
    return assistants.reduce((total, assistant) => {
      const textLength = assistant.userText.length + 
        (assistant.contextText?.length || 0);
      // Rough estimate: 4 chars ≈ 1 token + 500 tokens overhead per assistant
      return total + Math.ceil(textLength / 4) + 500;
    }, 0);
  }

  /**
   * Process all assistants in parallel using Promise.allSettled
   */
  private async processAllAssistants(
    assistants: AssistantConfiguration[],
    user: UserProfile,
    requestId: string,
  ): Promise<AssistantProcessingResult[]> {
    // Create promises for all assistant tasks
    const promises = assistants.map(assistant =>
      this.executeAssistantTask(assistant, user, requestId)
    );

    // Execute all in parallel, catch individual failures
    const results = await Promise.allSettled(promises);

    // Convert PromiseSettledResult to AssistantProcessingResult
    return results.map((result, index) => {
      const assistantId = assistants[index].id;

      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Handle promise rejection - always log for admin
        const error = result.reason as Error;
        console.error(`[ORCHESTRATOR][${requestId}] Task processing failed:`, assistantId, conciseError(error));

        return {
          id: assistantId,
          success: false,
          error: {
            code: 'TASK_PROCESSING_FAILED',
            ...(this.exposeErrorDetails && { message: error.message || 'Unknown error occurred' })
          }
        };
      }
    });
  }

  /**
   * Execute assistant task: build prompt + call LLM
   */
  private async executeAssistantTask(
    assistant: AssistantConfiguration,
    user: UserProfile,
    requestId: string,
  ): Promise<AssistantProcessingResult> {
    try {
      return await traceRun({
        name: 'enhance.assistant',
        runType: 'chain',
        inputs: {
          source: assistant.userText,
          context: assistant.contextText,
          assistant,
        },
        metadata: {
          requestId,
          userId: user.userId,
          userTier: user.tier,
          assistantId: assistant.id,
          role: assistant.aiRoleId,
          transformations: assistant.options,
          requestedPublicModel: assistant.model,
        },
        operation: () => this.runAssistantTask(assistant, user, requestId),
      });
    } catch (error) {
      if (error instanceof LLMTimeoutError) {
        console.error(`[ORCHESTRATOR][${requestId}] Task timeout:`, assistant.id, conciseError(error));
        return {
          id: assistant.id,
          success: false,
          error: {
            code: 'TASK_TIMEOUT',
            ...(this.exposeErrorDetails && { message: error.message })
          }
        };
      }

      console.error(`[ORCHESTRATOR][${requestId}] LLM error:`, assistant.id, conciseError(error));
      return {
        id: assistant.id,
        success: false,
        error: {
          code: 'LLM_ERROR',
          ...(this.exposeErrorDetails && { message: (error as Error).message || 'LLM call failed' })
        }
      };
    }
  }

  private async runAssistantTask(
    assistant: AssistantConfiguration,
    user: UserProfile,
    requestId: string,
  ): Promise<AssistantProcessingResult> {
      // 1. Get model and role configurations
      const model = getModelById(assistant.model);
      const role = getRoleById(assistant.aiRoleId);

      if (!model) {
        throw new Error(`Unknown model: ${assistant.model}`);
      }

      if (!role) {
        throw new Error(`Unknown AI role: ${assistant.aiRoleId}`);
      }

      // 2. Build prompts using PromptBuilder
      const { systemPrompt, userPrompt, promptRevision, promptFingerprint } = await this.promptBuilder.buildPrompt({
        id: assistant.id,
        model: assistant.model,
        aiRoleId: assistant.aiRoleId,
        userText: assistant.userText,
        contextText: assistant.contextText,
        options: assistant.options
      });
      addTraceMetadata({ promptRevision, promptFingerprint });

      // 3. Get appropriate LLM connector
      const connector = LLMConnectorFactory.getConnector(
        this.connectors,
        model.provider
      );

      // 4. Call LLM; the connector owns cancellation and timer cleanup
      const response = await connector.sendRequest({
        model: model.providerModelId,
        requestedPublicModel: assistant.model,
        requestId,
        systemPrompt,
        userPrompt,
        structuredOutputMode: model.structuredOutputMode,
        serviceTier: model.serviceTier,
        reasoningEffort: model.reasoningEffort,
        maxTokens: getLimitsForTier(user.tier).maxTokensPerRequest,
        timeout: this.taskTimeoutMs
      });

      // 5. Require the provider's structured response contract
      const enhancedText = await traceRun({
        name: 'output.parse',
        runType: 'parser',
        inputs: { rawModelOutput: response.text },
        metadata: {
          requestId,
          assistantId: assistant.id,
          promptRevision,
          promptFingerprint,
          finishReason: response.diagnostics?.finishReason,
        },
        operation: async () => ({
          text: parseTextOutput(response.text, response.diagnostics),
        }),
      }).then(result => result.text);

      // 6. Return success result
      return {
        id: assistant.id,
        success: true,
        enhancedText,
        tokensUsed: response.usage.totalTokens
      };

  }

  /**
   * Convert internal result to API result format
   */
  private toApiResult(result: AssistantProcessingResult): BatchResult {
    if (result.success) {
      return {
        id: result.id,
        status: 'success',
        enhancedText: result.enhancedText!,
        total_tokens: result.tokensUsed || 0
      } as SuccessResult;
    } else {
      return {
        id: result.id,
        status: 'error',
        error: result.error!
      } as ErrorResult;
    }
  }
}

function conciseError(error: unknown): Record<string, unknown> {
  const value = error as Error;
  return {
    name: value?.name ?? 'Error',
    ...(error instanceof LLMError && {
      provider: error.provider,
      code: error.code,
      statusCode: error.statusCode,
    }),
  };
}
