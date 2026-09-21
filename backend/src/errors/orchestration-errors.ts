/**
 * Orchestration Error Types
 * 
 * Error classes for batch request orchestration.
 * Platform-agnostic - works in both Deno and Node.js.
 */

/**
 * Base class for all orchestration errors
 */
export class OrchestrationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'OrchestrationError';
  }
}

export class InvalidRequestError extends OrchestrationError {
  constructor(message: string) {
    super(message, 'INVALID_REQUEST');
    this.name = 'InvalidRequestError';
  }
}

/**
 * Error when batch size exceeds maximum
 */
export class BatchSizeError extends OrchestrationError {
  constructor(size: number, maxSize: number = 10) {
    super(
      `Batch size ${size} exceeds maximum ${maxSize}`,
      'BATCH_SIZE_EXCEEDED'
    );
    this.name = 'BatchSizeError';
  }
}

/**
 * Error when batch is empty
 */
export class EmptyBatchError extends OrchestrationError {
  constructor() {
    super('Batch cannot be empty', 'EMPTY_BATCH');
    this.name = 'EmptyBatchError';
  }
}

/**
 * Error when duplicate task IDs are found
 */
export class DuplicateTaskIdError extends OrchestrationError {
  constructor(duplicateId: string) {
    super(
      `Duplicate task ID found: ${duplicateId}`,
      'DUPLICATE_TASK_ID'
    );
    this.name = 'DuplicateTaskIdError';
  }
}

/**
 * Error when individual assistant exceeds timeout
 */
export class TaskTimeoutError extends OrchestrationError {
  constructor(taskId: string, timeoutMs: number) {
    super(
      `Task ${taskId} exceeded timeout of ${timeoutMs}ms`,
      'TASK_TIMEOUT'
    );
    this.name = 'TaskTimeoutError';
  }
}

/**
 * Error when user text exceeds tier limit
 */
export class UserTextLimitError extends OrchestrationError {
  constructor(tier: string, limit: number, actual: number) {
    super(
      `User text exceeds ${tier} tier limit of ${limit} characters (got ${actual})`,
      'USER_TEXT_LIMIT_EXCEEDED'
    );
    this.name = 'UserTextLimitError';
  }
}

/**
 * Error when context text exceeds tier limit
 */
export class ContextTextLimitError extends OrchestrationError {
  constructor(tier: string, limit: number, actual: number) {
    super(
      `Context text exceeds ${tier} tier limit of ${limit} characters (got ${actual})`,
      'CONTEXT_TEXT_LIMIT_EXCEEDED'
    );
    this.name = 'ContextTextLimitError';
  }
}

/**
 * Error when batch size exceeds tier limit
 */
export class TierBatchSizeError extends OrchestrationError {
  constructor(tier: string, limit: number, actual: number) {
    super(
      `Batch size exceeds ${tier} tier limit of ${limit} assistants (got ${actual})`,
      'TIER_BATCH_SIZE_EXCEEDED'
    );
    this.name = 'TierBatchSizeError';
  }
}
