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
    id: 'openai-gpt-5-nano',
    provider: 'openrouter',
    providerModelId: 'openai/gpt-5-nano',
    structuredOutputMode: 'json-schema',
    serviceTier: 'flex',
    reasoningEffort: 'minimal',
    allowedTiers: ['free', 'plus', 'premium'],
    displayName: 'GPT-5 Nano',
    contextWindow: 400000,
    costPer1kTokens: {
      input: 0.00005,
      output: 0.0004,
    },
  },
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
    id: 'qwen-qwen3-30b-a3b-instruct-2507',
    provider: 'openrouter',
    providerModelId: 'qwen/qwen3-30b-a3b-instruct-2507',
    structuredOutputMode: 'json-schema',
    allowedTiers: ['free', 'plus', 'premium'],
    displayName: 'Qwen3 30B A3B Instruct 2507',
    contextWindow: 262144,
    costPer1kTokens: {
      input: 0.00004815,
      output: 0.0001931,
    },
  },
  {
    id: 'openai-gpt-6-luna',
    provider: 'openrouter',
    providerModelId: 'openai/gpt-6-luna',
    structuredOutputMode: 'json-schema',
    reasoningEffort: 'none',
    allowedTiers: ['free', 'plus', 'premium'],
    displayName: 'GPT-6 Luna',
    contextWindow: 1050000,
    costPer1kTokens: {
      input: 0.0001,
      output: 0.0005,
    },
  },
  {
    id: 'anthropic-claude-haiku-5.5',
    provider: 'openrouter',
    providerModelId: 'anthropic/claude-haiku-5.5',
    structuredOutputMode: 'json-schema',
    reasoningEffort: 'low',
    reasoningEnabled: false,
    allowedTiers: ['free', 'plus', 'premium'],
    displayName: 'Claude Haiku 5.5',
    contextWindow: 1000000,
    costPer1kTokens: {
      input: 0.0001,
      output: 0.0005,
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
