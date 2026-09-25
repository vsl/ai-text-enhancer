/**
 * Type definitions for the AI Text Enhancer application
 */

/**
 * Options for AI text enhancement configuration
 */
export interface Options {
  [key: string]: boolean | string;
  improve: boolean;
  fixMistakes: boolean;
  format: boolean;
  shorten: boolean;
  lengthen: boolean;
  addEmojis: boolean;
  avoidCommonAiSymbols: boolean;
  formality: 'Casual' | 'Neutral' | 'Formal';
  tone: 'Confident' | 'Empathetic' | 'Cheerful' | 'Witty' | 'Direct' | 'Engaging' | 'Polite' | 'Sincere' | 'Disappointed' | 'Apologetic' | 'Pessimistic' | 'Worried';
  languageLevel: '' | 'simple' | 'intermediate' | 'advanced' | 'fluent' | 'native';
  translateTo: '' | 'ar' | 'zh' | 'en' | 'fr' | 'de' | 'hi' | 'it' | 'ja' | 'ko' | 'pt' | 'ru' | 'es' | 'uk' | 'vi';
}

export type AiRoleId = 'editor' | 'summarizer' | 'email_assistant';

/**
 * AI Assistant Configuration
 */
export interface AiConfig {
  id: number;
  model: string;
  aiRoleId: AiRoleId;
  options: Options;
  enabled: boolean;
}

/**
 * Result from an AI assistant
 */
export interface Result {
  configId: number;
  text: string;
  error?: boolean;
  isLoading: boolean;
}

/**
 * Workflow containing multiple AI assistant configurations
 */
export interface Workflow {
  name: string;
  configs: AiConfig[];
}

/**
 * Language option
 */
export interface Language {
  code: string;
  name: string;
}

/**
 * Language level option
 */
export interface LanguageLevel {
  value: string;
  label: string;
}

/**
 * User tier type
 */
export type Tier = 'free' | 'plus' | 'premium';

/**
 * User profile from database
 */
export interface UserProfile {
  id: string;
  email: string;
  tier: Tier;
  tokens_available: number;
  tokens_used: number;
  auth_provider: string;
  created_at: string;
  is_anonymous?: boolean;
}

/**
 * Tier-based limits for features
 */
export interface TierLimits {
  maxTextLength: number;
  maxContextLength: number;
  maxBatchSize: number;
  availableModels: string[];
}

/**
 * User session including profile and limits
 */
export interface UserSession {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile | null;
  tierLimits: TierLimits;
}
