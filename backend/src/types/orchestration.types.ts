/**
 * Internal types for orchestration logic
 * (API types already exist in api.types.ts)
 * 
 * Platform-agnostic - works in both Deno and Node.js.
 */

/**
 * Single assistant processing result (internal use)
 * This is the internal format before conversion to API BatchResult format
 */
export interface AssistantProcessingResult {
  id: string;
  success: boolean;
  enhancedText?: string;
  tokensUsed?: number;
  error?: {
    code: string;
    message?: string;
  };
}
