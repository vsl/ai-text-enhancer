/**
 * Google Gemini Connector
 * 
 * Platform-agnostic connector using native fetch API.
 * NO Gemini SDK - pure REST API implementation.
 */

import type { LLMConnector, LLMRequestParams, LLMResponse } from '../../types/llm.types.ts';
import { LLMError, LLMTimeoutError, LLMAuthenticationError } from '../../errors/llm-errors.ts';
import { TEXT_OUTPUT_SCHEMA } from '../../config/output-contract.config.ts';

export class GeminiConnector implements LLMConnector {
  name = 'gemini';
  supportsStreaming = false;

  constructor(private apiKey: string) {}

  async sendRequest(params: LLMRequestParams): Promise<LLMResponse> {
    const timeout = params.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Gemini API endpoint
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${this.apiKey}`;

      // Construct request body
      // Note: Gemini API uses systemInstruction (separate from contents) instead of role: 'system'
      const body = {
        systemInstruction: {
          parts: [
            { text: params.systemPrompt }
          ]
        },
        contents: [
          {
            role: 'user',
            parts: [
              { text: params.userPrompt }
            ]
          }
        ],
        generationConfig: {
          ...(params.temperature !== undefined && { temperature: params.temperature }),
          maxOutputTokens: params.maxTokens ?? 2048,
          responseMimeType: "application/json",
          responseSchema: TEXT_OUTPUT_SCHEMA,
        }
      };
      // Make request using native fetch
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle errors
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new LLMAuthenticationError('gemini');
        }
        
        const errorData = await response.json().catch(() => ({})) as any;
        throw new LLMError(
          'gemini',
          errorData.error?.message || `HTTP ${response.status}`,
          response.status
        );
      }

      // Parse response
      const data = await response.json() as any;
      const candidate = data.candidates?.[0];
      
      if (!candidate) {
        throw new LLMError('gemini', 'No response from model');
      }

      const text = candidate.content?.parts?.[0]?.text || '';
      const usage = data.usageMetadata || {};

      return {
        text,
        usage: {
          inputTokens: usage.promptTokenCount || 0,
          outputTokens: usage.candidatesTokenCount || 0,
          totalTokens: usage.totalTokenCount || 0
        },
        model: data.modelVersion || params.model,
        provider: 'gemini'
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new LLMTimeoutError('gemini', timeout);
      }

      throw new LLMError('gemini', (error as Error).message);
    }
  }
}
