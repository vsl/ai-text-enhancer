import type { AiRoleId, Language, LanguageLevel, Tier, TierLimits } from '@/lib/types';

export const AVAILABLE_MODELS = ['qwen-qwen3-30b-a3b-instruct-2507', 'openai-gpt-5-nano', 'open-router-free', 'openai-gpt-6-luna', 'anthropic-claude-haiku-5.5'] as const;

export const MODEL_NAMES: Record<string, string> = {
  'openai-gpt-5-nano': 'GPT-5 Nano',
  'openai-gpt-6-luna': 'GPT-6 Luna',
  'anthropic-claude-haiku-5.5': 'Claude Haiku 5.5',
  'open-router-free': 'OpenRouter Free',
  'qwen-qwen3-30b-a3b-instruct-2507': 'Qwen3 30B',
};

export const AVAILABLE_AI_ROLES: readonly { id: AiRoleId; label: string }[] = [
  { id: 'editor', label: 'General Assistant' },
  { id: 'email_assistant', label: 'Professional Email Assistant' },
] as const;

export const getAiRoleLabel = (id: AiRoleId): string =>
  AVAILABLE_AI_ROLES.find((role) => role.id === id)?.label ?? 'General Assistant';

export const TONES = [
  'Confident', 'Empathetic', 'Cheerful', 'Witty', 'Direct',
  'Engaging', 'Polite', 'Sincere', 'Disappointed', 'Apologetic',
  'Pessimistic', 'Worried'
] as const;

export const FORMALITY = ['Casual', 'Neutral', 'Formal'] as const;

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
  avoidCommonAiSymbols: 'Avoid common AI symbols',
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

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxTextLength: 1000,
    maxContextLength: 2500,
    maxBatchSize: 6,
    availableModels: ['openai-gpt-5-nano', 'open-router-free', 'qwen-qwen3-30b-a3b-instruct-2507', 'openai-gpt-6-luna', 'anthropic-claude-haiku-5.5'],
  },
  plus: {
    maxTextLength: 2000,
    maxContextLength: 3000,
    maxBatchSize: 10,
    availableModels: ['openai-gpt-5-nano', 'open-router-free', 'qwen-qwen3-30b-a3b-instruct-2507', 'openai-gpt-6-luna', 'anthropic-claude-haiku-5.5'],
  },
  premium: {
    maxTextLength: 5000,
    maxContextLength: 10000,
    maxBatchSize: 10,
    availableModels: ['openai-gpt-5-nano', 'open-router-free', 'qwen-qwen3-30b-a3b-instruct-2507', 'openai-gpt-6-luna', 'anthropic-claude-haiku-5.5'],
  },
};
