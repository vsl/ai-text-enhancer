import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AVAILABLE_AI_ROLES, AVAILABLE_MODELS, FORMALITY, LANGUAGES, LANGUAGE_LEVELS, MODEL_NAMES, OPTIONS_CHECKBOXES, TIER_LIMITS, TONES } from '@/config/catalog.config';
import { DEFAULT_OPTIONS, DEFAULT_WORKFLOWS } from '@/config/workflows.config';
import { normalizeAiConfig } from '@/lib/workflow-config';
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
  it('documents the AI-symbol preference in the root README', () => {
    const readme = readFileSync(resolve(__dirname, '../../../README.md'), 'utf8');
    expect(readme).toContain('**Avoid common AI symbols**');
    expect(readme).toContain('enabled by default in the UI and configurable per assistant');
    expect(readme).toContain('prompt-level preference');
    expect(readme).toContain('not post-processed or mechanically stripped');
    expect(readme).toContain('not an AI detector');
  });

  it('keeps models, roles, tiers, and transformation values aligned', () => {
    expect([...AVAILABLE_MODELS].sort()).toEqual(MODELS.map(model => model.id).sort());
    expect(Object.keys(MODEL_NAMES).sort()).toEqual(MODELS.map(model => model.id).sort());
    expect(MODEL_NAMES).toMatchObject({
      'openai-gpt-5-nano': 'GPT-5 Nano',
      'qwen-qwen3-30b-a3b-instruct-2507': 'Qwen3 30B',
      'open-router-free': 'OpenRouter Free',
      'openai-gpt-6-luna': 'GPT-6 Luna',
      'anthropic-claude-haiku-5.5': 'Claude Haiku 5.5',
    });
    expect(AVAILABLE_MODELS[0]).toBe('qwen-qwen3-30b-a3b-instruct-2507');
    for (const workflow of DEFAULT_WORKFLOWS) {
      expect(workflow.configs).toHaveLength(3);
      expect(workflow.configs.map(config => config.model)).toEqual(['qwen-qwen3-30b-a3b-instruct-2507', 'openai-gpt-5-nano', 'open-router-free']);
      expect(new Set(workflow.configs.map(config => config.id)).size).toBe(3);
      expect(new Set(workflow.configs.map(config => JSON.stringify(config.options))).size).toBe(3);
      expect(workflow.configs.every(config => config.enabled)).toBe(true);
      expect(workflow.configs.every(config => config.aiRoleId === (workflow.name === 'Formal Email' ? 'email_assistant' : 'editor'))).toBe(true);
    }
    expect(TIER_LIMITS.free).toMatchObject({ maxTextLength: 1000, maxContextLength: 2500 });
    for (const role of ROLES) expect([...role.allowedModels].sort()).toEqual([...AVAILABLE_MODELS].sort());
    for (const model of ['openai-gpt-6-luna', 'anthropic-claude-haiku-5.5']) expect(normalizeAiConfig({ id: 1, model }).model).toBe(model);
    expect(AVAILABLE_AI_ROLES.map(role => role.id).sort()).toEqual(ROLES.map(role => role.id).sort());
    expect(AVAILABLE_AI_ROLES.map(role => role.id)).toEqual(['editor', 'email_assistant']);

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

  it('fills omitted options and preserves explicit disabled preferences', () => {
    expect(normalizeAiConfig({ id: 0 }).options.avoidCommonAiSymbols).toBe(true);
    expect(normalizeAiConfig({ id: 0, options: { ...DEFAULT_OPTIONS, avoidCommonAiSymbols: false } }).options.avoidCommonAiSymbols).toBe(false);
  });

  it('normalizes invalid current-schema values and conflicting options', () => {
    expect(normalizeAiConfig({
      id: 42, model: 'invalid-model', aiRoleId: 'invalid-role' as never,
      options: { ...DEFAULT_OPTIONS, shorten: true, lengthen: true }, enabled: false,
    })).toEqual({
      id: 42, model: AVAILABLE_MODELS[0], aiRoleId: 'editor',
      options: { ...DEFAULT_OPTIONS, shorten: true, lengthen: false }, enabled: false,
    });
  });
});
