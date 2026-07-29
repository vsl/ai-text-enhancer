/**
 * LLM Connector Factory Tests
 */

import { LLMConnectorFactory } from '../../../src/connectors/llm-connectors/factory.ts';
import { GeminiConnector } from '../../../src/connectors/llm-connectors/gemini-connector.ts';
import { OpenRouterConnector } from '../../../src/connectors/llm-connectors/openrouter-connector.ts';
import { LMStudioConnector } from '../../../src/connectors/llm-connectors/lmstudio-connector.ts';
import type { LLMProviderConfig } from '../../../src/types/config.types.ts';

describe('LLMConnectorFactory', () => {
  describe('create', () => {
    it('should create Gemini connector', () => {
      const config: LLMProviderConfig = {
        name: 'gemini',
        apiKey: 'test-key',
        models: []
      };

      const connector = LLMConnectorFactory.create(config);

      expect(connector).toBeInstanceOf(GeminiConnector);
      expect(connector.name).toBe('gemini');
    });

    it('should create OpenRouter connector', () => {
      const config: LLMProviderConfig = {
        name: 'openrouter',
        apiKey: 'test-key',
        models: []
      };

      const connector = LLMConnectorFactory.create(config);

      expect(connector).toBeInstanceOf(OpenRouterConnector);
      expect(connector.name).toBe('openrouter');
    });

    it('should create LM Studio connector', () => {
      const config: LLMProviderConfig = {
        name: 'lmstudio',
        apiKey: '',
        baseUrl: 'http://localhost:1234',
        models: []
      };

      const connector = LLMConnectorFactory.create(config);

      expect(connector).toBeInstanceOf(LMStudioConnector);
      expect(connector.name).toBe('lmstudio');
    });

    it('should use default base URL for LM Studio if not provided', () => {
      const config: LLMProviderConfig = {
        name: 'lmstudio',
        apiKey: '',
        models: []
      };

      const connector = LLMConnectorFactory.create(config);

      expect(connector).toBeInstanceOf(LMStudioConnector);
    });

    it('should throw error for unknown provider', () => {
      const config: LLMProviderConfig = {
        name: 'unknown-provider',
        apiKey: 'test-key',
        models: []
      };

      expect(() => LLMConnectorFactory.create(config)).toThrow(
        'Unknown provider: unknown-provider'
      );
    });

    it('should throw error for Gemini without API key', () => {
      const config: LLMProviderConfig = {
        name: 'gemini',
        apiKey: '',
        models: []
      };

      expect(() => LLMConnectorFactory.create(config)).toThrow(
        'Gemini API key is required'
      );
    });

    it('should throw error for OpenRouter without API key', () => {
      const config: LLMProviderConfig = {
        name: 'openrouter',
        apiKey: '',
        models: []
      };

      expect(() => LLMConnectorFactory.create(config)).toThrow(
        'OpenRouter API key is required'
      );
    });
  });

  describe('createAll', () => {
    it('should create multiple connectors', () => {
      const configs: LLMProviderConfig[] = [
        {
          name: 'gemini',
          apiKey: 'gemini-key',
          models: []
        },
        {
          name: 'openrouter',
          apiKey: 'openrouter-key',
          models: []
        },
        {
          name: 'lmstudio',
          apiKey: '',
          models: []
        }
      ];

      const connectors = LLMConnectorFactory.createAll(configs);

      expect(connectors.size).toBe(3);
      expect(connectors.get('gemini')).toBeInstanceOf(GeminiConnector);
      expect(connectors.get('openrouter')).toBeInstanceOf(OpenRouterConnector);
      expect(connectors.get('lmstudio')).toBeInstanceOf(LMStudioConnector);
    });

    it('should skip invalid providers but continue with valid ones', () => {
      const configs: LLMProviderConfig[] = [
        {
          name: 'gemini',
          apiKey: 'gemini-key',
          models: []
        },
        {
          name: 'invalid-provider',
          apiKey: 'key',
          models: []
        },
        {
          name: 'openrouter',
          apiKey: 'openrouter-key',
          models: []
        }
      ];

      // Mock console.error to avoid test output pollution
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const connectors = LLMConnectorFactory.createAll(configs);

      expect(connectors.size).toBe(2);
      expect(connectors.get('gemini')).toBeInstanceOf(GeminiConnector);
      expect(connectors.get('openrouter')).toBeInstanceOf(OpenRouterConnector);
      expect(connectors.get('invalid-provider')).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should throw error if no valid connectors created', () => {
      const configs: LLMProviderConfig[] = [
        {
          name: 'invalid1',
          apiKey: 'key',
          models: []
        },
        {
          name: 'invalid2',
          apiKey: 'key',
          models: []
        }
      ];

      // Mock console.error to avoid test output pollution
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => LLMConnectorFactory.createAll(configs)).toThrow(
        'No LLM connectors could be initialized'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty array', () => {
      expect(() => LLMConnectorFactory.createAll([])).toThrow(
        'No LLM connectors could be initialized'
      );
    });
  });

  describe('getConnector', () => {
    it('should retrieve existing connector', () => {
      const connectors = new Map();
      const geminiConnector = new GeminiConnector('test-key');
      connectors.set('gemini', geminiConnector);

      const connector = LLMConnectorFactory.getConnector(connectors, 'gemini');

      expect(connector).toBe(geminiConnector);
    });

    it('should throw error for non-existent connector', () => {
      const connectors = new Map();
      const geminiConnector = new GeminiConnector('test-key');
      connectors.set('gemini', geminiConnector);

      expect(() =>
        LLMConnectorFactory.getConnector(connectors, 'openrouter')
      ).toThrow('No connector found for provider: openrouter');
    });

    it('should throw error for empty map', () => {
      const connectors = new Map();

      expect(() =>
        LLMConnectorFactory.getConnector(connectors, 'gemini')
      ).toThrow('No connector found for provider: gemini');
    });
  });
});
