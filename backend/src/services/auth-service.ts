/**
 * Authentication Service
 * Validates JWT tokens using local verification and fetches user profiles from database
 * Platform-agnostic implementation
 */

import type { UserProfile, AuthResult } from '../types/auth.types.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { InvalidTokenError, UserBlockedError, UserNotFoundError } from '../errors/auth-errors.ts';
import { UserRepository } from '../repositories/user.repository.ts';
import { jwtVerify } from 'npm:jose@5';

export class AuthService {
  private userRepository: UserRepository;
  private jwtSecret: string;

  constructor(private supabase: SupabaseClient, jwtSecret: string) {
    this.userRepository = new UserRepository(supabase);
    this.jwtSecret = jwtSecret;
  }

  /**
   * Validate JWT token using local verification and fetch user profile
   *
   * Uses local JWT verification with jose library to avoid HTTP calls.
   * This is more efficient in Edge Functions and avoids connection issues.
   *
   * @param token - JWT token from Authorization header
   * @returns AuthResult with user profile or error
   */
  async validateToken(token: string): Promise<AuthResult> {
    try {
      // Step 1: Verify JWT locally using jose
      const secret = new TextEncoder().encode(this.jwtSecret);
      const { payload } = await jwtVerify(token, secret, {
        issuer: undefined, // Allow any issuer
        audience: undefined, // Allow any audience
      });

      if (!payload.sub) {
        return {
          authenticated: false,
          error: 'Invalid token: missing sub claim',
        };
      }

      // Step 2: Fetch user profile + quota from database
      const userId = payload.sub;

      let userWithQuota;
      try {
        userWithQuota = await this.userRepository.getUserById(userId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new UserNotFoundError(userId);
        }
        throw error;
      }

      // Step 3: Check if user is active (not blocked)
      if (!userWithQuota.isActive) {
        throw new UserBlockedError(userId);
      }

      // Step 4: Map to UserProfile
      const user: UserProfile = {
        userId: userWithQuota.userId,
        email: userWithQuota.email,
        tier: userWithQuota.tier,
        isAdmin: userWithQuota.isAdmin,
        isActive: userWithQuota.isActive,
        tokensAvailable: userWithQuota.tokensAvailable,
        tokensUsed: userWithQuota.tokensUsed,
        authProvider: userWithQuota.authProvider,
      };

      return {
        authenticated: true,
        user,
      };
    } catch (error) {
      // Re-throw known errors
      if (error instanceof UserBlockedError || error instanceof UserNotFoundError) {
        throw error;
      }

      // Log unexpected errors
      console.error('[AUTH] Failed to validate token:', error);

      return {
        authenticated: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractToken(authHeader: string | null | undefined): string {
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
