import { ADMIN_POLICY } from '../config/admin.config.ts';
import type { BootstrapUser } from '../types/admin.types.ts';
import { AuthenticationError, AuthorizationError } from '../errors/auth-errors.ts';
/**
 * Admin Service
 * Platform-agnostic business logic for admin operations
 *
 * This service provides administrative capabilities:
 * - Token adjustment (add/subtract tokens)
 * - Tier management (change user tier)
 * - User management (block/unblock, view details)
 * - Bootstrap functionality (create predefined users)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { UserRepository } from '../repositories/user.repository.ts';
import { QuotaRepository } from '../repositories/quota.repository.ts';
import type { UserWithQuota } from '../repositories/user.repository.ts';
import type { TokenPurchase } from '../repositories/quota.repository.ts';
import type { UserTier } from '../types/auth.types.ts';

/**
 * User details with quota and purchase history
 */
export interface UserDetails {
  profile: UserWithQuota;
  recentPurchases: TokenPurchase[];
}

/**
 * Bootstrap result
 */
export interface BootstrapResult {
  success: boolean;
  usersCreated: number;
  usersSkipped: number;
  users: string[];
}

/**
 * Admin Service Error
 */
export class AdminServiceError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'AdminServiceError';
  }
}

/**
 * Admin Service
 */
export class AdminService {
  private userRepo: UserRepository;
  private quotaRepo: QuotaRepository;

  constructor(private supabase: SupabaseClient) {
    this.userRepo = new UserRepository(supabase);
    this.quotaRepo = new QuotaRepository(supabase);
  }

  /** Verify admin identity and authorization without exposing repository internals. */
  async authenticateAdmin(token: string): Promise<string> {
    const { data: { user }, error } = await this.supabase.auth.getUser(token);
    if (error || !user) throw new AuthenticationError('Invalid or expired token');
    const profile = await this.userRepo.getUserById(user.id);
    if (!profile.isAdmin || !profile.isActive) throw new AuthorizationError('Active admin privileges required');
    return user.id;
  }

  /**
   * Adjust user token balance (add or subtract)
   *
   * @param userId - User UUID
   * @param tokensToAdd - Number of tokens to add (negative to subtract)
   * @param description - Optional description of the adjustment
   * @returns Updated user details
   * @throws AdminServiceError if operation fails
   */
  async adjustTokens(
    userId: string,
    tokensToAdd: number,
    description?: string
  ): Promise<UserDetails> {
    try {
      // Validate user exists
      const user = await this.userRepo.getUserById(userId);

      if (tokensToAdd === 0) {
        throw new AdminServiceError('Token adjustment amount cannot be zero');
      }

      // Handle negative adjustments (subtraction)
      if (tokensToAdd < 0) {
        const tokensToSubtract = Math.abs(tokensToAdd);

        // Check if user has enough tokens to subtract
        if (user.tokensAvailable < tokensToSubtract) {
          throw new AdminServiceError(
            `Cannot subtract ${tokensToSubtract} tokens. User only has ${user.tokensAvailable} tokens available.`
          );
        }

        // Deduct tokens
        await this.quotaRepo.deductTokens(userId, tokensToSubtract);
      } else {
        // Add tokens
        await this.quotaRepo.addTokens(
          userId,
          tokensToAdd,
          'admin_grant',
          description || `Admin granted ${tokensToAdd} tokens`
        );
      }

      // Return updated user details
      return await this.getUserDetails(userId);
    } catch (error) {
      if (error instanceof AdminServiceError) {
        throw error;
      }
      throw new AdminServiceError('Failed to adjust tokens', error);
    }
  }

  /**
   * Change user tier
   *
   * @param userId - User UUID
   * @param newTier - New tier ('free' | 'plus' | 'premium')
   * @returns Updated user details
   * @throws AdminServiceError if operation fails
   */
  async changeTier(userId: string, newTier: UserTier): Promise<UserDetails> {
    try {
      // Validate tier
      const validTiers: UserTier[] = ['free', 'plus', 'premium'];
      if (!validTiers.includes(newTier)) {
        throw new AdminServiceError(
          `Invalid tier: ${newTier}. Must be one of: ${validTiers.join(', ')}`
        );
      }

      // Update tier
      await this.userRepo.updateUserTier(userId, newTier);

      // Return updated user details
      return await this.getUserDetails(userId);
    } catch (error) {
      if (error instanceof AdminServiceError) {
        throw error;
      }
      throw new AdminServiceError('Failed to change tier', error);
    }
  }

  /**
   * Get complete user details (profile + quota + recent purchases)
   *
   * @param userId - User UUID
   * @returns User details with purchase history
   * @throws AdminServiceError if user not found
   */
  async getUserDetails(userId: string): Promise<UserDetails> {
    try {
      const profile = await this.userRepo.getUserById(userId);
      const { purchases } = await this.quotaRepo.getPurchaseHistory(userId, ADMIN_POLICY.recentPurchaseLimit);

      return {
        profile,
        recentPurchases: purchases,
      };
    } catch (error) {
      throw new AdminServiceError('Failed to get user details', error);
    }
  }

