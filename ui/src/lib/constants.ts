/**
 * Constants for the AI Text Enhancer application
 */

import { AiConfig, AiRoleId, Options, Workflow, Language, LanguageLevel, Tier, TierLimits } from './types';

export const AVAILABLE_MODELS = ['qwen-qwen3-30b-a3b-instruct-2507', 'openai-gpt-5-nano', 'open-router-free'] as const;

export const AVAILABLE_AI_ROLES: readonly { id: AiRoleId; label: string }[] = [
  { id: 'editor', label: 'General Assistant' },
  { id: 'summarizer', label: 'Summarizer Assistant' },
  { id: 'email_assistant', label: 'Professional Email Assistant' },
  { id: 'social_media_assistant', label: 'Social Media Assistant' },
] as const;

export const getAiRoleLabel = (id: AiRoleId): string =>
  AVAILABLE_AI_ROLES.find((role) => role.id === id)?.label ?? 'General Assistant';

export const TONES = [
  'Confident', 'Empathetic', 'Cheerful', 'Witty', 'Direct',
  'Engaging', 'Polite', 'Sincere', 'Disappointed', 'Apologetic',
  'Pessimistic', 'Worried'
] as const;

export const TONE_EMOJIS: Record<string, string> = {
  'Confident': '😎',
  'Empathetic': '🤗',
  'Cheerful': '😄',
  'Witty': '😉',
  'Direct': '🙂',
  'Engaging': '✨',
  'Polite': '😊',
  'Sincere': '🙏',
  'Disappointed': '😔',
  'Apologetic': '🥺',
  'Pessimistic': '😟',
  'Worried': '😥'
};

export const FORMALITY = ['Casual', 'Neutral', 'Formal'] as const;

export const FORMALITY_EMOJIS: Record<string, string> = {
  'Casual': '👋',
  'Neutral': '😐',
  'Formal': '🧐'
};

export const LANGUAGE_LEVELS: LanguageLevel[] = [
  { value: '', label: 'Default (No change)' },
  { value: 'simple', label: 'Simple' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'fluent', label: 'Fluent' },
  { value: 'native', label: 'Native / Expert' },
];

export const OPTIONS_CHECKBOXES = {
  improve: 'Improve',
  fixMistakes: 'Fix Mistakes',
  format: 'Format',
  shorten: 'Shorten',
  lengthen: 'Lengthen',
  addEmojis: 'Add Emojis',
};

