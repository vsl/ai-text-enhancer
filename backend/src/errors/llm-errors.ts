/**
 * LLM Error Classes
 * 
 * Platform-agnostic error handling for LLM connectors.
 */

export class LLMError extends Error {
  constructor(
    public provider: string,
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export type LLMFailureCode =
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_NETWORK_ERROR'
  | 'PROVIDER_HTTP_ERROR'
  | 'PROVIDER_RESPONSE_ERROR'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'MISSING_CHOICE'
  | 'EMPTY_MODEL_OUTPUT'
  | 'OUTPUT_TRUNCATED'
  | 'INVALID_JSON'
  | 'SCHEMA_MISMATCH';

export class LLMOutputError extends LLMError {
  constructor(provider: string, message: string, code: LLMFailureCode) {
    super(provider, message, undefined, code);
    this.name = 'LLMOutputError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(provider: string, timeout: number) {
    super(provider, `Request timeout after ${timeout}ms`, 408, 'PROVIDER_TIMEOUT');
    this.name = 'LLMTimeoutError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(provider: string) {
    super(provider, 'Rate limit exceeded', 429, 'PROVIDER_RATE_LIMIT');
    this.name = 'LLMRateLimitError';
  }
}

export class LLMAuthenticationError extends LLMError {
  constructor(provider: string) {
    super(provider, 'Authentication failed - invalid API key', 401, 'PROVIDER_AUTH_ERROR');
    this.name = 'LLMAuthenticationError';
  }
}
