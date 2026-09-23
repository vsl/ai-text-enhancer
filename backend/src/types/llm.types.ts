/**
 * LLM Connector Types
 * 
 * Platform-agnostic type definitions for LLM integration.
 */

import type { StructuredOutputMode } from './config.types.ts';

export interface LLMRequestParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  structuredOutputMode?: StructuredOutputMode;
  serviceTier?: 'flex';
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

export interface LLMConnector {
  name: string;
  supportsStreaming: boolean;
  sendRequest(params: LLMRequestParams): Promise<LLMResponse>;
}

export interface LLMError {
  provider: string;
  message: string;
  code?: string;
  statusCode?: number;
}