  /**
   * Block user (set is_active = false)
   *
   * @param userId - User UUID
   * @returns Updated user details
   * @throws AdminServiceError if operation fails
   */
  async blockUser(userId: string): Promise<UserDetails> {
    try {
      await this.userRepo.updateUserStatus(userId, false);
      return await this.getUserDetails(userId);
    } catch (error) {
      throw new AdminServiceError('Failed to block user', error);
    }
  }

  /**
   * Unblock user (set is_active = true)
   *
   * @param userId - User UUID
   * @returns Updated user details
   * @throws AdminServiceError if operation fails
   */
  async unblockUser(userId: string): Promise<UserDetails> {
    try {
      await this.userRepo.updateUserStatus(userId, true);
      return await this.getUserDetails(userId);
    } catch (error) {
      throw new AdminServiceError('Failed to unblock user', error);
    }
  }

  /**
   * List users with pagination
   *
   * @param limit - Number of users to return (default: 50)
   * @param offset - Number of users to skip (default: 0)
   * @returns Paginated list of users
   * @throws AdminServiceError if operation fails
   */
  async listUsers(limit: number = ADMIN_POLICY.defaultListLimit, offset: number = ADMIN_POLICY.defaultListOffset) {
    try {
      // Validate pagination parameters
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > ADMIN_POLICY.maximumListLimit) {
        throw new AdminServiceError('Limit must be between 1 and 100');
      }

      if (!Number.isSafeInteger(offset) || offset < 0) {
        throw new AdminServiceError('Offset must be non-negative');
      }

      return await this.userRepo.listUsers(limit, offset);
    } catch (error) {
      if (error instanceof AdminServiceError) {
        throw error;
      }
      throw new AdminServiceError('Failed to list users', error);
    }
  }

  /** Create explicit initial users. Existing accounts remain unchanged. */
  async bootstrapUsers(users: BootstrapUser[]): Promise<BootstrapResult> {
    try {
      const existing = await this.existingUserEmails();
      const created: string[] = [];
      let usersSkipped = 0;
      for (const user of users) {
        if (existing.has(user.email.toLowerCase())) {
          usersSkipped++;
          continue;
        }
        const { data, error } = await this.supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        });
        if (error || !data.user) {
          throw new AdminServiceError(`Failed to create auth user: ${user.email}`, error);
        }
        try {
          await this.configureBootstrapUser(data.user.id, user);
        } catch (configurationError) {
          // Remove only the account just created by this operation, so retry can repair it.
          const { error: rollbackError } = await this.supabase.auth.admin.deleteUser(data.user.id);
          if (rollbackError) console.error('[ADMIN] Bootstrap rollback failed:', rollbackError);
          throw configurationError;
        }
        created.push(user.email);
        existing.add(user.email.toLowerCase());
      }
      return { success: true, usersCreated: created.length, usersSkipped, users: created };
    } catch (error) {
      throw new AdminServiceError('Failed to bootstrap users', error);
    }
  }

  private async existingUserEmails(): Promise<Set<string>> {
    const emails = new Set<string>();
    for (let page = 1; ; page++) {
      const { data, error } = await this.supabase.auth.admin.listUsers({ page, perPage: ADMIN_POLICY.userPageSize });
      if (error) throw new AdminServiceError('Failed to list existing users', error);
      for (const user of data.users) if (user.email) emails.add(user.email.toLowerCase());
      if (data.users.length < ADMIN_POLICY.userPageSize) return emails;
    }
  }

  private async configureBootstrapUser(userId: string, user: BootstrapUser): Promise<void> {
    // The auth trigger creates these records in the account-creation transaction.
    const updatedAt = new Date().toISOString();
    const { error: profileError } = await this.supabase.from('user_profiles')
      .update({ tier: user.tier, is_admin: user.isAdmin, is_active: user.isActive, updated_at: updatedAt })
      .eq('id', userId);
    if (profileError) throw new AdminServiceError(`Failed to update profile: ${user.email}`, profileError);

    const { error: quotaError } = await this.supabase.from('user_quotas')
      .update({ tokens_available: user.tokens, tokens_used: 0, updated_at: updatedAt })
      .eq('user_id', userId);
    if (quotaError) throw new AdminServiceError(`Failed to update quota: ${user.email}`, quotaError);

    const { error: purchaseError } = await this.supabase.from('token_purchases')
      .update({ tokens_added: user.tokens, description: user.description })
      .eq('user_id', userId).eq('purchase_type', 'registration');
    if (purchaseError) console.warn(`Failed to update purchase record for ${user.email}:`, purchaseError);
  }
}
