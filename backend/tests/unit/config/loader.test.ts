/**
 * Configuration Loader Tests
 */

import { loadConfig, loadPaymentConfig, getEnvVar, hasRequiredEnvVars } from '../../../src/config/loader';

describe('Configuration Loader', () => {
  // Store original environment
  const originalEnv = { ...process.env };

  // Helper to set up required env vars
  const setupRequiredEnv = (overrides: Record<string, string> = {}) => {
    const defaults = {
      OPENROUTER_API_KEY: 'test-openrouter-key',
      SUPABASE_URL: 'http://localhost:54321',
      APP_SUPABASE_SERVICE_ROLE_KEY: 'test-supabase-key',
    };
    Object.assign(process.env, { ...defaults, ...overrides });
  };

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };

    // Clear all config-related env vars
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.BOOTSTRAP_SECRET_KEY;
    delete process.env.LM_STUDIO_BASE_URL;
    delete process.env.LLM_TIMEOUT_MS;
    delete process.env.MAX_BATCH_SIZE;
    delete process.env.JEV_MODEL_ID;
    delete process.env.JEV_TIMEOUT_MS;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PUBLISHABLE_KEY;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should throw error when OPENROUTER_API_KEY is missing', () => {
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.APP_SUPABASE_SERVICE_ROLE_KEY = 'test-supabase-key';

      expect(() => loadConfig()).toThrow('OPENROUTER_API_KEY');
    });

    it('should throw error when APP_SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      expect(() => loadConfig()).toThrow('APP_SUPABASE_SERVICE_ROLE_KEY');
    });

    it('should throw error when multiple required variables are missing', () => {
      process.env.SUPABASE_URL = 'http://localhost:54321';

      expect(() => loadConfig()).toThrow('OPENROUTER_API_KEY');
    });

    it('should load valid configuration with all required variables', () => {
      setupRequiredEnv();

      const config = loadConfig();

      expect(config.llmProviders).toHaveLength(1);
      expect(config.models.length).toBeGreaterThan(0);
      expect(config.roles.length).toBe(3);
      expect(config.supabase.serviceRoleKey).toBe('test-supabase-key');
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

    it('loads safe Jev defaults and optional overrides', () => {
      setupRequiredEnv();
      expect(loadConfig().jev).toEqual({ modelId: 'typesafe/jev-1.13', timeoutMs: 5000 });

      process.env.JEV_MODEL_ID = 'typesafe/jev-custom';
      process.env.JEV_TIMEOUT_MS = '8000';
      expect(loadConfig().jev).toEqual({ modelId: 'typesafe/jev-custom', timeoutMs: 8000 });
    });

    it('rejects an invalid Jev timeout', () => {
      setupRequiredEnv({ JEV_TIMEOUT_MS: 'invalid' });
      expect(() => loadConfig()).toThrow('JEV_TIMEOUT_MS must be a positive number');
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

    it('should include the OpenRouter provider', () => {
      setupRequiredEnv();

      const config = loadConfig();
      const providerNames = config.llmProviders.map((p) => p.name);

      expect(providerNames).toContain('openrouter');
      expect(providerNames).toHaveLength(1);
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
      expect(config.rateLimits.free.maxTokensPerRequest).toBe(3500);
      expect(config.rateLimits.free.maxTokensPerDay).toBe(50000);
      
      // Plus tier token limits
      expect(config.rateLimits.plus.maxTokensPerRequest).toBe(4096);
      expect(config.rateLimits.plus.maxTokensPerDay).toBe(500000);
      
      // Premium tier token limits
      expect(config.rateLimits.premium.maxTokensPerRequest).toBe(8192);
      expect(config.rateLimits.premium.maxTokensPerDay).toBe(5000000);
    });
  });

  describe('loadPaymentConfig', () => {
    it('loads dormant payment configuration separately', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock';

      expect(loadPaymentConfig()).toEqual({
        stripeSecretKey: 'sk_test_mock',
        stripeWebhookSecret: 'whsec_mock',
        stripePublishableKey: 'pk_test_mock',
      });
    });

    it('requires payment variables only when payment configuration is loaded', () => {
      setupRequiredEnv();
      expect(loadConfig()).toBeDefined();
      expect(() => loadPaymentConfig()).toThrow('STRIPE_SECRET_KEY');
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
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      // Missing APP_SUPABASE_SERVICE_ROLE_KEY

      expect(hasRequiredEnvVars()).toBe(false);
    });

    it('should return true when all required variables are present', () => {
      setupRequiredEnv();

      expect(hasRequiredEnvVars()).toBe(true);
    });
  });
});
