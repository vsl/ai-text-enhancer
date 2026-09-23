/**
 * OpenRouter Connector Tests
 */

import { OpenRouterConnector } from '../../../src/connectors/llm-connectors/openrouter-connector.ts';
import { LLMAuthenticationError, LLMTimeoutError, LLMError } from '../../../src/errors/llm-errors.ts';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenRouterConnector', () => {
  let connector: OpenRouterConnector;

  beforeEach(() => {
    connector = new OpenRouterConnector('test-api-key');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('sendRequest', () => {
    it('should send request successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Enhanced text from OpenRouter'
              }
            }
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 8,
            total_tokens: 23
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await connector.sendRequest({
        model: 'meta-llama/llama-3-8b-instruct:free',
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Fix this text'
      });

      expect(result.text).toBe('Enhanced text from OpenRouter');
      expect(result.usage.inputTokens).toBe(15);
      expect(result.usage.outputTokens).toBe(8);
      expect(result.usage.totalTokens).toBe(23);
      expect(result.provider).toBe('openrouter');
      expect(result.model).toBe('meta-llama/llama-3-8b-instruct:free');
    });

    it('should handle authentication error (401)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({})
      });

      await expect(
        connector.sendRequest({
          model: 'test-model',
          systemPrompt: 'Test',
          userPrompt: 'Test'
        })
      ).rejects.toThrow(LLMAuthenticationError);
    });

    it('should handle authentication error (403)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({})
      });

      await expect(
        connector.sendRequest({
          model: 'test-model',
          systemPrompt: 'Test',
          userPrompt: 'Test'
        })
      ).rejects.toThrow(LLMAuthenticationError);
    });

    it('should handle API error with message', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Rate limit exceeded'
          }
        })
      });

      await expect(
        connector.sendRequest({
          model: 'test-model',
          systemPrompt: 'Test',
          userPrompt: 'Test'
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle missing response choice', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: []
        })
      });

      await expect(
        connector.sendRequest({
          model: 'test-model',
          systemPrompt: 'Test',
          userPrompt: 'Test'
        })
      ).rejects.toThrow('No response from model');
    });

    it('should handle timeout when AbortController aborts', async () => {
      // Simulate an aborted fetch
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      
      (global.fetch as jest.Mock).mockRejectedValue(abortError);

      await expect(
        connector.sendRequest({
          model: 'test-model',
          systemPrompt: 'Test',
          userPrompt: 'Test',
          timeout: 1000
        })
      ).rejects.toThrow(LLMTimeoutError);
    });

    it('should use custom temperature and maxTokens', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Response'
              }
            }
          ],
          usage: {}
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await connector.sendRequest({
        model: 'test-model',
        systemPrompt: 'System',
        userPrompt: 'User',
        temperature: 0.9,
        maxTokens: 4096
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.temperature).toBe(0.9);
      expect(body.max_tokens).toBe(4096);
    });

    it('should require supported JSON mode from the provider', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"text": "Response"}'
              }
            }
          ]
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await connector.sendRequest({
        model: 'test-model',
        systemPrompt: 'System',
        userPrompt: 'User'
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.response_format).toEqual({
        type: 'json_object',
      });
      expect(body.provider).toEqual({ require_parameters: true });
    });

    it('uses strict JSON schema only when model metadata enables it', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"text":"ok"}' } }] }),
      });

      await connector.sendRequest({
        model: 'schema-model',
        systemPrompt: 'System',
        userPrompt: 'User',
        structuredOutputMode: 'json-schema',
      });

      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).response_format).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'text_enhancement',
          strict: true,
          schema: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
            additionalProperties: false,
          },
        },
      });
    });

    it('omits unevaluated temperature and preserves explicit zero', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"text":"ok"}' } }] }),
      });

      await connector.sendRequest({ model: 'test-model', systemPrompt: 'System', userPrompt: 'User' });
      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).not.toHaveProperty('temperature');

      await connector.sendRequest({ model: 'test-model', systemPrompt: 'System', userPrompt: 'User', temperature: 0 });
      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).temperature).toBe(0);
    });

    it('sends the flex service tier only when configured', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"text":"ok"}' } }] }),
      });

      await connector.sendRequest({
        model: 'openai/gpt-5-nano',
        systemPrompt: 'System',
        userPrompt: 'User',
        serviceTier: 'flex',
      });

      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).service_tier).toBe('flex');
    });

    it('should handle missing usage metadata', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Text'
              }
            }
          ]
          // No usage
        })
      });

      const result = await connector.sendRequest({
        model: 'test-model',
        systemPrompt: 'System',
        userPrompt: 'User'
      });

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });

    it('should set proper headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Text'
              }
            }
          ]
        })
      });

      await connector.sendRequest({
        model: 'test-model',
        systemPrompt: 'System',
        userPrompt: 'User'
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['Authorization']).toBe('Bearer test-api-key');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['HTTP-Referer']).toBeDefined();
      expect(headers['X-Title']).toBe('AI Text Enhancer');
    });

    it('should send messages in correct format', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Text'
              }
            }
          ]
        })
      });

      await connector.sendRequest({
        model: 'test-model',
        systemPrompt: 'System prompt here',
        userPrompt: 'User prompt here'
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.messages).toEqual([
        { role: 'system', content: 'System prompt here' },
        { role: 'user', content: 'User prompt here' }
      ]);
    });

    it('aborts the real fetch signal and clears its timer without logging prompts', async () => {
      jest.useFakeTimers();
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();
      let signal: AbortSignal | undefined;
      (global.fetch as jest.Mock).mockImplementation((_url, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      const request = connector.sendRequest({
        model: 'test-model',
        systemPrompt: 'sensitive system prompt',
        userPrompt: 'sensitive source text',
        timeout: 50,
      });
      jest.advanceTimersByTime(50);

      await expect(request).rejects.toThrow(LLMTimeoutError);
      expect(signal?.aborted).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
      expect(infoSpy).not.toHaveBeenCalled();
      infoSpy.mockRestore();
    });
  });
});
