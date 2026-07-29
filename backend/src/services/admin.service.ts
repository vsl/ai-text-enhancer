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
 * Bootstrap user configuration
 */
interface BootstrapUser {
  email: string;
  password: string;
  tier: UserTier;
  isAdmin: boolean;
  tokens: number;
  isActive: boolean;
  description: string;
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
      const { purchases } = await this.quotaRepo.getPurchaseHistory(userId, 10);

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
  async listUsers(limit: number = 50, offset: number = 0) {
    try {
      // Validate pagination parameters
      if (limit < 1 || limit > 100) {
        throw new AdminServiceError('Limit must be between 1 and 100');
      }

      if (offset < 0) {
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

  /**
   * Bootstrap predefined test users
   *
   * Creates 6 predefined users for development/testing:
   * 1. admin@textenhancer.dev - Admin user (premium, 10M tokens)
   * 2. free@textenhancer.dev - Free tier (50k tokens)
   * 3. plus@textenhancer.dev - Plus tier (500k tokens)
   * 4. premium@textenhancer.dev - Premium tier (5M tokens)
   * 5. zero@textenhancer.dev - Zero balance (0 tokens)
   * 6. blocked@textenhancer.dev - Blocked user (10k tokens)
   *
   * This method is IDEMPOTENT - safe to run multiple times.
   * It will skip users that already exist.
   *
   * @returns Bootstrap result with count of created/skipped users
   * @throws AdminServiceError if operation fails
   */
  async bootstrapUsers(): Promise<BootstrapResult> {
    const bootstrapUsers: BootstrapUser[] = [
      {
        email: 'admin@textenhancer.dev',
        password: 'Admin_2025_Secure!',
        tier: 'premium',
        isAdmin: true,
        tokens: 10_000_000,
        isActive: true,
        description: 'Admin user - initial token grant (10M tokens)',
      },
      {
        email: 'free@textenhancer.dev',
        password: 'Free_User_2025',
        tier: 'free',
        isAdmin: false,
        tokens: 50_000,
        isActive: true,
        description: 'Free tier user - welcome bonus (50k tokens)',
      },
      {
        email: 'plus@textenhancer.dev',
        password: 'Plus_User_2025',
        tier: 'plus',
        isAdmin: false,
        tokens: 500_000,
        isActive: true,
        description: 'Plus tier user - initial token grant (500k tokens)',
      },
      {
        email: 'premium@textenhancer.dev',
        password: 'Premium_User_2025',
        tier: 'premium',
        isAdmin: false,
        tokens: 5_000_000,
        isActive: true,
        description: 'Premium tier user - initial token grant (5M tokens)',
      },
      {
        email: 'zero@textenhancer.dev',
        password: 'Zero_Tokens_2025',
        tier: 'free',
        isAdmin: false,
        tokens: 0,
        isActive: true,
        description: 'Zero balance user - for quota testing',
      },
      {
        email: 'blocked@textenhancer.dev',
        password: 'Blocked_User_2025',
        tier: 'free',
        isAdmin: false,
        tokens: 10_000,
        isActive: false,
        description: 'Blocked user - for access denial testing',
      },
    ];

    let usersCreated = 0;
    let usersSkipped = 0;
    const createdEmails: string[] = [];

    try {
      for (const userData of bootstrapUsers) {
        try {
          // Check if user already exists
          const { data: existingUser } = await this.supabase.auth.admin.listUsers();
          const userExists = existingUser?.users.some(
            (u) => u.email === userData.email
          );

          if (userExists) {
            console.log(`User already exists: ${userData.email}`);
            usersSkipped++;
            continue;
          }

          // Create user in auth.users
          const { data: authUser, error: authError } =
            await this.supabase.auth.admin.createUser({
              email: userData.email,
              password: userData.password,
              email_confirm: true,
              user_metadata: {},
            });

          if (authError || !authUser.user) {
            throw new AdminServiceError(
              `Failed to create auth user: ${userData.email}`,
              authError
            );
          }

          const userId = authUser.user.id;

          // The trigger handle_new_user will auto-create:
          // - user_profiles (default: tier='free', is_admin=false, is_active=true)
          // - user_quotas (default: tokens_available=50000)
          // - token_purchases (welcome bonus record)

          // Wait a moment for trigger to complete
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Update profile for non-default values
          if (
            userData.tier !== 'free' ||
            userData.isAdmin !== false ||
            userData.isActive !== true
          ) {
            const { error: profileError } = await this.supabase
              .from('user_profiles')
              .update({
                tier: userData.tier,
                is_admin: userData.isAdmin,
                is_active: userData.isActive,
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId);

            if (profileError) {
              throw new AdminServiceError(
                `Failed to update profile: ${userData.email}`,
                profileError
              );
            }
          }

          // Update quota for non-default token amounts
          if (userData.tokens !== 50_000) {
            if (userData.tokens === 0) {
              // For zero balance, set tokens_available=0 and tokens_used=50000
              const { error: quotaError } = await this.supabase
                .from('user_quotas')
                .update({
                  tokens_available: 0,
                  tokens_used: 50_000,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

              if (quotaError) {
                throw new AdminServiceError(
                  `Failed to update quota: ${userData.email}`,
                  quotaError
                );
              }
            } else {
              // For other amounts, update tokens_available
              const { error: quotaError } = await this.supabase
                .from('user_quotas')
                .update({
                  tokens_available: userData.tokens,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

              if (quotaError) {
                throw new AdminServiceError(
                  `Failed to update quota: ${userData.email}`,
                  quotaError
                );
              }
            }
          }

          // Update purchase record description
          const { error: purchaseError } = await this.supabase
            .from('token_purchases')
            .update({
              tokens_added: userData.tokens === 0 ? 50_000 : userData.tokens,
              description: userData.description,
            })
            .eq('user_id', userId)
            .eq('purchase_type', 'registration');

          if (purchaseError) {
            console.warn(
              `Failed to update purchase record for ${userData.email}:`,
              purchaseError
            );
            // Don't fail the entire operation for this
          }

          console.log(`Created user: ${userData.email}`);
          usersCreated++;
          createdEmails.push(userData.email);
        } catch (error) {
          console.error(`Failed to create user ${userData.email}:`, error);
          throw error;
        }
      }

      return {
        success: true,
        usersCreated,
        usersSkipped,
        users: createdEmails,
      };
    } catch (error) {
      throw new AdminServiceError('Failed to bootstrap users', error);
    }
  }
}
