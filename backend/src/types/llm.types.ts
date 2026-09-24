/**
 * LLM Connector Types
 * 
 * Platform-agnostic type definitions for LLM integration.
 */

import type { ModelConfig, StructuredOutputMode } from './config.types.ts';

export interface LLMRequestParams {
  model: string;
  requestedPublicModel?: string;
  requestId?: string;
  systemPrompt: string;
  userPrompt: string;
  structuredOutputMode?: StructuredOutputMode;
  serviceTier?: 'flex';
  reasoningEffort?: ModelConfig['reasoningEffort'];
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
    reasoningTokens?: number;
    cachedTokens?: number;
    cost?: number;
    isByok?: boolean;
  };
  model: string;
  provider: string;
  diagnostics: LLMProviderDiagnostics;
}

export interface LLMProviderDiagnostics {
  generationId?: string;
  httpStatus: number;
  requestedPublicModel?: string;
  providerModel: string;
  resolvedModel?: string;
  resolvedProvider?: string;
  finishReason?: string;
  nativeFinishReason?: string;
  providerError?: unknown;
  latencyMs: number;
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
