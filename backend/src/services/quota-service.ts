/**
 * Token Quota Service
 * Platform-agnostic token quota management and validation using database
 */

import type { UserProfile } from '../types/auth.types.ts';
import type { QuotaCheckResult } from '../types/quota.types.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QuotaRepository, InsufficientQuotaError as RepoInsufficientQuotaError } from '../repositories/quota.repository.ts';
import { InsufficientQuotaError } from '../errors/quota-errors.ts';

export class QuotaService {
  private quotaRepository: QuotaRepository;

  constructor(supabase: SupabaseClient) {
    this.quotaRepository = new QuotaRepository(supabase);
  }

  /**
   * Check if user has sufficient quota
   *
   * This is a pre-flight check using the user's current token balance
   * from their UserProfile (fetched during authentication).
   *
   * @param user - User profile with token balance
   * @param requiredTokens - Number of tokens required
   * @returns QuotaCheckResult indicating if quota is sufficient
   */
  checkQuota(user: UserProfile, requiredTokens: number): QuotaCheckResult {
    const remaining = user.tokensAvailable;

    // Check if quota exceeded (zero balance)
    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `Token balance exhausted. Please purchase more tokens.`,
      };
    }

    // Check if sufficient for request
    if (remaining < requiredTokens) {
      return {
        allowed: false,
        reason: `Insufficient tokens. Required: ${requiredTokens}, Available: ${remaining}`,
      };
    }

    return {
      allowed: true,
    };
  }

  /**
   * Require quota (throws on failure)
   *
   * Convenience method that checks quota and throws error if insufficient.
   *
   * @param user - User profile with token balance
   * @param requiredTokens - Number of tokens required (default: 1)
   * @throws InsufficientQuotaError if quota insufficient
   */
  requireQuota(user: UserProfile, requiredTokens: number = 1): void {
    const result = this.checkQuota(user, requiredTokens);

    if (!result.allowed) {
      throw new InsufficientQuotaError(requiredTokens, user.tokensAvailable);
    }
  }

  /**
   * Report token usage (post-flight deduction)
   *
   * This replaces the previous external User Service integration.
   * Deducts tokens from user's balance in the database using atomic operation.
   *
   * @param userId - User ID to report usage for
   * @param tokensUsed - Number of tokens consumed
   * @param model - Model identifier (for logging/analytics)
   * @returns True if deduction successful
   * @throws InsufficientQuotaError if insufficient balance
   */
  async reportUsage(
    userId: string,
    tokensUsed: number,
    model: string
  ): Promise<boolean> {
    try {
      // Deduct tokens from database using atomic operation
      const success = await this.quotaRepository.deductTokens(userId, tokensUsed);

      if (success) {
        console.log(
          `[QUOTA] Deducted ${tokensUsed} tokens from user ${userId} (model: ${model})`
        );
      }

      return success;
    } catch (error) {
      // Re-throw InsufficientQuotaError
      if (error instanceof RepoInsufficientQuotaError) {
        throw new InsufficientQuotaError(
          error.tokensRequired,
          error.tokensAvailable
        );
      }

      // Log other errors but don't crash
      console.error('[QUOTA] Failed to report usage:', error);
      return false;
    }
  }

  /**
   * Estimate tokens for text (rough approximation)
   * Rule of thumb: 1 token ≈ 4 characters
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate tokens for batch request
   */
  estimateBatchTokens(texts: string[]): number {
    const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
    return Math.ceil(totalChars / 4);
  }
}
