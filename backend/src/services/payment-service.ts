/**
 * Payment Service (Platform-Agnostic)
 *
 * Core payment processing logic for token purchases via Stripe Checkout.
 * This service is completely platform-agnostic - it uses only standard
 * TypeScript/JavaScript and can be tested in Node.js.
 *
 * Responsibilities:
 * - Create Stripe checkout sessions for token purchases
 * - Process Stripe webhook events (payments, refunds, failures)
 * - Ensure idempotency for webhook processing
 * - Calculate proportional token deductions for refunds
 *
 * The handler layer (Edge Function) is responsible for:
 * - Extracting request data and webhook signatures
 * - Calling this service with injected Stripe instance
 * - Formatting responses
 */

import type Stripe from 'stripe';
import type { QuotaRepository } from '../repositories/quota.repository.ts';
import { getPackageById } from '../config/payment.config.ts';
import { InvalidPackageError } from '../errors/payment-errors.ts';

/**
 * Checkout session creation result
 */
export interface CheckoutSessionResult {
  /** Stripe checkout session ID */
  id: string;
  /** Stripe-hosted checkout page URL */
  url: string;
}

/**
 * PaymentService handles all payment processing logic
 *
 * This service is completely platform-agnostic and can be used
 * in any runtime (Deno, Node.js, Cloudflare Workers, etc.)
 */
export class PaymentService {
  constructor(private quotaRepository: QuotaRepository) {}

  /**
   * Create a Stripe checkout session for token purchase
   *
   * Creates a Stripe-hosted payment page for the user to complete
   * the purchase. The session includes metadata (userId, packageId,
   * tokensAdded) that will be used by the webhook to credit tokens
   * after successful payment.
   *
   * @param userId - User UUID
   * @param packageId - Package ID from payment.config.ts
   * @param successUrl - URL to redirect after successful payment
   * @param cancelUrl - URL to redirect if user cancels
   * @param stripe - Injected Stripe instance (platform-specific)
   * @returns Checkout session ID and URL
   * @throws InvalidPackageError if package not found
   *
   * @example
   * ```typescript
   * const result = await paymentService.createCheckoutSession(
   *   userId,
   *   'popular',
   *   'https://example.com/success',
   *   'https://example.com/cancel',
   *   stripe
   * );
   * // Redirect user to result.url
   * ```
   */
  async createCheckoutSession(
    userId: string,
    packageId: string,
    successUrl: string,
    cancelUrl: string,
    stripe: Stripe
  ): Promise<CheckoutSessionResult> {
    // Get package configuration
    const pkg = getPackageById(packageId);
    if (!pkg) {
      throw new InvalidPackageError(packageId);
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: pkg.currency.toLowerCase(),
            product_data: {
              name: pkg.name,
              description: `${pkg.tokens.toLocaleString()} tokens for AI Text Enhancer`,
            },
            unit_amount: pkg.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        packageId,
        tokensAdded: pkg.tokens.toString(),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return {
      id: session.id,
      url: session.url!,
    };
  }

  /**
   * Process Stripe webhook event
   *
   * Routes webhook events to appropriate handlers based on event type.
   * Supports: checkout.session.completed, charge.refunded, payment_intent.payment_failed
   *
   * @param event - Stripe webhook event
   *
   * @example
   * ```typescript
   * const event = stripe.webhooks.constructEvent(body, signature, secret);
   * await paymentService.processWebhook(event);
   * ```
   */
  async processWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'charge.refunded':
        await this.handleRefund(event.data.object as Stripe.Charge);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Handle successful checkout completion
   *
   * Called when a customer successfully completes payment.
   * Credits tokens to user's account and records the purchase.
   * Includes idempotency check to prevent duplicate processing.
   *
   * @param session - Stripe checkout session
   * @private
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    // Validate metadata exists
    const { metadata } = session;
    if (!metadata || !metadata.userId || !metadata.tokensAdded || !metadata.packageId) {
      console.error('Missing metadata in checkout session:', session.id);
      throw new Error(`Missing metadata in checkout session: ${session.id}`);
    }

    const { userId, tokensAdded, packageId } = metadata;

    // Validate payment details
    if (!session.amount_total || !session.currency) {
      console.error('Missing payment details in checkout session:', session.id);
      throw new Error(`Missing payment details in checkout session: ${session.id}`);
    }

    // Convert cents to dollars
    const amountPaid = session.amount_total / 100;
    const currency = session.currency.toUpperCase();

    // Check idempotency - prevent duplicate processing
    const alreadyProcessed = await this.quotaRepository.isPurchaseProcessed(session.id);
    if (alreadyProcessed) {
      console.log(`Checkout session ${session.id} already processed, skipping`);
      return;
    }

    // Add tokens to user's account
    const tokens = parseInt(tokensAdded, 10);
    const description = `Token purchase - Package: ${packageId}, Event: ${session.id}`;

    await this.quotaRepository.addTokens(
      userId,
      tokens,
      'purchase',
      description,
      amountPaid,
      currency
    );

    console.log(
      `Successfully processed checkout: userId=${userId}, tokens=${tokens}, amount=$${amountPaid} ${currency}`
    );
  }

  /**
   * Handle refund event
   *
   * Called when a charge is refunded (full or partial).
   * Calculates proportional token deduction based on refund amount
   * and removes tokens from user's account.
   *
   * @param charge - Stripe charge object
   * @private
   */
  private async handleRefund(charge: Stripe.Charge): Promise<void> {
    // Validate charge amounts
    if (charge.amount == null || charge.amount_refunded == null) {
      console.error('Missing amount data in charge:', charge.id);
      return;
    }

    // Handle zero amount edge case
    if (charge.amount === 0) {
      console.error('Charge has zero amount:', charge.id);
      return;
    }

    // Calculate refund percentage
    const refundPercentage = charge.amount_refunded / charge.amount;

    // Find original purchase by charge ID
    const purchase = await this.quotaRepository.getPurchaseByChargeId(charge.id);
    if (!purchase) {
      console.error(`Original purchase not found for charge: ${charge.id}`);
      return;
    }

    // Calculate tokens to deduct (rounded down)
    const tokensToDeduct = Math.floor(purchase.tokens_added * refundPercentage);

    // Convert cents to dollars
    const refundAmount = charge.amount_refunded / 100;
    const currency = charge.currency.toUpperCase();

    const description = `Refund for charge ${charge.id}, Event: ${charge.id}`;

    // Deduct tokens from user's balance
    await this.quotaRepository.deductTokensForRefund(
      purchase.user_id,
      tokensToDeduct,
      description
    );

    // Record refund transaction
    await this.quotaRepository.recordRefund(
      purchase.user_id,
      tokensToDeduct,
      refundAmount,
      currency,
      description
    );

    console.log(
      `Successfully processed refund: userId=${purchase.user_id}, tokensDeducted=${tokensToDeduct}, refundAmount=$${refundAmount} ${currency}`
    );
  }

  /**
   * Handle payment failure
   *
   * Called when a payment intent fails.
   * Logs the error for monitoring but does not modify database
   * (no tokens to deduct since payment never succeeded).
   *
   * @param intent - Stripe payment intent
   * @private
   */
  private async handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const amount = intent.amount ? intent.amount / 100 : 0;
    const currency = intent.currency?.toUpperCase() || 'USD';
    const errorMessage = intent.last_payment_error?.message || 'Unknown error';

    console.error(
      `Payment failed: intentId=${intent.id}, amount=$${amount} ${currency}, error=${errorMessage}`
    );

    // No database operations needed - payment never succeeded
  }
}
