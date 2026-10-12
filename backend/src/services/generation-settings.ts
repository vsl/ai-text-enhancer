import { RUNTIME_DEFAULTS } from '../config/runtime.config.ts';
import { getLimitsForTier } from '../config/tier-limits.config.ts';
import type { UserTier } from '../types/auth.types.ts';
import type { ModelConfig } from '../types/config.types.ts';
import type { LLMRequestParams } from '../types/llm.types.ts';

export type GenerationSettings = Pick<LLMRequestParams,
  'structuredOutputMode' | 'serviceTier' | 'reasoningEffort' | 'reasoningEnabled' | 'temperature' | 'maxTokens' | 'timeout'>;

export function generationSettings(
  model: Pick<ModelConfig, 'structuredOutputMode' | 'serviceTier' | 'reasoningEffort' | 'reasoningEnabled'>,
  tier: UserTier = RUNTIME_DEFAULTS.tier,
  timeout: number = RUNTIME_DEFAULTS.timeoutMs,
): GenerationSettings {
  return {
    structuredOutputMode: model.structuredOutputMode,
    serviceTier: model.serviceTier,
    reasoningEffort: model.reasoningEffort,
    ...(model.reasoningEnabled !== undefined && { reasoningEnabled: model.reasoningEnabled }),
    maxTokens: getLimitsForTier(tier).maxTokensPerRequest,
    timeout,
  };
}
