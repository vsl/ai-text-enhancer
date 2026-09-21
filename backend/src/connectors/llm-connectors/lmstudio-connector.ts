/**
 * LM Studio Connector
 * 
 * Platform-agnostic connector for local LM Studio development.
 * Uses OpenAI-compatible API format.
 */

import type { LLMConnector, LLMRequestParams, LLMResponse } from '../../types/llm.types.ts';
import { LLMError, LLMTimeoutError } from '../../errors/llm-errors.ts';
import { TEXT_OUTPUT_SCHEMA, TEXT_OUTPUT_SCHEMA_NAME } from '../../config/output-contract.config.ts';

export class LMStudioConnector implements LLMConnector {
  name = 'lmstudio';
  supportsStreaming = false;

  constructor(private baseUrl: string = 'http://localhost:1234') {}

  async sendRequest(params: LLMRequestParams): Promise<LLMResponse> {
    const timeout = params.timeout || 60000; // Longer timeout for local models
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = `${this.baseUrl}/v1/chat/completions`;

      const body = {
        model: params.model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt }
        ],
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        max_tokens: params.maxTokens ?? 2048,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: TEXT_OUTPUT_SCHEMA_NAME,
            strict: true,
            schema: TEXT_OUTPUT_SCHEMA,
          },
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new LLMError(
          'lmstudio',
          errorData.error?.message || `HTTP ${response.status} - Local LM Studio error`,
          response.status
        );
      }

      const data = await response.json() as any;
      const choice = data.choices?.[0];

      if (!choice) {
        throw new LLMError('lmstudio', 'No response from local model');
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
        provider: 'lmstudio'
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new LLMTimeoutError('lmstudio', timeout);
      }

      // Connection errors for local development
      if ((error as Error).message.includes('ECONNREFUSED') || 
          (error as Error).message.includes('Failed to fetch')) {
        throw new LLMError(
          'lmstudio', 
          'Cannot connect to LM Studio - ensure it is running locally',
          0,
          'CONNECTION_REFUSED'
        );
      }

      throw new LLMError('lmstudio', (error as Error).message);
    }
  }
}
