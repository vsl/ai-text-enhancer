import type { AiConfig, Options, Workflow } from './types';
import { AVAILABLE_AI_ROLES, AVAILABLE_MODELS, FORMALITY, TONES, LANGUAGE_LEVELS, LANGUAGES } from '@/config/catalog.config';
import { DEFAULT_ASSISTANT, DEFAULT_OPTIONS } from '@/config/workflows.config';

/** Reject malformed storage at the boundary; only the current schema is supported. */
export function parseStoredWorkflows(value: unknown): Workflow[] {
  if (!Array.isArray(value)) throw new Error('Stored workflows must be an array');
  const names = new Set<string>();
  return value.map(workflow => {
    if (!isRecord(workflow) || typeof workflow.name !== 'string' || !workflow.name.trim()
      || !Array.isArray(workflow.configs) || names.has(workflow.name.trim().toLowerCase())) {
      throw new Error('Invalid stored workflow');
    }
    names.add(workflow.name.trim().toLowerCase());
    const ids = new Set<number>();
    const configs = workflow.configs.map(config => {
      if (!isRecord(config) || !Number.isSafeInteger(config.id) || ids.has(config.id as number)
        || typeof config.model !== 'string' || typeof config.aiRoleId !== 'string'
        || !isRecord(config.options) || typeof config.enabled !== 'boolean') {
        throw new Error('Invalid stored assistant');
      }
      ids.add(config.id as number);
      return normalizeAiConfig(config as unknown as AiConfig);
    });
    return { name: workflow.name, configs };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeAiConfig(
  config: Partial<AiConfig> & Pick<AiConfig, 'id'>
): AiConfig {
  const aiRoleId = AVAILABLE_AI_ROLES.some((role) => role.id === config.aiRoleId)
    ? config.aiRoleId!
    : DEFAULT_ASSISTANT.aiRoleId;
  const stored: Partial<Options> = config.options || {};
  const shorten = typeof stored.shorten === 'boolean' ? stored.shorten : DEFAULT_OPTIONS.shorten;
  const lengthen = !shorten && typeof stored.lengthen === 'boolean' ? stored.lengthen : false;

  return {
    id: config.id,
    model: typeof config.model === 'string' && AVAILABLE_MODELS.includes(config.model as typeof AVAILABLE_MODELS[number])
      ? config.model
      : DEFAULT_ASSISTANT.model,
    aiRoleId,
    options: {
      improve: typeof stored.improve === 'boolean' ? stored.improve : DEFAULT_OPTIONS.improve,
      fixMistakes: typeof stored.fixMistakes === 'boolean' ? stored.fixMistakes : DEFAULT_OPTIONS.fixMistakes,
      format: typeof stored.format === 'boolean' ? stored.format : DEFAULT_OPTIONS.format,
      shorten,
      lengthen,
      addEmojis: typeof stored.addEmojis === 'boolean' ? stored.addEmojis : DEFAULT_OPTIONS.addEmojis,
      avoidCommonAiSymbols: typeof stored.avoidCommonAiSymbols === 'boolean' ? stored.avoidCommonAiSymbols : DEFAULT_OPTIONS.avoidCommonAiSymbols,
      formality: FORMALITY.includes(stored.formality as Options['formality'])
        ? stored.formality as Options['formality']
        : DEFAULT_OPTIONS.formality,
      tone: TONES.includes(stored.tone as Options['tone'])
        ? stored.tone as Options['tone']
        : DEFAULT_OPTIONS.tone,
      languageLevel: LANGUAGE_LEVELS.some(level => level.value === stored.languageLevel)
        ? stored.languageLevel as Options['languageLevel']
        : DEFAULT_OPTIONS.languageLevel,
      translateTo: LANGUAGES.some(language => language.code === stored.translateTo)
        ? stored.translateTo as Options['translateTo']
        : DEFAULT_OPTIONS.translateTo,
    },
    enabled: config.enabled ?? DEFAULT_ASSISTANT.enabled,
  };
}

/** Clone policy defaults so each assistant owns its editable options. */
export function createDefaultAssistant(id: number): AiConfig {
  return { id, ...DEFAULT_ASSISTANT, options: { ...DEFAULT_ASSISTANT.options } };
}
