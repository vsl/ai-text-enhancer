/**
 * Configuration Loader
 * 
 * Loads and assembles complete system configuration from environment
 * variables and static configuration files. Platform-agnostic implementation
 * using standard process.env.
 */

import type { SystemConfig, LLMProviderConfig, PaymentConfig } from '../types/config.types.ts';
import { MODELS, getModelsByProvider } from './models.config.ts';
import { ROLES } from './roles.config.ts';
import { TIER_LIMITS } from './tier-limits.config.ts';

/**
 * Load complete system configuration
 * @returns Complete system configuration
 * @throws Error if required environment variables are missing
 */
export function loadConfig(): SystemConfig {
  // 1. Read environment variables
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  // Supabase configuration (using APP_ prefix to avoid Edge Functions restriction)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;

  // Optional bootstrap secret for admin user creation
  const bootstrapSecretKey = process.env.BOOTSTRAP_SECRET_KEY;

  // 2. Validate required variables
  const missingVars: string[] = [];
  if (!openrouterApiKey) missingVars.push('OPENROUTER_API_KEY');
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!supabaseServiceRoleKey) missingVars.push('APP_SUPABASE_SERVICE_ROLE_KEY');
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      'Please ensure all required environment variables are set. ' +
      'See .env.example for reference.'
    );
  }

  // 3. Build provider configurations
  const llmProviders: LLMProviderConfig[] = [
    {
      name: 'openrouter',
      apiKey: openrouterApiKey!,
      models: getModelsByProvider('openrouter'),
    },
  ];

  // 4. Parse optional configuration values
  const timeout = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);
  const maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE || '10', 10);
  const jevTimeoutMs = parseInt(process.env.JEV_TIMEOUT_MS || '5000', 10);
  const exposeErrorDetails = process.env.EXPOSE_ERROR_DETAILS === 'true';

  // 5. Validate parsed values
  if (isNaN(timeout) || timeout <= 0) {
    throw new Error('LLM_TIMEOUT_MS must be a positive number');
  }
  if (isNaN(maxBatchSize) || maxBatchSize <= 0 || maxBatchSize > 100) {
    throw new Error('MAX_BATCH_SIZE must be a positive number between 1 and 100');
  }
  if (isNaN(jevTimeoutMs) || jevTimeoutMs <= 0) {
    throw new Error('JEV_TIMEOUT_MS must be a positive number.');
  }

  // 6. Return complete configuration
  return {
    llmProviders,
    supabase: {
      url: supabaseUrl!,
      serviceRoleKey: supabaseServiceRoleKey!,
    },
    bootstrapSecretKey: bootstrapSecretKey,
    rateLimits: {
      free: {
        requestsPerDay: 100,
        requestsPerHour: 20,
        maxTokensPerRequest: TIER_LIMITS.free.maxTokensPerRequest,
        maxTokensPerDay: 50000,         // 50K tokens per day
      },
      plus: {
        requestsPerDay: 1000,
        requestsPerHour: 100,
        maxTokensPerRequest: TIER_LIMITS.plus.maxTokensPerRequest,
        maxTokensPerDay: 500000,        // 500K tokens per day
      },
      premium: {
        requestsPerDay: 10000,
        requestsPerHour: 1000,
        maxTokensPerRequest: TIER_LIMITS.premium.maxTokensPerRequest,
        maxTokensPerDay: 5000000,       // 5M tokens per day
      },
    },
    timeout,
    maxBatchSize,
    exposeErrorDetails,
    jev: {
      modelId: process.env.JEV_MODEL_ID || 'typesafe/jev-1.13',
      timeoutMs: jevTimeoutMs,
    },
    // Return deep copies to prevent mutation of original config
    models: MODELS.map((m) => ({ ...m, costPer1kTokens: { ...m.costPer1kTokens } })),
    roles: ROLES.map((r) => ({ ...r, allowedModels: [...r.allowedModels] })),
  };
}

/** Load configuration used only by the dormant payment functions. */
export function loadPaymentConfig(): PaymentConfig {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const missingVars = [
    ['STRIPE_SECRET_KEY', stripeSecretKey],
    ['STRIPE_WEBHOOK_SECRET', stripeWebhookSecret],
    ['STRIPE_PUBLISHABLE_KEY', stripePublishableKey],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missingVars.length > 0) {
    throw new Error(`Missing required payment environment variables: ${missingVars.join(', ')}`);
  }

  return {
    stripeSecretKey: stripeSecretKey!,
    stripeWebhookSecret: stripeWebhookSecret!,
    stripePublishableKey: stripePublishableKey!,
  };
}

/**
 * Get environment variable value
 * @param key - Environment variable key
 * @returns Value or undefined if not set
 */
export function getEnvVar(key: string): string | undefined {
  return process.env[key];
}

/**
 * Check if all required environment variables are set
 * @returns True if all required variables are present
 */
export function hasRequiredEnvVars(): boolean {
  const required = [
    'OPENROUTER_API_KEY',
    'SUPABASE_URL',
    'APP_SUPABASE_SERVICE_ROLE_KEY',
  ];

  return required.every((key) => !!process.env[key]);
}
