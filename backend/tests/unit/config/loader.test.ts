/**
 * Configuration Loader Tests
 */

import { loadConfig, loadPaymentConfig, getEnvVar } from '../../../src/config/loader';

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
    delete process.env.EXPOSE_ERROR_DETAILS;
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
      expect(config.roles.length).toBe(2);
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

  });

  it.each(['30000ms', '1.5', '1e4', ' 30000 ', '9007199254740992'])('rejects malformed timeout %s', value => {
    setupRequiredEnv({ LLM_TIMEOUT_MS: value });
    expect(() => loadConfig()).toThrow('LLM_TIMEOUT_MS');
  });

  it('rejects invalid booleans instead of silently disabling a flag', () => {
    setupRequiredEnv({ EXPOSE_ERROR_DETAILS: 'yes' });
    expect(() => loadConfig()).toThrow('EXPOSE_ERROR_DETAILS must be true or false');
  });

  it('keeps provider and system catalogs independent across loads', () => {
    setupRequiredEnv();
    const config = loadConfig();
    config.llmProviders[0].models[0].allowedTiers.length = 0;
    config.models[0].costPer1kTokens.input = -1;
    config.roles[0].allowedModels.length = 0;
    const next = loadConfig();
    expect(next.llmProviders[0].models[0].allowedTiers.length).toBeGreaterThan(0);
    expect(next.models[0].costPer1kTokens.input).toBeGreaterThanOrEqual(0);
    expect(next.roles[0].allowedModels.length).toBeGreaterThan(0);
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

});
