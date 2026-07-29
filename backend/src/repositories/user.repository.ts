/**
 * User Repository
 * Platform-agnostic database operations for user profiles and quotas
 *
 * This repository encapsulates all SQL queries related to user management.
 * Uses Supabase client for database access with proper error handling.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserTier, AuthProvider } from '../types/auth.types.ts';

/**
 * User profile database record
 */
export interface UserProfileRecord {
  id: string;
  email: string;
  tier: UserTier;
  is_admin: boolean;
  is_active: boolean;
  auth_provider: AuthProvider;
  created_at: string;
  updated_at: string;
}

/**
 * User quota database record
 */
export interface UserQuotaRecord {
  id: string;
  user_id: string;
  tokens_available: number;
  tokens_used: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Combined user profile with quota information
 */
export interface UserWithQuota {
  userId: string;
  email: string;
  tier: UserTier;
  isAdmin: boolean;
  isActive: boolean;
  tokensAvailable: number;
  tokensUsed: number;
  authProvider: AuthProvider;
  createdAt: string;
  updatedAt: string;
}

/**
 * Paginated user list result
 */
export interface PaginatedUsers {
  users: UserWithQuota[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * User Repository Error
 */
export class UserRepositoryError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'UserRepositoryError';
  }
}

export class UserRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get user profile with quota by user ID (single JOIN query)
   *
   * @param userId - User UUID
   * @returns User profile with quota information
   * @throws UserRepositoryError if user not found or database error
   */
  async getUserById(userId: string): Promise<UserWithQuota> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(
          `
          id,
          email,
          tier,
          is_admin,
          is_active,
          auth_provider,
          created_at,
          updated_at,
          user_quotas (
            tokens_available,
            tokens_used
          )
        `
        )
        .eq('id', userId)
        .single();

      if (error) {
        throw new UserRepositoryError(
          `Failed to fetch user by ID: ${error.message}`,
          error
        );
      }

      if (!data) {
        throw new UserRepositoryError(`User not found: ${userId}`);
      }

      // Extract quota data from nested array
      const quota = Array.isArray(data.user_quotas) ? data.user_quotas[0] : data.user_quotas;

      if (!quota) {
        throw new UserRepositoryError(`User quota not found for user: ${userId}`);
      }

      return this.mapToUserWithQuota(data, quota);
    } catch (error) {
      if (error instanceof UserRepositoryError) {
        throw error;
      }
      throw new UserRepositoryError('Failed to get user by ID', error);
    }
  }

  /**
   * Get user profile with quota by email
   *
   * @param email - User email address
   * @returns User profile with quota information
   * @throws UserRepositoryError if user not found or database error
   */
  async getUserByEmail(email: string): Promise<UserWithQuota> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(
          `
          id,
          email,
          tier,
          is_admin,
          is_active,
          auth_provider,
          created_at,
          updated_at,
          user_quotas (
            tokens_available,
            tokens_used
          )
        `
        )
        .eq('email', email)
        .single();

      if (error) {
        throw new UserRepositoryError(
          `Failed to fetch user by email: ${error.message}`,
          error
        );
      }

      if (!data) {
        throw new UserRepositoryError(`User not found with email: ${email}`);
      }

      // Extract quota data from nested array
      const quota = Array.isArray(data.user_quotas) ? data.user_quotas[0] : data.user_quotas;

      if (!quota) {
        throw new UserRepositoryError(`User quota not found for user: ${email}`);
      }

      return this.mapToUserWithQuota(data, quota);
    } catch (error) {
      if (error instanceof UserRepositoryError) {
        throw error;
      }
      throw new UserRepositoryError('Failed to get user by email', error);
    }
  }

  /**
   * Update user tier
   *
   * @param userId - User UUID
   * @param tier - New tier ('free' | 'plus' | 'premium')
   * @returns Updated user with quota
   * @throws UserRepositoryError if update fails
   */
  async updateUserTier(userId: string, tier: UserTier): Promise<UserWithQuota> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .update({ tier, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new UserRepositoryError(
          `Failed to update user tier: ${error.message}`,
          error
        );
      }

      if (!data) {
        throw new UserRepositoryError(`User not found: ${userId}`);
      }

      // Fetch complete user with quota
      return this.getUserById(userId);
    } catch (error) {
      if (error instanceof UserRepositoryError) {
        throw error;
      }
      throw new UserRepositoryError('Failed to update user tier', error);
    }
  }

  /**
   * Update user status (active/blocked)
   *
   * @param userId - User UUID
   * @param isActive - Active status (true = active, false = blocked)
   * @returns Updated user with quota
   * @throws UserRepositoryError if update fails
   */
  async updateUserStatus(userId: string, isActive: boolean): Promise<UserWithQuota> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new UserRepositoryError(
          `Failed to update user status: ${error.message}`,
          error
        );
      }

      if (!data) {
        throw new UserRepositoryError(`User not found: ${userId}`);
      }

      // Fetch complete user with quota
      return this.getUserById(userId);
    } catch (error) {
      if (error instanceof UserRepositoryError) {
        throw error;
      }
      throw new UserRepositoryError('Failed to update user status', error);
    }
  }

  /**
   * List users with pagination
   *
   * @param limit - Number of users to return (default: 50)
   * @param offset - Number of users to skip (default: 0)
   * @returns Paginated list of users with quotas
   * @throws UserRepositoryError if query fails
   */
  async listUsers(limit: number = 50, offset: number = 0): Promise<PaginatedUsers> {
    try {
      // Get total count
      const { count, error: countError } = await this.supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw new UserRepositoryError(
          `Failed to count users: ${countError.message}`,
          countError
        );
      }

      // Get paginated users with quotas
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(
          `
          id,
          email,
          tier,
          is_admin,
          is_active,
          auth_provider,
          created_at,
          updated_at,
          user_quotas (
            tokens_available,
            tokens_used
          )
        `
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new UserRepositoryError(
          `Failed to list users: ${error.message}`,
          error
        );
      }

      const users: UserWithQuota[] = (data || []).map((profile) => {
        const quota = Array.isArray(profile.user_quotas)
          ? profile.user_quotas[0]
          : profile.user_quotas;

        return this.mapToUserWithQuota(profile, quota || {
          tokens_available: 0,
          tokens_used: 0
        });
      });

      return {
        users,
        total: count || 0,
        limit,
        offset,
      };
    } catch (error) {
      if (error instanceof UserRepositoryError) {
        throw error;
      }
      throw new UserRepositoryError('Failed to list users', error);
    }
  }

  /**
   * Map database records to UserWithQuota
   *
   * @private
   */
  private mapToUserWithQuota(
    profile: {
      id: string;
      email: string;
      tier: UserTier;
      is_admin: boolean;
      is_active: boolean;
      auth_provider: AuthProvider;
      created_at: string;
      updated_at: string;
    },
    quota: {
      tokens_available: number;
      tokens_used: number;
    }
  ): UserWithQuota {
    return {
      userId: profile.id,
      email: profile.email,
      tier: profile.tier,
      isAdmin: profile.is_admin,
      isActive: profile.is_active,
      tokensAvailable: quota.tokens_available,
      tokensUsed: quota.tokens_used,
      authProvider: profile.auth_provider,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }
}
