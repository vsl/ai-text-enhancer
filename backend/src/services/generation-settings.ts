import { getLimitsForTier } from '../config/tier-limits.config.ts';
import type { UserTier } from '../types/auth.types.ts';
import type { ModelConfig } from '../types/config.types.ts';
import type { LLMRequestParams } from '../types/llm.types.ts';

export type GenerationSettings = Pick<LLMRequestParams,
  'structuredOutputMode' | 'serviceTier' | 'reasoningEffort' | 'temperature' | 'maxTokens' | 'timeout'>;

export function generationSettings(
  model: Pick<ModelConfig, 'structuredOutputMode' | 'serviceTier' | 'reasoningEffort'>,
  tier: UserTier = 'free',
  timeout = 30000,
): GenerationSettings {
  return {
    structuredOutputMode: model.structuredOutputMode,
    serviceTier: model.serviceTier,
    reasoningEffort: model.reasoningEffort,
    maxTokens: getLimitsForTier(tier).maxTokensPerRequest,
    timeout,
  };
}
