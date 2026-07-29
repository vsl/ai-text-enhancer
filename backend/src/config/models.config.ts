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
 * NOTE: For open-router-free model, check latest free model at:
 * https://openrouter.ai/models?fmt=cards&input_modalities=text&max_price=0&order=top-weekly
 */
export const MODELS: readonly ModelConfig[] = [
  // ========================================
  // FREE TIER MODELS
  // ========================================
  {
    id: 'gemini-flash',
    provider: 'gemini',
    providerModelId: 'gemini-2.5-flash',
    allowedTiers: ['free', 'plus', 'premium'],
    displayName: 'Gemini 2.5 Flash',
    contextWindow: 1000000,
    costPer1kTokens: {
      input: 0.00,
      output: 0.00,
    },
  },
  {
    id: 'open-router-free',
    provider: 'openrouter',
    providerModelId: 'microsoft/mai-ds-r1:free',
    allowedTiers: ['free', 'plus', 'premium'],
    displayName: 'Free Model (OpenRouter)',
    contextWindow: 1000000,
    costPer1kTokens: {
      input: 0.00,
      output: 0.00,
    },
  },
  {
    id: 'local-debug-model',
    provider: 'lmstudio',
    providerModelId: 'google/gemma-3-12b',
    allowedTiers: ['free', 'plus', 'premium'],
    displayName: 'Local Debug Model (LM Studio)',
    contextWindow: 8192,
    costPer1kTokens: {
      input: 0.00,
      output: 0.00,
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
