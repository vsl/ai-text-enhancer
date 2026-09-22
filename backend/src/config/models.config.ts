/**
 * Models Configuration
 * 
 * Defines all available LLM models with their metadata, pricing,
 * and tier requirements. This is the single source of truth for
 * model definitions.
 */

import type { ModelConfig } from '../types/config.types.ts';
import type { UserTier } from '../types/auth.types.ts';

/**
 * All available models with tier access control
 * 
 * OpenRouter's free router selects a currently available free model.
 */
export const MODELS: readonly ModelConfig[] = [
  // ========================================
  // OpenRouter models
  // ========================================
  {
    id: 'open-router-free',
    provider: 'openrouter',
    providerModelId: 'openrouter/free',
    structuredOutputMode: 'json-schema',
    allowedTiers: ['free', 'plus', 'premium'],
    displayName: 'OpenRouter Free',
    contextWindow: 200000,
    costPer1kTokens: {
      input: 0.00,
      output: 0.00,
    },
  },
  {
    id: 'openai-gpt-5-nano',
    provider: 'openrouter',
    providerModelId: 'openai/gpt-5-nano',
    structuredOutputMode: 'json-schema',
    allowedTiers: ['free', 'plus', 'premium'],
    displayName: 'GPT-5 Nano',
    contextWindow: 400000,
    costPer1kTokens: {
      input: 0.00005,
      output: 0.0004,
    },
  },
] as const;

/**
 * Get model configuration by ID
 * @param modelId - The public model identifier
 * @returns Model configuration or null if not found
 */
export function getModelById(modelId: string): ModelConfig | null {
  return MODELS.find((m) => m.id === modelId) ?? null;
}

/**
 * Get models by provider
 * @param provider - Provider name
 * @returns Array of models for the provider
 */
export function getModelsByProvider(provider: string): ModelConfig[] {
  return MODELS.filter((m) => m.provider === provider);
}

/**
 * Get models by tier
 * @param tier - User tier
 * @returns Array of models accessible to the tier
 */
export function getModelsByTier(tier: UserTier): ModelConfig[] {
  return MODELS.filter((m) => m.allowedTiers.includes(tier));
}
