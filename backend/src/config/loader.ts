/**
 * Configuration Loader
 * 
 * Loads and assembles complete system configuration from environment
 * variables and static configuration files. Platform-agnostic implementation
 * using standard process.env.
 */

import type { SystemConfig, LLMProviderConfig } from '../types/config.types.ts';
import { MODELS, getModelsByProvider } from './models.config.ts';
import { ROLES } from './roles.config.ts';

/**
 * Load complete system configuration
 * @returns Complete system configuration
 * @throws Error if required environment variables are missing
 */
export function loadConfig(): SystemConfig {
  // 1. Read environment variables
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  // Supabase configuration (using APP_ prefix to avoid Edge Functions restriction)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
  const supabaseJwtSecret = process.env.APP_SUPABASE_JWT_SECRET;

  // Payment system configuration (Stripe)
  /** Stripe secret key for API authentication */
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  /** Stripe webhook signing secret for event verification */
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  /** Stripe publishable key (safe to expose to frontend) */
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  // Optional bootstrap secret for admin user creation
  const bootstrapSecretKey = process.env.BOOTSTRAP_SECRET_KEY;

  // 2. Validate required variables
  const missingVars: string[] = [];
  if (!geminiApiKey) missingVars.push('GEMINI_API_KEY');
  if (!openrouterApiKey) missingVars.push('OPENROUTER_API_KEY');
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!supabaseServiceRoleKey) missingVars.push('APP_SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseJwtSecret) missingVars.push('APP_SUPABASE_JWT_SECRET');
  if (!stripeSecretKey) missingVars.push('STRIPE_SECRET_KEY');
  if (!stripeWebhookSecret) missingVars.push('STRIPE_WEBHOOK_SECRET');
  if (!stripePublishableKey) missingVars.push('STRIPE_PUBLISHABLE_KEY');

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
      name: 'gemini',
      apiKey: geminiApiKey!,
      models: getModelsByProvider('gemini'),
    },
    {
      name: 'openrouter',
      apiKey: openrouterApiKey!,
      models: getModelsByProvider('openrouter'),
    },
    {
      name: 'lmstudio',
      apiKey: '', // LM Studio doesn't require API key
      baseUrl: process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234',
      models: getModelsByProvider('lmstudio'),
    },
  ];

  // 4. Parse optional configuration values
  const timeout = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);
  const maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE || '10', 10);
  const exposeErrorDetails = process.env.EXPOSE_ERROR_DETAILS === 'true';

  // 5. Validate parsed values
  if (isNaN(timeout) || timeout <= 0) {
    throw new Error('LLM_TIMEOUT_MS must be a positive number');
  }
  if (isNaN(maxBatchSize) || maxBatchSize <= 0 || maxBatchSize > 100) {
    throw new Error('MAX_BATCH_SIZE must be a positive number between 1 and 100');
  }

  // 6. Return complete configuration
  return {
    llmProviders,
    supabase: {
      url: supabaseUrl!,
      serviceRoleKey: supabaseServiceRoleKey!,
      jwtSecret: supabaseJwtSecret!,
    },
    payment: {
      stripeSecretKey: stripeSecretKey!,
      stripeWebhookSecret: stripeWebhookSecret!,
      stripePublishableKey: stripePublishableKey!,
    },
    bootstrapSecretKey: bootstrapSecretKey,
    rateLimits: {
      free: {
        requestsPerDay: 100,
        requestsPerHour: 20,
        maxTokensPerRequest: 2048,     // 2K tokens per request
        maxTokensPerDay: 50000,         // 50K tokens per day
      },
      plus: {
        requestsPerDay: 1000,
        requestsPerHour: 100,
        maxTokensPerRequest: 4096,      // 4K tokens per request
        maxTokensPerDay: 500000,        // 500K tokens per day
      },
      premium: {
        requestsPerDay: 10000,
        requestsPerHour: 1000,
        maxTokensPerRequest: 8192,      // 8K tokens per request
        maxTokensPerDay: 5000000,       // 5M tokens per day
      },
    },
    timeout,
    maxBatchSize,
    exposeErrorDetails,
    // Return deep copies to prevent mutation of original config
    models: MODELS.map((m) => ({ ...m, costPer1kTokens: { ...m.costPer1kTokens } })),
    roles: ROLES.map((r) => ({ ...r, allowedModels: [...r.allowedModels] })),
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
    'GEMINI_API_KEY',
    'OPENROUTER_API_KEY',
    'SUPABASE_URL',
    'APP_SUPABASE_SERVICE_ROLE_KEY',
    'APP_SUPABASE_JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PUBLISHABLE_KEY',
  ];

  return required.every((key) => !!process.env[key]);
}
