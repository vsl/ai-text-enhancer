/**
 * Constants for the AI Text Enhancer application
 */

import { Options, Workflow, Language, LanguageLevel, Tier, TierLimits, TokenPackage } from './types';

export const AVAILABLE_MODELS = ['gemini-flash', 'open-router-free', 'local-debug-model'];

export const AVAILABLE_AI_ROLES: Record<string, string> = {
  'General Assistant': 'You are a helpful assistant. Please refine the following text based on the user\'s instructions.',
  'Summarizer Assistant': 'You are an expert summarization assistant. Condense the key points of the following text.',
  'Professional Email Assistant': 'You are a professional communication assistant. Rewrite the following text as a formal email.',
  'Social Media Assistant': 'You are a social media assistant. Adapt the following text into an engaging social media post.',
};

export const TONES = [
  'Confident', 'Empathetic', 'Cheerful', 'Witty', 'Direct',
  'Engaging', 'Polite', 'Sincere', 'Disappointed', 'Apologetic',
  'Pessimistic', 'Worried'
];

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

export const FORMALITY = ['Casual', 'Neutral', 'Formal'];

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
  format: "Applies formatting like lists, bolding, and paragraphs for better readability.",
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
  AUTHENTICATION_FAILED: "Authentication failed. Please try again or contact support.",
  AUTHORIZATION_FAILED: "Your account doesn't have access to this feature. Consider upgrading your plan.",
  NOT_FOUND: "Service is temporarily unavailable. Please try again later.",
  QUOTA_EXCEEDED: "You've exceeded your usage quota. Please try again later or upgrade your plan.",
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

export const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    name: 'Quick Fix',
    configs: [{
      id: 1,
      model: 'gemini-flash',
      aiRole: 'General Assistant',
      options: { ...DEFAULT_OPTIONS, improve: true, fixMistakes: true },
      enabled: true,
    }],
  },
  {
    name: 'Formal Email',
    configs: [{
      id: 1,
      model: 'gemini-flash',
      aiRole: 'Professional Email Assistant',
      options: { ...DEFAULT_OPTIONS, improve: true, fixMistakes: true, format: true, formality: 'Formal', tone: 'Polite' },
      enabled: true,
    }],
  },
  {
    name: 'Social Media Blast',
    configs: [{
      id: 1,
      model: 'gemini-flash',
      aiRole: 'Social Media Assistant',
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
    maxTextLength: 500,
    maxContextLength: 800,
    maxBatchSize: 3,
    availableModels: ['gemini-flash', 'open-router-free'],
  },
  plus: {
    maxTextLength: 2000,
    maxContextLength: 3000,
    maxBatchSize: 10,
    availableModels: ['gemini-flash', 'open-router-free', 'gemini-pro'],
  },
  premium: {
    maxTextLength: 5000,
    maxContextLength: 10000,
    maxBatchSize: 10,
    availableModels: ['gemini-flash', 'open-router-free', 'gemini-pro', 'gpt-4'],
  },
};

/**
 * Authentication error messages
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_QUOTA: "You've run out of tokens. Please upgrade your plan or wait for your quota to refresh.",
  MODEL_ACCESS_DENIED: "This model is not available on your current tier. Please upgrade to access it.",
  USER_TEXT_LIMIT_EXCEEDED: "Your text exceeds the maximum length for your tier. Please shorten it or upgrade.",
  CONTEXT_TEXT_LIMIT_EXCEEDED: "Your context exceeds the maximum length for your tier. Please shorten it or upgrade.",
  TIER_BATCH_SIZE_EXCEEDED: "You've reached the maximum number of assistants for your tier. Please upgrade to add more.",
  INVALID_TOKEN: "Your session has expired. Please log in again.",
  USER_BLOCKED: "Your account has been blocked. Please contact support.",
  AUTHENTICATION_FAILED: "Authentication failed. Please try signing in again.",
};

/**
 * Token packages for purchase
 */
export const TOKEN_PACKAGES: TokenPackage[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    tokens: 100000,
    price: 5.00,
    costPerThousand: '$0.05',
  },
  {
    id: 'popular',
    name: 'Popular Pack',
    tokens: 500000,
    price: 20.00,
    popular: true,
    discount: '20% off',
    costPerThousand: '$0.04',
  },
  {
    id: 'premium',
    name: 'Premium Pack',
    tokens: 1000000,
    price: 35.00,
    discount: '30% off',
    costPerThousand: '$0.035',
  },
];
