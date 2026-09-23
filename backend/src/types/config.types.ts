/**
 * Configuration Type Definitions
 * 
 * Platform-agnostic configuration interfaces for the AI Text Enhancer Backend.
 * These types define the structure of all configuration data including models,
 * roles, providers, and system settings.
 */

/**
 * Complete system configuration
 */
export interface SystemConfig {
  /** LLM provider configurations */
  llmProviders: LLMProviderConfig[];

  /** Supabase configuration */
  supabase: SupabaseConfig;

  /** Optional bootstrap secret key for admin user creation */
  bootstrapSecretKey?: string;

  /** Rate limiting configuration by tier */
  rateLimits: RateLimitConfig;

  /** Request timeout in milliseconds */
  timeout: number;

  /** Maximum number of assistants per batch request */
  maxBatchSize: number;

  /** All available models */
  models: ModelConfig[];

  /** All available AI roles */
  roles: RoleConfig[];

  /** Whether to expose detailed error messages in API responses */
  exposeErrorDetails: boolean;
}

/**
 * LLM Provider configuration
 */
export interface LLMProviderConfig {
  /** Provider name (gemini, openrouter, lmstudio) */
  name: string;
  
  /** API key for authentication (empty for local providers) */
  apiKey: string;
  
  /** Optional base URL override */
  baseUrl?: string;
  
  /** Models available from this provider */
  models: ModelConfig[];
}

export type StructuredOutputMode = 'json-schema' | 'json-object';

/**
 * Model configuration
 */
export interface ModelConfig {
  /** Public-facing model identifier */
  id: string;
  
  /** Provider name */
  provider: string;
  
  /** Provider-specific model identifier */
  providerModelId: string;

  /** Structured-output feature verified for this provider/model pair */
  structuredOutputMode: StructuredOutputMode;
  
  /** User tiers that can access this model */
  allowedTiers: ('free' | 'plus' | 'premium')[];
  
  /** Human-readable display name */
  displayName: string;
  
  /** Token context window size */
  contextWindow: number;
  
  /** Cost per 1000 tokens */
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

/**
 * AI Role configuration
 */
export interface RoleConfig {
  /** Unique role identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** System prompt describing the role */
  systemPrompt: string;
  
  /** Model IDs allowed for this role */
  allowedModels: string[];
}

/**
 * Supabase configuration
 */
export interface SupabaseConfig {
  /** Supabase project URL */
  url: string;

  /** Supabase service role key (for server-side operations) */
  serviceRoleKey: string;

}

/**
 * Payment system configuration
 */
export interface PaymentConfig {
  /** Stripe secret key for API authentication */
  stripeSecretKey: string;

  /** Stripe webhook signing secret for event verification */
  stripeWebhookSecret: string;

  /** Stripe publishable key (safe to expose to frontend) */
  stripePublishableKey: string;
}

/**
 * @deprecated Use SupabaseConfig instead
 * User Service configuration (legacy)
 */
export interface UserServiceConfig {
  /** Base URL for user service API */
  url: string;

  /** API key for user service authentication */
  apiKey: string;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  free: TierLimits;
  plus: TierLimits;
  premium: TierLimits;
}

/**
 * Tier-specific rate limits
 */
export interface TierLimits {
  /** Maximum requests per day */
  requestsPerDay: number;
  
  /** Maximum requests per hour */
  requestsPerHour: number;
  
  /** Maximum tokens per request */
  maxTokensPerRequest: number;
  
  /** Maximum tokens per day */
  maxTokensPerDay: number;
}

/**
 * Environment variables interface
 */
export interface EnvironmentConfig {
  /** OpenRouter API key */
  OPENROUTER_API_KEY: string;

  /** Supabase project URL */
  SUPABASE_URL: string;

  /** Supabase service role key */
  APP_SUPABASE_SERVICE_ROLE_KEY: string;
  /** Optional: Bootstrap secret key for admin user creation */
  BOOTSTRAP_SECRET_KEY?: string;

  /** Optional: LM Studio base URL */
  LM_STUDIO_BASE_URL?: string;

  /** Optional: LLM request timeout in milliseconds */
  LLM_TIMEOUT_MS?: string;

  /** Optional: Maximum batch size */
  MAX_BATCH_SIZE?: string;

  /** Optional: Whether to expose detailed error messages (true/false) */
  EXPOSE_ERROR_DETAILS?: string;
}
