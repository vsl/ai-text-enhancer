/**
 * Quota Repository
 * Platform-agnostic database operations for token quota management
 *
 * This repository encapsulates all SQL queries related to token balance,
 * deductions, and purchase history. Uses database helper functions for
 * atomic operations (check_user_quota, deduct_tokens, add_tokens).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * User quota information
 */
export interface UserQuota {
  userId: string;
  tokensAvailable: number;
  tokensUsed: number;
  lastUsedAt: string | null;
}

/**
 * Token purchase transaction record
 */
export interface TokenPurchase {
  id: string;
  userId: string;
  tokensAdded: number;
  purchaseType: 'registration' | 'purchase' | 'admin_grant' | 'bonus' | 'refund';
  amountPaid: number | null;
  currency: string;
  description: string | null;
  createdAt: string;
}

/**
 * Purchase history result
 */
export interface PurchaseHistory {
  purchases: TokenPurchase[];
  total: number;
}

/**
 * Quota Repository Error
 */
export class QuotaRepositoryError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'QuotaRepositoryError';
  }
}

/**
 * Insufficient quota error
 */
export class InsufficientQuotaError extends QuotaRepositoryError {
  constructor(
    public tokensRequired: number,
    public tokensAvailable: number
  ) {
    super(
      `Insufficient quota. Required: ${tokensRequired}, Available: ${tokensAvailable}`
    );
    this.name = 'InsufficientQuotaError';
  }
}

export class QuotaRepository {
  constructor(protected supabase: SupabaseClient) {}

  /**
   * Get user's current token quota
   *
   * @param userId - User UUID
   * @returns Current token balance
   * @throws QuotaRepositoryError if user not found or database error
   */
  async getQuota(userId: string): Promise<UserQuota> {
    try {
      const { data, error } = await this.supabase
        .from('user_quotas')
        .select('user_id, tokens_available, tokens_used, last_used_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        throw new QuotaRepositoryError(
          `Failed to fetch quota: ${error.message}`,
          error
        );
      }

      if (!data) {
        throw new QuotaRepositoryError(`Quota not found for user: ${userId}`);
      }

      return {
        userId: data.user_id,
        tokensAvailable: data.tokens_available,
        tokensUsed: data.tokens_used,
        lastUsedAt: data.last_used_at,
      };
    } catch (error) {
      if (error instanceof QuotaRepositoryError) {
        throw error;
      }
      throw new QuotaRepositoryError('Failed to get quota', error);
    }
  }

  /**
   * Check if user has sufficient token balance
   *
   * Uses database function check_user_quota() for consistency
   *
   * @param userId - User UUID
   * @param tokensRequired - Number of tokens needed
   * @returns True if user has sufficient balance
   * @throws QuotaRepositoryError if database error
   */
  async checkBalance(userId: string, tokensRequired: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('check_user_quota', {
        p_user_id: userId,
        p_tokens_required: tokensRequired,
      });

      if (error) {
        throw new QuotaRepositoryError(
          `Failed to check quota: ${error.message}`,
          error
        );
      }

      return data === true;
    } catch (error) {
      if (error instanceof QuotaRepositoryError) {
        throw error;
      }
      throw new QuotaRepositoryError('Failed to check balance', error);
    }
  }

  /**
   * Atomically deduct tokens from user's balance
   *
   * Uses database function deduct_tokens() for atomic operation with row locking
   *
   * @param userId - User UUID
   * @param tokensUsed - Number of tokens to deduct
   * @returns True if deduction successful
   * @throws InsufficientQuotaError if insufficient balance
   * @throws QuotaRepositoryError if user not found or database error
   */
  async deductTokens(userId: string, tokensUsed: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('deduct_tokens', {
        p_user_id: userId,
        p_tokens_used: tokensUsed,
      });

      if (error) {
        throw new QuotaRepositoryError(
          `Failed to deduct tokens: ${error.message}`,
          error
        );
      }

      if (data === false) {
        // Function returns false for insufficient balance or user not found
        // Check which case it is
        const quota = await this.getQuota(userId).catch(() => null);

        if (!quota) {
          throw new QuotaRepositoryError(`User not found: ${userId}`);
        }

        throw new InsufficientQuotaError(tokensUsed, quota.tokensAvailable);
      }

      return true;
    } catch (error) {
      if (
        error instanceof QuotaRepositoryError ||
        error instanceof InsufficientQuotaError
      ) {
        throw error;
      }
      throw new QuotaRepositoryError('Failed to deduct tokens', error);
    }
  }

  /**
   * Add tokens to user's balance and record transaction
   *
   * Uses database function add_tokens() for atomic operation
   *
   * @param userId - User UUID
   * @param tokensAdded - Number of tokens to add
   * @param purchaseType - Type of transaction
   * @param description - Optional description
   * @param amountPaid - Optional payment amount
   * @param currency - Currency code (default: 'USD')
   * @returns True if addition successful
   * @throws QuotaRepositoryError if user not found or database error
   */
  async addTokens(
    userId: string,
    tokensAdded: number,
    purchaseType: 'registration' | 'purchase' | 'admin_grant' | 'bonus' | 'refund',
    description?: string,
    amountPaid?: number,
    currency: string = 'USD'
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('add_tokens', {
        p_user_id: userId,
        p_tokens_added: tokensAdded,
        p_purchase_type: purchaseType,
        p_description: description || null,
        p_amount_paid: amountPaid || null,
        p_currency: currency,
      });

      if (error) {
        throw new QuotaRepositoryError(
          `Failed to add tokens: ${error.message}`,
          error
        );
      }

      if (data === false) {
        throw new QuotaRepositoryError(`User not found: ${userId}`);
      }

      return true;
    } catch (error) {
      if (error instanceof QuotaRepositoryError) {
        throw error;
      }
      throw new QuotaRepositoryError('Failed to add tokens', error);
    }
  }

  /**
   * Get purchase history for user
   *
   * @param userId - User UUID
   * @param limit - Number of records to return (default: 50)
   * @returns Purchase history
   * @throws QuotaRepositoryError if database error
   */
  async getPurchaseHistory(
    userId: string,
    limit: number = 50
  ): Promise<PurchaseHistory> {
    try {
      // Get total count
      const { count, error: countError } = await this.supabase
        .from('token_purchases')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        throw new QuotaRepositoryError(
          `Failed to count purchases: ${countError.message}`,
          countError
        );
      }

      // Get purchases
      const { data, error } = await this.supabase
        .from('token_purchases')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new QuotaRepositoryError(
          `Failed to fetch purchase history: ${error.message}`,
          error
        );
      }

      const purchases: TokenPurchase[] = (data || []).map((record) => ({
        id: record.id,
        userId: record.user_id,
        tokensAdded: record.tokens_added,
        purchaseType: record.purchase_type as TokenPurchase['purchaseType'],
        amountPaid: record.amount_paid,
        currency: record.currency,
        description: record.description,
        createdAt: record.created_at,
      }));

      return {
        purchases,
        total: count || 0,
      };
    } catch (error) {
      if (error instanceof QuotaRepositoryError) {
        throw error;
      }
      throw new QuotaRepositoryError('Failed to get purchase history', error);
    }
  }

}
