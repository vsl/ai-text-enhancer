/**
 * OpenRouter Connector
 * 
 * Platform-agnostic connector using native fetch API.
 */

import type { LLMConnector, LLMRequestParams, LLMResponse } from '../../types/llm.types.ts';
import { LLMError, LLMTimeoutError, LLMAuthenticationError } from '../../errors/llm-errors.ts';
import { TEXT_OUTPUT_SCHEMA, TEXT_OUTPUT_SCHEMA_NAME } from '../../config/output-contract.config.ts';

export class OpenRouterConnector implements LLMConnector {
  name = 'openrouter';
  supportsStreaming = false;

  constructor(private apiKey: string) {}

  async sendRequest(params: LLMRequestParams): Promise<LLMResponse> {
    const timeout = params.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = 'https://openrouter.ai/api/v1/chat/completions';

      const responseFormat = params.structuredOutputMode === 'json-schema'
        ? {
            type: 'json_schema',
            json_schema: {
              name: TEXT_OUTPUT_SCHEMA_NAME,
              strict: true,
              schema: TEXT_OUTPUT_SCHEMA,
            },
          }
        : { type: 'json_object' };

      const body = {
        model: params.model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt }
        ],
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.serviceTier && { service_tier: params.serviceTier }),
        max_tokens: params.maxTokens ?? 2048,
        response_format: responseFormat,
        provider: {
          require_parameters: true,
        },
      };

      const debug = process.env.LOG_LEVEL?.toLowerCase() === 'debug';
      const requestId = debug ? crypto.randomUUID() : undefined;

      if (debug) {
        console.debug('[OPENROUTER][DEBUG] request', JSON.stringify({
          requestId,
          method: 'POST',
          url,
          body,
        }));
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/vorkov/ai-text-enhancer',
          'X-Title': 'AI Text Enhancer'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (debug) {
        const responseBody = await response.clone().text().catch((error) =>
          `[unable to read response body: ${(error as Error).message}]`
        );
        console.debug('[OPENROUTER][DEBUG] response', JSON.stringify({
          requestId,
          status: response.status,
          body: responseBody,
        }));
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new LLMAuthenticationError('openrouter');
        }

        const errorData = await response.json().catch(() => ({})) as any;
        throw new LLMError(
          'openrouter',
          errorData.error?.message || `HTTP ${response.status}`,
          response.status
        );
      }

      const data = await response.json() as any;
      const choice = data.choices?.[0];

      if (!choice) {
        throw new LLMError('openrouter', 'No response from model');
      }

      const text = choice.message?.content || '';
      const usage = data.usage || {};

      return {
        text,
        usage: {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0
        },
        model: data.model || params.model,
        provider: 'openrouter'
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new LLMTimeoutError('openrouter', timeout);
      }

      throw new LLMError('openrouter', (error as Error).message);
    }
  }
}
