/** OpenRouter connector using the native fetch API. */
import type { LLMConnector, LLMRequestParams, LLMResponse } from '../../types/llm.types.ts';
import {
  LLMAuthenticationError,
  LLMError,
  LLMRateLimitError,
  LLMTimeoutError,
} from '../../errors/llm-errors.ts';
import { TEXT_OUTPUT_SCHEMA, TEXT_OUTPUT_SCHEMA_NAME } from '../../config/output-contract.config.ts';
import { addTraceMetadata, traceRun } from '../../observability/tracing.ts';
import { parseProviderResponse } from './provider-response.ts';

interface ProviderResult {
  httpStatus: number;
  rawResponse: string;
  parsedResponse: Record<string, any> | null;
  latencyMs: number;
}

export class OpenRouterConnector implements LLMConnector {
  name = 'openrouter';
  supportsStreaming = false;

  constructor(private apiKey: string) {}

  async sendRequest(params: LLMRequestParams): Promise<LLMResponse> {
    const timeout = params.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const body = {
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.serviceTier && { service_tier: params.serviceTier }),
      max_tokens: params.maxTokens ?? 2048,
      ...(params.model === 'openai/gpt-5-nano' && { reasoning: { effort: 'minimal' } }),
      response_format: params.structuredOutputMode === 'json-schema'
        ? {
            type: 'json_schema',
            json_schema: { name: TEXT_OUTPUT_SCHEMA_NAME, strict: true, schema: TEXT_OUTPUT_SCHEMA },
          }
        : { type: 'json_object' },
      provider: { require_parameters: true },
    };
    const debug = process.env.LOG_LEVEL?.toLowerCase() === 'debug';

    if (debug) {
      console.debug('[OPENROUTER][DEBUG] request', JSON.stringify({ requestId: params.requestId, method: 'POST', url, body }));
    }

    try {
      const result = await traceRun({
        name: 'llm.openrouter',
        runType: 'llm',
        inputs: { method: 'POST', url, body },
        metadata: {
          requestId: params.requestId,
          requestedPublicModel: params.requestedPublicModel,
          providerModel: params.model,
        },
        operation: async (): Promise<ProviderResult> => {
          const startedAt = performance.now();
          let response: Response;
          try {
            response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': 'https://github.com/vorkov/ai-text-enhancer',
                'X-Title': 'AI Text Enhancer',
              },
              body: JSON.stringify(body),
              signal: controller.signal,
            });
          } catch (error) {
            if ((error as Error).name === 'AbortError') throw new LLMTimeoutError('openrouter', timeout);
            throw new LLMError('openrouter', (error as Error).message, undefined, 'PROVIDER_NETWORK_ERROR');
          }

          const rawResponse = typeof response.text === 'function'
            ? await response.text()
            : JSON.stringify(await response.json());
          const parsedResponse = parseProviderResponse(rawResponse);
          const latencyMs = Math.round(performance.now() - startedAt);
          const choice = parsedResponse?.choices?.[0];
          const usage = parsedResponse?.usage ?? {};
          const providerError = choice?.error ?? parsedResponse?.error;
          addTraceMetadata({
            httpStatus: response.status,
            generationId: parsedResponse?.id,
            resolvedModel: parsedResponse?.model,
            resolvedProvider: parsedResponse?.provider,
            finishReason: choice?.finish_reason,
            nativeFinishReason: choice?.native_finish_reason,
            providerError,
            latencyMs,
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
            cachedTokens: usage.prompt_tokens_details?.cached_tokens,
            cost: usage.cost,
            isByok: usage.is_byok,
            ...(parsedResponse === null && { failureCode: 'INVALID_PROVIDER_RESPONSE' }),
            ...(response.ok && providerError && { failureCode: 'PROVIDER_RESPONSE_ERROR' }),
            ...(response.ok && parsedResponse && !choice && !providerError && { failureCode: 'MISSING_CHOICE' }),
            ...(!response.ok && { failureCode: response.status === 401 || response.status === 403
              ? 'PROVIDER_AUTH_ERROR'
              : response.status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_HTTP_ERROR' }),
          });
          return { httpStatus: response.status, rawResponse, parsedResponse, latencyMs };
        },
      });

      if (debug) {
        console.debug('[OPENROUTER][DEBUG] response', JSON.stringify({ requestId: params.requestId, status: result.httpStatus, body: result.rawResponse }));
      }

      const data = result.parsedResponse;
      if (result.httpStatus === 401 || result.httpStatus === 403) throw new LLMAuthenticationError('openrouter');
      if (result.httpStatus === 429) throw new LLMRateLimitError('openrouter');
      if (result.httpStatus < 200 || result.httpStatus >= 300) {
        throw new LLMError('openrouter', data?.error?.message || `HTTP ${result.httpStatus}`, result.httpStatus, 'PROVIDER_HTTP_ERROR', data?.error ?? result.rawResponse);
      }
      if (!data) throw new LLMError('openrouter', 'Provider returned invalid JSON', result.httpStatus, 'INVALID_PROVIDER_RESPONSE', result.rawResponse);

      const choice = data.choices?.[0];
      const providerError = choice?.error ?? data.error;
      if (providerError) {
        throw new LLMError('openrouter', providerError.message || 'Provider reported an error', result.httpStatus, 'PROVIDER_RESPONSE_ERROR', providerError);
      }
      if (!choice) throw new LLMError('openrouter', 'No response from model', result.httpStatus, 'MISSING_CHOICE');

      const usage = data.usage ?? {};
      const diagnostics = {
        generationId: data.id,
        httpStatus: result.httpStatus,
        requestedPublicModel: params.requestedPublicModel,
        providerModel: params.model,
        resolvedModel: data.model,
        resolvedProvider: data.provider ?? 'openrouter',
        finishReason: choice.finish_reason,
        nativeFinishReason: choice.native_finish_reason,
        providerError,
        latencyMs: result.latencyMs,
      };
      const response: LLMResponse = {
        text: choice.message?.content ?? '',
        usage: {
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
          reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
          cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
          cost: usage.cost,
          isByok: usage.is_byok,
        },
        model: data.model || params.model,
        provider: data.provider || 'openrouter',
        diagnostics,
      };
      addTraceMetadata({ ...diagnostics, ...response.usage });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
