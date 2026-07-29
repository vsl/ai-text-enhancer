/**
 * Authentication and Authorization Errors
 * Platform-agnostic error classes for auth operations
 */

export class AuthenticationError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor() {
    super('Invalid or expired token', 401);
    this.name = 'InvalidTokenError';
  }
}

export class InsufficientTierError extends AuthorizationError {
  constructor(requiredTier: string, userTier: string) {
    super(
      `Model requires ${requiredTier} tier, but user has ${userTier} tier`,
      403
    );
    this.name = 'InsufficientTierError';
  }
}

export class UserBlockedError extends AuthorizationError {
  constructor(userId: string) {
    super(
      `User account is blocked: ${userId}`,
      403
    );
    this.name = 'UserBlockedError';
  }
}

export class UserNotFoundError extends AuthenticationError {
  constructor(identifier: string) {
    super(
      `User not found: ${identifier}`,
      404
    );
    this.name = 'UserNotFoundError';
  }
}