export const LANGUAGES: Language[] = [
  { code: '', name: 'No Translation' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'es', name: 'Spanish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
];

export const TOOLTIP_TEXTS = {
  yourText: "This is the main text you want the AI to enhance or rewrite.",
  context: "Provide any background information here, like a previous email in a thread, to give the AI better context for its response.",
  aiPipelines: "Select a workflow to see its AI Assistants. Each assistant in the active workflow will run in parallel to process your text.",
  addConfig: "Add a new AI Assistant to the workflow below.",
  model: "Choose the underlying AI model. Different models have different capabilities and speeds.",
  aiRole: "The AI Role sets the AI's primary job or personality, like a Summarizer or a Professional Email Writer.",
  configOptions: "Fine-tune the behavior of the currently selected AI configuration from your pipeline.",
  improve: "Rewrites sentences for better clarity, flow, and engagement.",
  fixMistakes: "Corrects spelling, grammar, and punctuation errors.",
  format: "Applies formatting like lists and paragraphs for better readability.",
  shorten: "Condenses the text to be more concise while keeping the core message.",
  lengthen: "Expands on the original text to be more detailed or descriptive.",
  addEmojis: "Adds relevant emojis to make the text more expressive.",
  formality: "Adjusts the language to be casual, neutral, or professional.",
  tone: "Sets the emotional style of the writing (e.g., Confident, Witty, Polite).",
  level: "Adjusts the complexity of the language. When a translation is selected, this adjusts the translated text's level. Otherwise, it adjusts the original language.",
  translateTo: "Generates the final, enhanced text directly in the specified language.",
  applyWorkflow: "Select a saved workflow to apply its pipeline, or choose '+ Create New Workflow' to start from scratch.",
  saveWorkflow: "Save your entire AI pipeline and its configurations as a reusable workflow.",
  useThisText: "Copies this text to the 'Your Text' field to prepare for another enhancement."
};

export const ERROR_MESSAGES: Record<string, string> = {
  BATCH_SIZE_EXCEEDED: "Too many assistants selected. Please reduce the number of enabled assistants.",
  EMPTY_BATCH: "No assistants are enabled. Please enable at least one assistant.",
  AUTHENTICATION_FAILED: "Your session could not be restored. Please reload the page.",
  AUTHORIZATION_FAILED: "This feature is unavailable in the public demo.",
  NOT_FOUND: "Service is temporarily unavailable. Please try again later.",
  QUOTA_EXCEEDED: "You've reached this week's usage limit. It resets Monday at 00:00 UTC.",
  INTERNAL_ERROR: "A server error occurred. Please try again in a few moments.",
  LLM_ERROR: "The AI service is temporarily unavailable. Please try again."
};

export const DEFAULT_OPTIONS: Options = {
  improve: true,
  fixMistakes: true,
  format: false,
  shorten: false,
  lengthen: false,
  addEmojis: false,
  formality: 'Neutral',
  tone: 'Confident',
  languageLevel: '',
  translateTo: '',
};

const LEGACY_ROLE_IDS: Record<string, AiRoleId> = {
  'General Assistant': 'editor',
  'Summarizer Assistant': 'summarizer',
  'Professional Email Assistant': 'email_assistant',
  'Social Media Assistant': 'social_media_assistant',
};

export function normalizeAiConfig(
  config: Partial<AiConfig> & Pick<AiConfig, 'id'> & { aiRole?: string }
): AiConfig {
  const aiRoleId = AVAILABLE_AI_ROLES.some((role) => role.id === config.aiRoleId)
    ? config.aiRoleId!
    : LEGACY_ROLE_IDS[config.aiRole || ''] || 'editor';
  const stored: Partial<Options> = config.options || {};
  const shorten = typeof stored.shorten === 'boolean' ? stored.shorten : DEFAULT_OPTIONS.shorten;
  const lengthen = !shorten && typeof stored.lengthen === 'boolean' ? stored.lengthen : false;

  return {
    id: config.id,
    model: typeof config.model === 'string' && AVAILABLE_MODELS.includes(config.model as typeof AVAILABLE_MODELS[number])
      ? config.model
      : AVAILABLE_MODELS[0],
    aiRoleId,
    options: {
      improve: typeof stored.improve === 'boolean' ? stored.improve : DEFAULT_OPTIONS.improve,
      fixMistakes: typeof stored.fixMistakes === 'boolean' ? stored.fixMistakes : DEFAULT_OPTIONS.fixMistakes,
      format: typeof stored.format === 'boolean' ? stored.format : DEFAULT_OPTIONS.format,
      shorten,
      lengthen,
      addEmojis: typeof stored.addEmojis === 'boolean' ? stored.addEmojis : DEFAULT_OPTIONS.addEmojis,
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
    enabled: config.enabled ?? true,
  };
}

export const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    name: 'Quick Fix',
    configs: [{
      id: 1,
      model: 'qwen-qwen3-30b-a3b-instruct-2507',
      aiRoleId: 'editor',
      options: { ...DEFAULT_OPTIONS, improve: true, fixMistakes: true },
      enabled: true,
    }],
  },
  {
    name: 'Formal Email',
    configs: [{
      id: 1,
      model: 'qwen-qwen3-30b-a3b-instruct-2507',
      aiRoleId: 'email_assistant',
      options: { ...DEFAULT_OPTIONS, improve: true, fixMistakes: true, format: true, formality: 'Formal', tone: 'Polite' },
      enabled: true,
    }],
  },
  {
    name: 'Social Media Blast',
    configs: [{
      id: 1,
      model: 'qwen-qwen3-30b-a3b-instruct-2507',
      aiRoleId: 'social_media_assistant',
      options: { ...DEFAULT_OPTIONS, improve: true, fixMistakes: true, addEmojis: true, formality: 'Casual', tone: 'Engaging' },
      enabled: true,
    }],
  },
];

export const DEFAULT_WORKFLOW_NAMES = DEFAULT_WORKFLOWS.map(w => w.name);

/**
 * Tier-based limits for authentication system
 */
export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxTextLength: 1000,
    maxContextLength: 2500,
    maxBatchSize: 6,
    availableModels: ['openai-gpt-5-nano', 'open-router-free', 'qwen-qwen3-30b-a3b-instruct-2507'],
  },
  plus: {
    maxTextLength: 2000,
    maxContextLength: 3000,
    maxBatchSize: 10,
    availableModels: ['openai-gpt-5-nano', 'open-router-free', 'qwen-qwen3-30b-a3b-instruct-2507'],
  },
  premium: {
    maxTextLength: 5000,
    maxContextLength: 10000,
    maxBatchSize: 10,
    availableModels: ['openai-gpt-5-nano', 'open-router-free', 'qwen-qwen3-30b-a3b-instruct-2507'],
  },
};

/**
 * Authentication error messages
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_QUOTA: "You've reached this week's token allowance. It resets Monday at 00:00 UTC.",
  MODEL_ACCESS_DENIED: "This model is unavailable in the public demo.",
  USER_TEXT_LIMIT_EXCEEDED: "Your text exceeds the maximum length. Please shorten it.",
  CONTEXT_TEXT_LIMIT_EXCEEDED: "Your context exceeds the maximum length. Please shorten it.",
  TIER_BATCH_SIZE_EXCEEDED: "You've reached the maximum number of assistants.",
  INVALID_TOKEN: "Your session expired. Please reload the page.",
  USER_BLOCKED: "Access is unavailable.",
  AUTHENTICATION_FAILED: "Your session could not be restored. Please reload the page.",
};
