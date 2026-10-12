import type { SystemConfig, PaymentConfig } from '../types/config.types.ts';
import { MODELS, getModelsByProvider } from './models.config.ts';
import { ROLES } from './roles.config.ts';
import { RUNTIME_DEFAULTS, RUNTIME_BOUNDS } from './runtime.config.ts';
import { booleanEnv, getEnvVar, integerEnv, requiredEnv } from './environment.ts';

export { getEnvVar } from './environment.ts';

/** Assemble production configuration without mutating the committed catalog. */
export function loadConfig(): SystemConfig {
  return {
    llmProviders: [{
      name: 'openrouter',
      apiKey: requiredEnv('OPENROUTER_API_KEY'),
      models: structuredClone(getModelsByProvider('openrouter')),
    }],
    supabase: loadSupabaseConfig(),
    timeout: integerEnv('LLM_TIMEOUT_MS', RUNTIME_DEFAULTS.timeoutMs,
      RUNTIME_BOUNDS.timeoutMs.min, RUNTIME_BOUNDS.timeoutMs.max),
    maxBatchSize: integerEnv('MAX_BATCH_SIZE', RUNTIME_DEFAULTS.maxBatchSize,
      RUNTIME_BOUNDS.maxBatchSize.min, RUNTIME_BOUNDS.maxBatchSize.max),
    exposeErrorDetails: booleanEnv('EXPOSE_ERROR_DETAILS', RUNTIME_DEFAULTS.exposeErrorDetails),
    jev: loadJevConfig(),
    models: structuredClone([...MODELS]),
    roles: structuredClone([...ROLES]),
  };
}

/** Profile/admin endpoints do not require an AI provider key. */
export function loadSupabaseConfig(): SystemConfig['supabase'] {
  return { url: requiredEnv('SUPABASE_URL'), serviceRoleKey: requiredEnv('APP_SUPABASE_SERVICE_ROLE_KEY') };
}

export function loadJevConfig(): SystemConfig['jev'] {
  return {
    modelId: getEnvVar('JEV_MODEL_ID')?.trim() || RUNTIME_DEFAULTS.jev.modelId,
    timeoutMs: integerEnv('JEV_TIMEOUT_MS', RUNTIME_DEFAULTS.jev.timeoutMs),
  };
}

/** Planned payment feature; never required by public demo endpoints. */
export function loadPaymentConfig(): PaymentConfig {
  return {
    stripeSecretKey: requiredEnv('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: requiredEnv('STRIPE_WEBHOOK_SECRET'),
    stripePublishableKey: requiredEnv('STRIPE_PUBLISHABLE_KEY'),
  };
}
