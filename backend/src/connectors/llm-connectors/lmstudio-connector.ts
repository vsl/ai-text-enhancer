/** Local LM Studio connector using its OpenAI-compatible endpoint. */
import type { LLMConnector, LLMRequestParams, LLMResponse } from '../../types/llm.types.ts';
import { LLMError, LLMRateLimitError, LLMTimeoutError } from '../../errors/llm-errors.ts';
import { TEXT_OUTPUT_SCHEMA, TEXT_OUTPUT_SCHEMA_NAME } from '../../config/output-contract.config.ts';
import { addTraceMetadata, traceRun } from '../../observability/tracing.ts';
import { parseProviderResponse } from './provider-response.ts';

export class LMStudioConnector implements LLMConnector {
  name = 'lmstudio';
  supportsStreaming = false;

  constructor(private baseUrl: string = 'http://localhost:1234') {}

  async sendRequest(params: LLMRequestParams): Promise<LLMResponse> {
    const timeout = params.timeout || 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const url = `${this.baseUrl}/v1/chat/completions`;
    const body = {
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      max_tokens: params.maxTokens ?? 2048,
      response_format: {
        type: 'json_schema',
        json_schema: { name: TEXT_OUTPUT_SCHEMA_NAME, strict: true, schema: TEXT_OUTPUT_SCHEMA },
      },
    };

    try {
      const result = await traceRun({
        name: 'llm.lmstudio',
        runType: 'llm',
        inputs: { method: 'POST', url, body },
        metadata: { requestId: params.requestId, requestedPublicModel: params.requestedPublicModel, providerModel: params.model },
        operation: async () => {
          const startedAt = performance.now();
          let response: Response;
          try {
            response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              signal: controller.signal,
            });
          } catch (error) {
            if ((error as Error).name === 'AbortError') throw new LLMTimeoutError('lmstudio', timeout);
            throw new LLMError('lmstudio', 'Cannot connect to LM Studio - ensure it is running locally', undefined, 'PROVIDER_NETWORK_ERROR');
          }
          const rawResponse = typeof response.text === 'function'
            ? await response.text()
            : JSON.stringify(await response.json());
          const parsedResponse = parseProviderResponse(rawResponse);
          const latencyMs = Math.round(performance.now() - startedAt);
          const choice = parsedResponse?.choices?.[0];
          const usage = parsedResponse?.usage ?? {};
          addTraceMetadata({
            httpStatus: response.status,
            generationId: parsedResponse?.id,
            resolvedModel: parsedResponse?.model,
            resolvedProvider: 'lmstudio',
            finishReason: choice?.finish_reason,
            providerError: choice?.error ?? parsedResponse?.error,
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            latencyMs,
            ...(parsedResponse === null && { failureCode: 'INVALID_PROVIDER_RESPONSE' }),
            ...(response.ok && parsedResponse && !choice && !parsedResponse.error && { failureCode: 'MISSING_CHOICE' }),
            ...(response.ok && (choice?.error || parsedResponse?.error) && { failureCode: 'PROVIDER_RESPONSE_ERROR' }),
            ...(!response.ok && { failureCode: response.status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_HTTP_ERROR' }),
          });
          return { httpStatus: response.status, rawResponse, parsedResponse, latencyMs };
        },
      });

      const data = result.parsedResponse;
      if (result.httpStatus === 429) throw new LLMRateLimitError('lmstudio');
      if (result.httpStatus < 200 || result.httpStatus >= 300) {
        throw new LLMError('lmstudio', data?.error?.message || `HTTP ${result.httpStatus} - Local LM Studio error`, result.httpStatus, 'PROVIDER_HTTP_ERROR', data?.error ?? result.rawResponse);
      }
      if (!data) throw new LLMError('lmstudio', 'Provider returned invalid JSON', result.httpStatus, 'INVALID_PROVIDER_RESPONSE', result.rawResponse);
      const choice = data.choices?.[0];
      const providerError = choice?.error ?? data.error;
      if (providerError) throw new LLMError('lmstudio', providerError.message || 'Provider reported an error', result.httpStatus, 'PROVIDER_RESPONSE_ERROR', providerError);
      if (!choice) throw new LLMError('lmstudio', 'No response from local model', result.httpStatus, 'MISSING_CHOICE');

      const usage = data.usage ?? {};
      return {
        text: choice.message?.content ?? '',
        usage: {
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
        model: data.model || params.model,
        provider: 'lmstudio',
        diagnostics: {
          generationId: data.id,
          httpStatus: result.httpStatus,
          requestedPublicModel: params.requestedPublicModel,
          providerModel: params.model,
          resolvedModel: data.model,
          resolvedProvider: 'lmstudio',
          finishReason: choice.finish_reason,
          providerError,
          latencyMs: result.latencyMs,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
