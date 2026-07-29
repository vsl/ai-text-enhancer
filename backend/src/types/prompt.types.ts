/**
 * Prompt Types
 * 
 * Type definitions for the dynamic prompt engineering system.
 * Platform-agnostic - works in both Deno and Node.js.
 */

import type { AssistantConfiguration } from './api.types.ts';

/**
 * Constructed prompt ready for LLM
 */
export interface ConstructedPrompt {
  systemPrompt: string;  // Role's system prompt + JSON format enforcement
  userPrompt: string;    // Constructed user prompt from options + text + context
}

/**
 * Type alias for prompt building input
 * Uses the AssistantConfiguration from the API contract
 */
export type PromptBuildRequest = AssistantConfiguration;
