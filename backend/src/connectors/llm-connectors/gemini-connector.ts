/** Google Gemini connector using the native REST API. */
import type { LLMConnector, LLMRequestParams, LLMResponse } from '../../types/llm.types.ts';
import { LLMAuthenticationError, LLMError, LLMRateLimitError, LLMTimeoutError } from '../../errors/llm-errors.ts';
import { TEXT_OUTPUT_SCHEMA } from '../../config/output-contract.config.ts';
import { addTraceMetadata, traceRun } from '../../observability/tracing.ts';
import { parseProviderResponse } from './provider-response.ts';

export class GeminiConnector implements LLMConnector {
  name = 'gemini';
  supportsStreaming = false;

  constructor(private apiKey: string) {}

  async sendRequest(params: LLMRequestParams): Promise<LLMResponse> {
    const timeout = params.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${this.apiKey}`;
    const body = {
      systemInstruction: { parts: [{ text: params.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: params.userPrompt }] }],
      generationConfig: {
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        maxOutputTokens: params.maxTokens ?? 2048,
        responseMimeType: 'application/json',
        responseSchema: TEXT_OUTPUT_SCHEMA,
      },
    };

    try {
      const result = await traceRun({
        name: 'llm.gemini',
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
            if ((error as Error).name === 'AbortError') throw new LLMTimeoutError('gemini', timeout);
            throw new LLMError('gemini', (error as Error).message, undefined, 'PROVIDER_NETWORK_ERROR');
          }
          const rawResponse = typeof response.text === 'function'
            ? await response.text()
            : JSON.stringify(await response.json());
          const parsedResponse = parseProviderResponse(rawResponse);
          const latencyMs = Math.round(performance.now() - startedAt);
          const candidate = parsedResponse?.candidates?.[0];
          const usage = parsedResponse?.usageMetadata ?? {};
          addTraceMetadata({
            httpStatus: response.status,
            resolvedModel: parsedResponse?.modelVersion,
            resolvedProvider: 'gemini',
            finishReason: candidate?.finishReason,
            providerError: parsedResponse?.error,
            inputTokens: usage.promptTokenCount,
            outputTokens: usage.candidatesTokenCount,
            totalTokens: usage.totalTokenCount,
            cachedTokens: usage.cachedContentTokenCount,
            latencyMs,
            ...(parsedResponse === null && { failureCode: 'INVALID_PROVIDER_RESPONSE' }),
            ...(response.ok && parsedResponse && !candidate && !parsedResponse.error && { failureCode: 'MISSING_CHOICE' }),
            ...(response.ok && parsedResponse?.error && { failureCode: 'PROVIDER_RESPONSE_ERROR' }),
            ...(!response.ok && { failureCode: response.status === 401 || response.status === 403
              ? 'PROVIDER_AUTH_ERROR'
              : response.status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_HTTP_ERROR' }),
          });
          return { httpStatus: response.status, rawResponse, parsedResponse, latencyMs };
        },
      });

      const data = result.parsedResponse;
      if (result.httpStatus === 401 || result.httpStatus === 403) throw new LLMAuthenticationError('gemini');
      if (result.httpStatus === 429) throw new LLMRateLimitError('gemini');
      if (result.httpStatus < 200 || result.httpStatus >= 300) {
        throw new LLMError('gemini', data?.error?.message || `HTTP ${result.httpStatus}`, result.httpStatus, 'PROVIDER_HTTP_ERROR', data?.error ?? result.rawResponse);
      }
      if (!data) throw new LLMError('gemini', 'Provider returned invalid JSON', result.httpStatus, 'INVALID_PROVIDER_RESPONSE', result.rawResponse);
      if (data.error) throw new LLMError('gemini', data.error.message || 'Provider reported an error', result.httpStatus, 'PROVIDER_RESPONSE_ERROR', data.error);
      const candidate = data.candidates?.[0];
      if (!candidate) throw new LLMError('gemini', 'No response from model', result.httpStatus, 'MISSING_CHOICE');

      const usage = data.usageMetadata ?? {};
      return {
        text: candidate.content?.parts?.[0]?.text ?? '',
        usage: {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
          cachedTokens: usage.cachedContentTokenCount ?? 0,
        },
        model: data.modelVersion || params.model,
        provider: 'gemini',
        diagnostics: {
          httpStatus: result.httpStatus,
          requestedPublicModel: params.requestedPublicModel,
          providerModel: params.model,
          resolvedModel: data.modelVersion,
          resolvedProvider: 'gemini',
          finishReason: candidate.finishReason,
          providerError: data.error,
          latencyMs: result.latencyMs,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
