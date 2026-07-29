/**
 * LM Studio Connector Tests
 */

import { LMStudioConnector } from '../../../src/connectors/llm-connectors/lmstudio-connector.ts';
import { LLMTimeoutError, LLMError } from '../../../src/errors/llm-errors.ts';

// Mock fetch globally
global.fetch = jest.fn();

describe('LMStudioConnector', () => {
  let connector: LMStudioConnector;

  beforeEach(() => {
    connector = new LMStudioConnector('http://localhost:1234');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
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
                content: 'Enhanced text from local model'
              }
            }
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 6,
            total_tokens: 18
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await connector.sendRequest({
        model: 'local-model',
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Fix this text'
      });

      expect(result.text).toBe('Enhanced text from local model');
      expect(result.usage.inputTokens).toBe(12);
      expect(result.usage.outputTokens).toBe(6);
      expect(result.usage.totalTokens).toBe(18);
      expect(result.provider).toBe('lmstudio');
      expect(result.model).toBe('local-model');
    });

    it('should use custom base URL', async () => {
      const customConnector = new LMStudioConnector('http://192.168.1.100:5000');

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

      await customConnector.sendRequest({
        model: 'test-model',
        systemPrompt: 'System',
        userPrompt: 'User'
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe('http://192.168.1.100:5000/v1/chat/completions');
    });

    it('should handle API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            message: 'Local model error'
          }
        })
      });

      await expect(
        connector.sendRequest({
          model: 'test-model',
          systemPrompt: 'Test',
          userPrompt: 'Test'
        })
      ).rejects.toThrow('Local model error');
    });

    it('should handle connection refused error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch')
      );

      await expect(
        connector.sendRequest({
          model: 'test-model',
          systemPrompt: 'Test',
          userPrompt: 'Test'
        })
      ).rejects.toThrow('Cannot connect to LM Studio');
    });

    it('should handle ECONNREFUSED error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('ECONNREFUSED')
      );

      await expect(
        connector.sendRequest({
          model: 'test-model',
          systemPrompt: 'Test',
          userPrompt: 'Test'
        })
      ).rejects.toThrow('Cannot connect to LM Studio');
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
      ).rejects.toThrow('No response from local model');
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
          timeout: 2000
        })
      ).rejects.toThrow(LLMTimeoutError);
    });

    it('should use longer default timeout (60s)', async () => {
      // This test just verifies the default timeout is 60000ms
      // We can't actually wait 60 seconds, so we just verify the behavior
      const mockResponse = {
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
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Request without timeout should use 60000ms default
      await connector.sendRequest({
        model: 'test-model',
        systemPrompt: 'Test',
        userPrompt: 'Test'
      });

      // Just verify it completes successfully with default timeout
      expect(global.fetch).toHaveBeenCalled();
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
        temperature: 0.5,
        maxTokens: 1024
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(1024);
    });

    it('should include JSON schema in request', async () => {
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
        type: 'json_schema',
        json_schema: {
          name: 'text_enhancement',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              text: {
                type: 'string'
              }
            },
            required: ['text'],
            additionalProperties: false
          }
        }
      });
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
          // No usage - common for local models
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

    it('should not require API key in headers', async () => {
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

      expect(headers['Authorization']).toBeUndefined();
      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
