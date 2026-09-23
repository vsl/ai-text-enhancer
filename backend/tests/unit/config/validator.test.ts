/**
 * Configuration Validator Tests
 */

import { validateConfig, validateConfigDetailed } from '../../../src/config/validator';
import { loadConfig } from '../../../src/config/loader';
import type { SystemConfig } from '../../../src/types/config.types';

describe('Configuration Validator', () => {
  // Store original environment
  const originalEnv = { ...process.env };

  // Setup valid environment for tests
  beforeAll(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.APP_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.BOOTSTRAP_SECRET_KEY = 'test-bootstrap-secret';
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateConfig', () => {
    it('should validate successfully with valid configuration', () => {
      const config = loadConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw error when models array is empty', () => {
      const config = loadConfig();
      config.models = [];

      expect(() => validateConfig(config)).toThrow('No models configured');
    });

    it('should throw error when roles array is empty', () => {
      const config = loadConfig();
      config.roles = [];

      expect(() => validateConfig(config)).toThrow('No roles configured');
    });

    it('should throw error when llmProviders array is empty', () => {
      const config = loadConfig();
      config.llmProviders = [];

      expect(() => validateConfig(config)).toThrow('No LLM providers configured');
    });

    it('should throw error when role references unknown model', () => {
      const config = loadConfig();
      config.roles[0].allowedModels = ['non-existent-model'];

      expect(() => validateConfig(config)).toThrow('references unknown model');
    });

    it('should throw error when model references unknown provider', () => {
      const config = loadConfig();
      config.models[0] = {
        ...config.models[0],
        provider: 'non-existent-provider',
      };

      expect(() => validateConfig(config)).toThrow('references unknown provider');
    });

    it('should reject unsupported structured output modes', () => {
      const config = loadConfig();
      config.models[0].structuredOutputMode = 'unsupported' as never;

      expect(() => validateConfig(config)).toThrow('unsupported structured output mode');
    });

    it('should throw error when non-lmstudio provider missing API key', () => {
      const config = loadConfig();
      config.llmProviders.find((p) => p.name === 'openrouter')!.apiKey = '';

      expect(() => validateConfig(config)).toThrow('missing required API key');
    });

    it('should not throw error when lmstudio provider has no API key', () => {
      const config = loadConfig();
      const lmStudio = config.llmProviders.find((p) => p.name === 'lmstudio');
      if (lmStudio) {
        lmStudio.apiKey = '';
      }

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw error for negative timeout', () => {
      const config = loadConfig();
      config.timeout = -1000;

      expect(() => validateConfig(config)).toThrow('Timeout must be positive');
    });

    it('should throw error for zero timeout', () => {
      const config = loadConfig();
      config.timeout = 0;

      expect(() => validateConfig(config)).toThrow('Timeout must be positive');
    });

    it('should throw error for timeout below minimum', () => {
      const config = loadConfig();
      config.timeout = 500;

      expect(() => validateConfig(config)).toThrow('Timeout too low');
    });

    it('should throw error for timeout above maximum', () => {
      const config = loadConfig();
      config.timeout = 400000;

      expect(() => validateConfig(config)).toThrow('Timeout too high');
    });

    it('should throw error for negative max batch size', () => {
      const config = loadConfig();
      config.maxBatchSize = -5;

      expect(() => validateConfig(config)).toThrow('Max batch size must be positive');
    });

    it('should throw error for zero max batch size', () => {
      const config = loadConfig();
      config.maxBatchSize = 0;

      expect(() => validateConfig(config)).toThrow('Max batch size must be positive');
    });

    it('should throw error for max batch size above limit', () => {
      const config = loadConfig();
      config.maxBatchSize = 150;

      expect(() => validateConfig(config)).toThrow('Max batch size too high');
    });

    it('should throw error when Supabase service role key is missing', () => {
      const config = loadConfig();
      config.supabase.serviceRoleKey = '';

      expect(() => validateConfig(config)).toThrow('Supabase service role key is required');
    });

    it('should throw error when rate limits are missing', () => {
      const config = loadConfig();
      // @ts-ignore - intentionally break config for testing
      config.rateLimits = undefined;

      expect(() => validateConfig(config)).toThrow('Rate limits configuration is missing');
    });

    it('should throw error when tier rate limits are missing', () => {
      const config = loadConfig();
      // @ts-ignore - intentionally break config for testing
      config.rateLimits.free = undefined;

      expect(() => validateConfig(config)).toThrow('Rate limits for "free" tier are missing');
    });

    it('should throw error for negative requests per day', () => {
      const config = loadConfig();
      config.rateLimits.free.requestsPerDay = -10;

      expect(() => validateConfig(config)).toThrow('Requests per day must be positive');
    });

    it('should throw error for negative requests per hour', () => {
      const config = loadConfig();
      config.rateLimits.free.requestsPerHour = -5;

      expect(() => validateConfig(config)).toThrow('Requests per hour must be positive');
    });

    it('should throw error when requests per hour exceeds requests per day', () => {
      const config = loadConfig();
      config.rateLimits.free.requestsPerHour = 1000;
      config.rateLimits.free.requestsPerDay = 100;

      expect(() => validateConfig(config)).toThrow('Requests per hour cannot exceed requests per day');
    });

    it('should throw error with multiple validation failures', () => {
      const config = loadConfig();
      config.timeout = -1000;
      config.maxBatchSize = 0;
      config.supabase.serviceRoleKey = '';

      expect(() => validateConfig(config)).toThrow();

      try {
        validateConfig(config);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        expect(message).toContain('timeout');
        expect(message).toContain('maxBatchSize');
        expect(message).toContain('supabase');
      }
    });
  });

  describe('validateConfigDetailed', () => {
    it('should return valid result for valid configuration', () => {
      // Get a fresh config
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.USER_SERVICE_URL = 'http://test.com';
      process.env.USER_SERVICE_API_KEY = 'test-user-key';
      
      const config = loadConfig();
      const result = validateConfigDetailed(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return detailed errors for invalid configuration', () => {
      const config = loadConfig();
      config.timeout = -1000;
      config.maxBatchSize = 0;

      const result = validateConfigDetailed(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.field.includes('timeout'))).toBe(true);
      expect(result.errors.some((e) => e.field.includes('maxBatchSize'))).toBe(true);
    });

    it('should include field names in errors', () => {
      const config = loadConfig();
      config.models = [];
      config.roles = [];

      const result = validateConfigDetailed(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'models')).toBe(true);
      expect(result.errors.some((e) => e.field === 'roles')).toBe(true);
    });
  });
});
