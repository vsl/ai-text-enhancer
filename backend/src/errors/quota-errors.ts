/**
 * Token Quota Errors
 * Platform-agnostic error classes for quota management
 */

export class QuotaError extends Error {
  constructor(message: string, public statusCode: number = 429) {
    super(message);
    this.name = 'QuotaError';
  }
}

export class QuotaExceededError extends QuotaError {
  constructor(
    public used: number,
    public limit: number,
    public resetAt: string
  ) {
    super(
      `Daily token quota exceeded. Used: ${used}/${limit}. Resets at: ${resetAt}`,
      429
    );
    this.name = 'QuotaExceededError';
  }
}

export class InsufficientQuotaError extends QuotaError {
  constructor(
    public required: number,
    public available: number
  ) {
    super(
      `Insufficient token quota. Required: ${required}, Available: ${available}`,
      429
    );
    this.name = 'InsufficientQuotaError';
  }
}
