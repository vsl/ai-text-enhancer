/**
 * Configuration Loader Tests
 */

import { loadConfig, getEnvVar, hasRequiredEnvVars } from '../../../src/config/loader';

describe('Configuration Loader', () => {
  // Store original environment
  const originalEnv = { ...process.env };

  // Helper to set up required env vars
  const setupRequiredEnv = (overrides: Record<string, string> = {}) => {
    const defaults = {
      GEMINI_API_KEY: 'test-gemini-key',
      OPENROUTER_API_KEY: 'test-openrouter-key',
      SUPABASE_URL: 'http://localhost:54321',
      APP_SUPABASE_SERVICE_ROLE_KEY: 'test-supabase-key',
      APP_SUPABASE_JWT_SECRET: 'test-jwt-secret',
      STRIPE_SECRET_KEY: 'sk_test_mock',
      STRIPE_WEBHOOK_SECRET: 'whsec_mock',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_mock',
    };
    Object.assign(process.env, { ...defaults, ...overrides });
  };

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };

    // Clear all config-related env vars
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.APP_SUPABASE_JWT_SECRET;
    delete process.env.BOOTSTRAP_SECRET_KEY;
    delete process.env.LM_STUDIO_BASE_URL;
    delete process.env.LLM_TIMEOUT_MS;
    delete process.env.MAX_BATCH_SIZE;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PUBLISHABLE_KEY;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should throw error when GEMINI_API_KEY is missing', () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.APP_SUPABASE_SERVICE_ROLE_KEY = 'test-supabase-key';
      process.env.APP_SUPABASE_JWT_SECRET = 'test-jwt-secret';

      expect(() => loadConfig()).toThrow('GEMINI_API_KEY');
    });

    it('should throw error when OPENROUTER_API_KEY is missing', () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.APP_SUPABASE_SERVICE_ROLE_KEY = 'test-supabase-key';
      process.env.APP_SUPABASE_JWT_SECRET = 'test-jwt-secret';

      expect(() => loadConfig()).toThrow('OPENROUTER_API_KEY');
    });

    it('should throw error when APP_SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.APP_SUPABASE_JWT_SECRET = 'test-jwt-secret';

      expect(() => loadConfig()).toThrow('APP_SUPABASE_SERVICE_ROLE_KEY');
    });

    it('should throw error when APP_SUPABASE_JWT_SECRET is missing', () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.APP_SUPABASE_SERVICE_ROLE_KEY = 'test-supabase-key';

      expect(() => loadConfig()).toThrow('APP_SUPABASE_JWT_SECRET');
    });

    it('should throw error when multiple required variables are missing', () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.SUPABASE_URL = 'http://localhost:54321';

      expect(() => loadConfig()).toThrow('OPENROUTER_API_KEY');
    });

    it('should load valid configuration with all required variables', () => {
      setupRequiredEnv();

      const config = loadConfig();

      expect(config.llmProviders).toHaveLength(3);
      expect(config.models.length).toBeGreaterThan(0);
      expect(config.roles.length).toBe(4);
      expect(config.supabase.serviceRoleKey).toBe('test-supabase-key');
      expect(config.supabase.jwtSecret).toBe('test-jwt-secret');
    });

    it('should use default timeout when not specified', () => {
      setupRequiredEnv();

      const config = loadConfig();
      expect(config.timeout).toBe(30000);
    });

    it('should use custom timeout when specified', () => {
      setupRequiredEnv({ LLM_TIMEOUT_MS: '60000' });

      const config = loadConfig();
      expect(config.timeout).toBe(60000);
    });

    it('should throw error for invalid timeout value', () => {
      setupRequiredEnv({ LLM_TIMEOUT_MS: 'invalid' });

      expect(() => loadConfig()).toThrow('LLM_TIMEOUT_MS must be a positive number');
    });

    it('should throw error for negative timeout', () => {
      setupRequiredEnv({ LLM_TIMEOUT_MS: '-1000' });

      expect(() => loadConfig()).toThrow('LLM_TIMEOUT_MS must be a positive number');
    });

    it('should use default max batch size when not specified', () => {
      setupRequiredEnv();

      const config = loadConfig();
      expect(config.maxBatchSize).toBe(10);
    });

    it('should use custom max batch size when specified', () => {
      setupRequiredEnv({ MAX_BATCH_SIZE: '20' });

      const config = loadConfig();
      expect(config.maxBatchSize).toBe(20);
    });

    it('should throw error for invalid max batch size', () => {
      setupRequiredEnv({ MAX_BATCH_SIZE: 'invalid' });

      expect(() => loadConfig()).toThrow('MAX_BATCH_SIZE must be a positive number');
    });

    it('should throw error for max batch size exceeding limit', () => {
      setupRequiredEnv({ MAX_BATCH_SIZE: '150' });

      expect(() => loadConfig()).toThrow('MAX_BATCH_SIZE must be a positive number between 1 and 100');
    });

    it('should use default LM Studio base URL when not specified', () => {
      setupRequiredEnv();

      const config = loadConfig();
      const lmStudioProvider = config.llmProviders.find((p) => p.name === 'lmstudio');

      expect(lmStudioProvider).toBeDefined();
      expect(lmStudioProvider?.baseUrl).toBe('http://localhost:1234');
    });

    it('should use custom LM Studio base URL when specified', () => {
      setupRequiredEnv({ LM_STUDIO_BASE_URL: 'http://custom:5678' });

      const config = loadConfig();
      const lmStudioProvider = config.llmProviders.find((p) => p.name === 'lmstudio');

      expect(lmStudioProvider?.baseUrl).toBe('http://custom:5678');
    });

    it('should include all three providers', () => {
      setupRequiredEnv();

      const config = loadConfig();
      const providerNames = config.llmProviders.map((p) => p.name);

      expect(providerNames).toContain('gemini');
      expect(providerNames).toContain('openrouter');
      expect(providerNames).toContain('lmstudio');
    });

    it('should include rate limits for all tiers', () => {
      setupRequiredEnv();

      const config = loadConfig();
      
      expect(config.rateLimits.free).toBeDefined();
      expect(config.rateLimits.plus).toBeDefined();
      expect(config.rateLimits.premium).toBeDefined();
      
      expect(config.rateLimits.free.requestsPerDay).toBe(100);
      expect(config.rateLimits.plus.requestsPerDay).toBe(1000);
      expect(config.rateLimits.premium.requestsPerDay).toBe(10000);
    });

    it('should include token limits for all tiers', () => {
      setupRequiredEnv();

      const config = loadConfig();
      
      // Free tier token limits
      expect(config.rateLimits.free.maxTokensPerRequest).toBe(2048);
      expect(config.rateLimits.free.maxTokensPerDay).toBe(50000);
      
      // Plus tier token limits
      expect(config.rateLimits.plus.maxTokensPerRequest).toBe(4096);
      expect(config.rateLimits.plus.maxTokensPerDay).toBe(500000);
      
      // Premium tier token limits
      expect(config.rateLimits.premium.maxTokensPerRequest).toBe(8192);
      expect(config.rateLimits.premium.maxTokensPerDay).toBe(5000000);
    });
  });

  describe('getEnvVar', () => {
    it('should return environment variable value', () => {
      process.env.TEST_VAR = 'test-value';
      expect(getEnvVar('TEST_VAR')).toBe('test-value');
    });

    it('should return undefined for non-existent variable', () => {
      expect(getEnvVar('NON_EXISTENT_VAR')).toBeUndefined();
    });
  });

  describe('hasRequiredEnvVars', () => {
    it('should return false when any required variable is missing', () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      // Missing APP_SUPABASE_SERVICE_ROLE_KEY and APP_SUPABASE_JWT_SECRET

      expect(hasRequiredEnvVars()).toBe(false);
    });

    it('should return true when all required variables are present', () => {
      setupRequiredEnv();

      expect(hasRequiredEnvVars()).toBe(true);
    });
  });
});
