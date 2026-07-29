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
  formality: string;
  tone: string;
  languageLevel: string;
  translateTo: string;
}

/**
 * AI Assistant Configuration
 */
export interface AiConfig {
  id: number;
  model: string;
  aiRole: string;
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

/**
 * Token package for purchase
 */
export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  popular?: boolean;
  discount?: string;
  costPerThousand: string;
}
