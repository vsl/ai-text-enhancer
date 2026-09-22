import type {
  Formality,
  Language,
  LanguageLevel,
  Tone,
} from '../config/transformation-options.config.ts';

/**
 * API Request/Response Types
 * 
 * Type definitions matching the API contract defined in CORE_API_CONTRACT.md
 * Platform-agnostic - works in both Deno and Node.js.
 */

/**
 * Main batch request structure
 */
export interface BatchRequest {
  assistants: AssistantConfiguration[];  // 1-10 items
}

/**
 * Single assistant configuration within a batch
 */
export interface AssistantConfiguration {
  id: string;                   // Unique client-side identifier
  model: string;                // Model identifier (e.g., 'open-router-free', 'openai-gpt-5-nano')
  aiRoleId: string;             // AI persona (e.g., 'summarizer', 'editor', 'social_media_assistant', 'email_assistant')
  userText: string;             // Text to enhance (max 500 chars)
  contextText?: string;         // Optional context (max 800 chars)
  options: TransformationOptions;
}

/**
 * Text transformation options
 */
export interface TransformationOptions {
  // Core Transformations
  improve?: boolean;            // Improve clarity, flow, vocabulary
  fixMistakes?: boolean;        // Fix grammar, spelling, punctuation
  format?: boolean;             // Apply formatting (lists, paragraphs)
  
  // Length Adjustments (mutually exclusive)
  shorten?: boolean;            // Make more concise
  lengthen?: boolean;           // Add detail and depth
  
  // Style Controls
  formality?: Formality;
  tone?: Tone;
  languageLevel?: LanguageLevel;
  
  // Special Transformations
  translateTo?: Language;
  addEmojis?: boolean;          // Add relevant emojis
}

/**
 * Batch response structure
 */
export interface BatchResponse {
  results: BatchResult[];
}

/**
 * Result for a single assistant (union type)
 */
export type BatchResult = SuccessResult | ErrorResult;

/**
 * Successful enhancement result
 */
export interface SuccessResult {
  id: string;              // Matches request assistant.id
  status: 'success';
  enhancedText: string;    // AI-generated enhanced text
  total_tokens: number;    // Tokens consumed (for billing)
}

/**
 * Failed enhancement result
 */
export interface ErrorResult {
  id: string;              // Matches request assistant.id
  status: 'error';
  error: ErrorDetails;
}

/**
 * Error details
 */
export interface ErrorDetails {
  code: string;            // Machine-readable error code
  message?: string;         // Human-readable error message
}
