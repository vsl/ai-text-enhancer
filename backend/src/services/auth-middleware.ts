/**
 * Authentication Middleware
 * High-level authentication wrapper for handler layer
 * Platform-agnostic implementation using Supabase Auth
 */

import type { UserProfile } from '../types/auth.types.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from './auth-service.ts';
import { InvalidTokenError } from '../errors/auth-errors.ts';

export interface AuthenticatedRequest {
  user: UserProfile;
  headers: Record<string, string>;
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor(supabase: SupabaseClient, jwtSecret: string) {
    this.authService = new AuthService(supabase, jwtSecret);
  }

  /**
   * Authenticate request and return user profile
   *
   * Extracts JWT from Authorization header, validates it with Supabase,
   * and fetches user profile from database.
   *
   * @param headers - Request headers (must contain Authorization header)
   * @returns UserProfile with quota information
   * @throws InvalidTokenError if token missing or invalid
   * @throws UserBlockedError if user account is blocked
   * @throws UserNotFoundError if user not found in database
   */
  async authenticate(headers: Record<string, string>): Promise<UserProfile> {
    // Extract token (case-insensitive header lookup)
    const authHeader = headers['authorization'] || headers['Authorization'];
    const token = this.extractToken(authHeader);

    // Validate token and get user profile
    const result = await this.authService.validateToken(token);

    if (!result.authenticated || !result.user) {
      throw new InvalidTokenError();
    }

    return result.user;
  }

  /**
   * Extract token from Authorization header
   *
   * @param authHeader - Authorization header value
   * @returns Extracted JWT token
   * @throws InvalidTokenError if header missing or malformed
   */
  private extractToken(authHeader: string | null | undefined): string {
    if (!authHeader) {
      throw new InvalidTokenError();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new InvalidTokenError();
    }

    return parts[1];
  }
}
