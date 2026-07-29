/**
 * OpenRouter Connector
 * 
 * Platform-agnostic connector using native fetch API.
 */

import type { LLMConnector, LLMRequestParams, LLMResponse } from '../../types/llm.types.ts';
import { LLMError, LLMTimeoutError, LLMAuthenticationError } from '../../errors/llm-errors.ts';

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

      const body = {
        model: params.model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt }
        ],
        temperature: params.temperature || 0.7,
        max_tokens: params.maxTokens || 2048,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "text_enhancement",
            strict: true,
            schema: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                },
              },
              required: ["text"],
              additionalProperties: false,
            },
          },
        },
      };

      console.info("OpenRouter request body:", JSON.stringify(body));
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
        model: params.model,
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
