import { QuotaRepository, QuotaRepositoryError } from '../repositories/quota.repository.ts';

/** Draft payment ledger adapters. Activation requires durable transaction IDs. */
export class PaymentRepository extends QuotaRepository {
  /**
   * Check if a Stripe event has already been processed
   *
   * Used for webhook idempotency - prevents processing the same event twice.
   * Searches token_purchases table for description containing the event ID.
   *
   * TODO: Migrate to use dedicated stripe_event_id column for better performance
   *
   * @param eventId - Stripe event ID (e.g., 'evt_1234...')
   * @returns True if event has been processed, false otherwise
   * @throws QuotaRepositoryError if database error
   */
  async isPurchaseProcessed(eventId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('token_purchases')
        .select('id')
        .like('description', `%Event: ${eventId}%`)
        .maybeSingle();

      if (error) {
        throw new QuotaRepositoryError(
          `Failed to check if purchase processed: ${error.message}`,
          error
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof QuotaRepositoryError) {
        throw error;
      }
      throw new QuotaRepositoryError('Failed to check purchase status', error);
    }
  }

  /**
   * Get purchase record by Stripe charge ID
   *
   * Used for processing refunds - finds original purchase to determine how many
   * tokens to deduct. Searches token_purchases table for description containing
   * the charge ID.
   *
   * TODO: Migrate to use dedicated stripe_charge_id column for better performance
   *
   * @param chargeId - Stripe charge ID (e.g., 'ch_1234...')
   * @returns Object with user_id and tokens_added, or null if not found
   * @throws QuotaRepositoryError if database error
   */
  async getPurchaseByChargeId(
    chargeId: string
  ): Promise<{ user_id: string; tokens_added: number } | null> {
    try {
      const { data, error } = await this.supabase
        .from('token_purchases')
        .select('user_id, tokens_added')
        .like('description', `%charge ${chargeId}%`)
        .maybeSingle();

      if (error) {
        throw new QuotaRepositoryError(
          `Failed to get purchase by charge ID: ${error.message}`,
          error
        );
      }

      return data || null;
    } catch (error) {
      if (error instanceof QuotaRepositoryError) {
        throw error;
      }
      throw new QuotaRepositoryError('Failed to get purchase by charge ID', error);
    }
  }

  /**
   * Deduct tokens from user's balance (wrapper for refund scenarios)
   *
   * This is a convenience method that calls addTokens() with a negative value.
   * Used for processing refunds where tokens need to be removed from balance.
   *
   * @param userId - User UUID
   * @param tokensToDeduct - Number of tokens to deduct (positive number)
   * @param description - Optional description of the deduction
   * @returns True if deduction successful
   * @throws QuotaRepositoryError if user not found or database error
   */
  async deductTokensForRefund(
    userId: string,
    tokensToDeduct: number,
    description?: string
  ): Promise<boolean> {
    return this.addTokens(
      userId,
      -tokensToDeduct,
      'refund',
      description
    );
  }

  /**
   * Record a refund transaction with token deduction
   *
   * Creates a refund record in token_purchases table with negative token amount
   * and negative payment amount (showing money returned to customer).
   *
   * @param userId - User UUID
   * @param tokensDeducted - Number of tokens to deduct (positive number)
   * @param refundAmount - Refund amount (positive number, will be stored as negative)
   * @param currency - Currency code (e.g., 'USD')
   * @param description - Description of the refund (should include event ID)
   * @returns True if refund recorded successfully
   * @throws QuotaRepositoryError if user not found or database error
   */
  async recordRefund(
    userId: string,
    tokensDeducted: number,
    refundAmount: number,
    currency: string,
    description: string
  ): Promise<boolean> {
    return this.addTokens(
      userId,
      -tokensDeducted,
      'refund',
      description,
      -refundAmount,
      currency
    );
  }
}
