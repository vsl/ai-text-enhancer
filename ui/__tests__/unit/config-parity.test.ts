import {
  AVAILABLE_AI_ROLES,
  AVAILABLE_MODELS,
  DEFAULT_OPTIONS,
  DEFAULT_WORKFLOWS,
  FORMALITY,
  LANGUAGES,
  LANGUAGE_LEVELS,
  normalizeAiConfig,
  OPTIONS_CHECKBOXES,
  TIER_LIMITS,
  TONES,
} from '@/lib/constants';
import { MODELS } from '../../../backend/src/config/models.config';
import { ROLES } from '../../../backend/src/config/roles.config';
import { TIER_LIMITS as BACKEND_TIER_LIMITS } from '../../../backend/src/config/tier-limits.config';
import {
  BOOLEAN_TRANSFORMATION_KEYS,
  FORMALITY_VALUES,
  LANGUAGE_LEVEL_VALUES,
  LANGUAGE_VALUES,
  TONE_VALUES,
  TRANSFORMATION_OPTION_KEYS,
} from '../../../backend/src/config/transformation-options.config';

describe('UI/backend configuration parity', () => {
  it('keeps models, roles, tiers, and transformation values aligned', () => {
    expect([...AVAILABLE_MODELS].sort()).toEqual(MODELS.map(model => model.id).sort());
    expect(AVAILABLE_MODELS[0]).toBe('openai-gpt-5-nano');
    expect(DEFAULT_WORKFLOWS.every(workflow => workflow.configs.every(config => config.model === 'openai-gpt-5-nano'))).toBe(true);
    expect(TIER_LIMITS.free).toMatchObject({ maxTextLength: 1000, maxContextLength: 2500 });
    expect(AVAILABLE_AI_ROLES.map(role => role.id).sort()).toEqual(ROLES.map(role => role.id).sort());

    for (const tier of ['free', 'plus', 'premium'] as const) {
      expect(TIER_LIMITS[tier]).toEqual({
        maxTextLength: BACKEND_TIER_LIMITS[tier].maxUserTextLength,
        maxContextLength: BACKEND_TIER_LIMITS[tier].maxContextTextLength,
        maxBatchSize: BACKEND_TIER_LIMITS[tier].maxBatchSize,
        availableModels: MODELS.filter(model => model.allowedTiers.includes(tier)).map(model => model.id),
      });
    }

    expect(FORMALITY).toEqual(FORMALITY_VALUES);
    expect(TONES).toEqual(TONE_VALUES);
    expect(LANGUAGE_LEVELS.map(level => level.value || 'default')).toEqual(LANGUAGE_LEVEL_VALUES);
    expect(LANGUAGES.filter(language => language.code).map(language => language.code)).toEqual(LANGUAGE_VALUES);
    expect(Object.keys(OPTIONS_CHECKBOXES)).toEqual(BOOLEAN_TRANSFORMATION_KEYS);
    expect([
      ...Object.keys(OPTIONS_CHECKBOXES),
      'formality',
      'tone',
      'languageLevel',
      'translateTo',
    ]).toEqual(TRANSFORMATION_OPTION_KEYS);
    expect(MODELS.find(model => model.id === 'open-router-free')?.contextWindow).toBe(200000);
    expect(MODELS.find(model => model.id === 'openai-gpt-5-nano')?.contextWindow).toBe(400000);
    expect(MODELS.find(model => model.id === 'qwen-qwen3-30b-a3b-instruct-2507')?.contextWindow).toBe(262144);
  });

  it('migrates legacy roles and retired models safely', () => {
    expect(normalizeAiConfig({
      id: 1,
      model: 'local-debug-model',
      aiRole: 'Summarizer Assistant',
      options: {
        ...DEFAULT_OPTIONS,
        shorten: true,
        lengthen: true,
        formality: 'Professional',
        tone: 'Neutral',
        surprise: true,
      } as never,
    })).toEqual(expect.objectContaining({
      model: 'openai-gpt-5-nano',
      aiRoleId: 'summarizer',
      options: expect.objectContaining({
        shorten: true,
        lengthen: false,
        formality: 'Neutral',
        tone: 'Confident',
      }),
    }));

    expect(normalizeAiConfig({ id: 2, aiRole: 'Unknown role' })).toEqual(
      expect.objectContaining({ model: 'openai-gpt-5-nano', aiRoleId: 'editor' })
    );
  });
});
