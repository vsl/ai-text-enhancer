/**
 * Payment Processing Errors
 * Platform-agnostic error classes for payment operations
 */

/**
 * Base error class for payment-related errors
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Thrown when an invalid package ID is provided
 *
 * @example
 * ```typescript
 * throw new InvalidPackageError('invalid-package');
 * // Error: Invalid package ID: invalid-package
 * ```
 */
export class InvalidPackageError extends PaymentError {
  constructor(packageId: string) {
    super(
      `Invalid package ID: ${packageId}`,
      'INVALID_PACKAGE_ID',
      400
    );
    this.name = 'InvalidPackageError';
  }
}

/**
 * Thrown when an anonymous user attempts to purchase tokens
 *
 * Anonymous users cannot purchase tokens because:
 * - They lose access if browser storage is cleared
 * - No email for Stripe receipts
 * - Cannot verify ownership for support issues
 *
 * @example
 * ```typescript
 * if (user.auth_provider === 'anonymous') {
 *   throw new AnonymousPurchaseNotAllowedError();
 * }
 * ```
 */
export class AnonymousPurchaseNotAllowedError extends PaymentError {
  constructor() {
    super(
      'Anonymous users cannot purchase tokens. Please create a permanent account first.',
      'ANONYMOUS_PURCHASE_NOT_ALLOWED',
      403
    );
    this.name = 'AnonymousPurchaseNotAllowedError';
  }
}

/**
 * Thrown when Stripe webhook signature verification fails
 *
 * This prevents processing of fraudulent webhook events.
 * Should always return 400 status to prevent Stripe retries.
 *
 * @example
 * ```typescript
 * const signature = request.headers.get('stripe-signature');
 * if (!isValidSignature(signature, body)) {
 *   throw new InvalidWebhookSignatureError();
 * }
 * ```
 */
export class InvalidWebhookSignatureError extends PaymentError {
  constructor() {
    super(
      'Invalid webhook signature',
      'INVALID_WEBHOOK_SIGNATURE',
      400
    );
    this.name = 'InvalidWebhookSignatureError';
  }
}

/**
 * Thrown when payment processing fails
 *
 * Generic error for any payment processing issues that don't
 * fit into more specific categories (e.g., database errors,
 * Stripe API failures, etc.).
 *
 * @example
 * ```typescript
 * try {
 *   await stripe.checkout.sessions.create(params);
 * } catch (error) {
 *   throw new PaymentProcessingError(
 *     `Failed to create checkout session: ${error.message}`
 *   );
 * }
 * ```
 */
export class PaymentProcessingError extends PaymentError {
  constructor(message: string) {
    super(
      message,
      'PAYMENT_PROCESSING_ERROR',
      500
    );
    this.name = 'PaymentProcessingError';
  }
}
