/**
 * Gemini Connector Tests
 */

import { GeminiConnector } from '../../../src/connectors/llm-connectors/gemini-connector.ts';
import { LLMAuthenticationError, LLMTimeoutError, LLMError } from '../../../src/errors/llm-errors.ts';

// Mock fetch globally
global.fetch = jest.fn();

describe('GeminiConnector', () => {
  let connector: GeminiConnector;

  beforeEach(() => {
    connector = new GeminiConnector('test-api-key');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('sendRequest', () => {
    it('should send request successfully', async () => {
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Enhanced text here' }]
              }
            }
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15
          }
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await connector.sendRequest({
        model: 'gemini-1.5-flash',
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Fix this text'
      });

      expect(result.text).toBe('Enhanced text here');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.provider).toBe('gemini');
      expect(result.model).toBe('gemini-1.5-flash');
      expect(infoSpy).not.toHaveBeenCalled();
      infoSpy.mockRestore();
    });

    it('should handle authentication error (401)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({})
      });

      await expect(
        connector.sendRequest({
          model: 'gemini-1.5-flash',
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
          model: 'gemini-1.5-flash',
          systemPrompt: 'Test',
          userPrompt: 'Test'
        })
      ).rejects.toThrow(LLMAuthenticationError);
    });

    it('should handle API error with message', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            message: 'Internal server error'
          }
        })
      });

      await expect(
        connector.sendRequest({
          model: 'gemini-1.5-flash',
          systemPrompt: 'Test',
          userPrompt: 'Test'
        })
      ).rejects.toThrow('Internal server error');
    });

    it('should handle missing response candidate', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: []
        })
      });

      await expect(
        connector.sendRequest({
          model: 'gemini-1.5-flash',
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
          model: 'gemini-1.5-flash',
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
          candidates: [
            {
              content: {
                parts: [{ text: 'Response' }]
              }
            }
          ],
          usageMetadata: {}
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await connector.sendRequest({
        model: 'gemini-1.5-flash',
        systemPrompt: 'System',
        userPrompt: 'User',
        temperature: 0.9,
        maxTokens: 4096
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.generationConfig.temperature).toBe(0.9);
      expect(body.generationConfig.maxOutputTokens).toBe(4096);
    });

    it('should include JSON schema in request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"text": "Response"}' }]
              }
            }
          ]
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await connector.sendRequest({
        model: 'gemini-1.5-flash',
        systemPrompt: 'System',
        userPrompt: 'User'
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.generationConfig.responseSchema).toEqual({
        type: 'object',
        properties: {
          text: {
            type: 'string'
          }
        },
        required: ['text'],
        additionalProperties: false,
      });
    });

    it('omits unevaluated temperature and preserves explicit zero', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"text":"ok"}' }] } }] }),
      });

      await connector.sendRequest({ model: 'test-model', systemPrompt: 'System', userPrompt: 'User' });
      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).generationConfig).not.toHaveProperty('temperature');

      await connector.sendRequest({ model: 'test-model', systemPrompt: 'System', userPrompt: 'User', temperature: 0 });
      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).generationConfig.temperature).toBe(0);
    });

    it('should handle missing usage metadata', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Text' }]
              }
            }
          ]
          // No usageMetadata
        })
      });

      const result = await connector.sendRequest({
        model: 'gemini-1.5-flash',
        systemPrompt: 'System',
        userPrompt: 'User'
      });

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });

    it('should construct proper API URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Text' }]
              }
            }
          ]
        })
      });

      await connector.sendRequest({
        model: 'gemini-1.5-pro',
        systemPrompt: 'System',
        userPrompt: 'User'
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain('gemini-1.5-pro:generateContent');
      expect(fetchCall[0]).toContain('key=test-api-key');
    });
  });
});
