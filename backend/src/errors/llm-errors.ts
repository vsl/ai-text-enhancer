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
    public code?: string
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(provider: string, timeout: number) {
    super(provider, `Request timeout after ${timeout}ms`, 408, 'TIMEOUT');
    this.name = 'LLMTimeoutError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(provider: string) {
    super(provider, 'Rate limit exceeded', 429, 'RATE_LIMIT');
    this.name = 'LLMRateLimitError';
  }
}

export class LLMAuthenticationError extends LLMError {
  constructor(provider: string) {
    super(provider, 'Authentication failed - invalid API key', 401, 'AUTH_FAILED');
    this.name = 'LLMAuthenticationError';
  }
}
