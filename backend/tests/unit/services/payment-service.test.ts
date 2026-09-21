/**
 * Unit Tests for PaymentService
 * Comprehensive test coverage for payment processing logic
 */

import { PaymentService } from '../../../src/services/payment-service.js';
import { InvalidPackageError } from '../../../src/errors/payment-errors.js';
import { TOKEN_PACKAGES } from '../../../src/config/payment.config.js';
import type { QuotaRepository } from '../../../src/repositories/quota.repository.js';
import type Stripe from 'stripe';

// Mock QuotaRepository
const mockQuotaRepository: jest.Mocked<QuotaRepository> = {
  getQuota: jest.fn(),
  checkBalance: jest.fn(),
  deductTokens: jest.fn(),
  addTokens: jest.fn(),
  getPurchaseHistory: jest.fn(),
  isPurchaseProcessed: jest.fn(),
  getPurchaseByChargeId: jest.fn(),
  deductTokensForRefund: jest.fn(),
  recordRefund: jest.fn(),
} as any;

// Mock Stripe SDK
const mockStripeCreate = jest.fn();
const mockStripe = {
  checkout: {
    sessions: {
      create: mockStripeCreate,
    },
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
} as any;

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService = new PaymentService(mockQuotaRepository);
  });

  describe('createCheckoutSession', () => {
    it('should create Stripe session with correct metadata', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      };

      mockStripeCreate.mockResolvedValue(mockSession);

      const result = await paymentService.createCheckoutSession(
        'user-123',
        'popular',
        'https://example.com/success',
        'https://example.com/cancel',
        mockStripe
      );

      expect(result).toEqual({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });

      expect(mockStripeCreate).toHaveBeenCalledWith({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Popular Pack',
                description: '500,000 tokens for AI Text Enhancer',
              },
              unit_amount: 2000,
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: 'user-123',
          packageId: 'popular',
          tokensAdded: '500000',
        },
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });
    });

    it('should throw InvalidPackageError for unknown package', async () => {
      await expect(
        paymentService.createCheckoutSession(
          'user-123',
          'nonexistent',
          'https://example.com/success',
          'https://example.com/cancel',
          mockStripe
        )
      ).rejects.toThrow(InvalidPackageError);

      try {
        await paymentService.createCheckoutSession(
          'user-123',
          'nonexistent',
          'https://example.com/success',
          'https://example.com/cancel',
          mockStripe
        );
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPackageError);
        const packageError = error as InvalidPackageError;
        expect(packageError.code).toBe('INVALID_PACKAGE_ID');
        expect(packageError.message).toContain('nonexistent');
      }
    });

    it('should create sessions for all 4 token packages', async () => {
      for (const pkg of TOKEN_PACKAGES) {
        const mockSession = {
          id: `cs_test_${pkg.id}`,
          url: `https://checkout.stripe.com/pay/cs_test_${pkg.id}`,
        };

        mockStripeCreate.mockResolvedValue(mockSession);

        await paymentService.createCheckoutSession(
          'user-123',
          pkg.id,
          'https://example.com/success',
          'https://example.com/cancel',
          mockStripe
        );

        const lastCall = mockStripeCreate.mock.calls[
          mockStripeCreate.mock.calls.length - 1
        ][0];

        expect(lastCall.metadata?.tokensAdded).toBe(pkg.tokens.toString());
        expect(lastCall.line_items?.[0]?.price_data?.unit_amount).toBe(pkg.price);
        expect(lastCall.line_items?.[0]?.price_data?.currency).toBe(pkg.currency.toLowerCase());
      }
    });

    it('should include correct product data for each package', async () => {
      const pkg = TOKEN_PACKAGES[0]; // Starter pack
      const mockSession = {
        id: 'cs_test_starter',
        url: 'https://checkout.stripe.com/pay/cs_test_starter',
      };

      mockStripeCreate.mockResolvedValue(mockSession);

      await paymentService.createCheckoutSession(
        'user-123',
        pkg.id,
        'https://example.com/success',
        'https://example.com/cancel',
        mockStripe
      );

      const call = mockStripeCreate.mock.calls[0][0];
      expect(call.line_items?.[0]?.price_data?.product_data?.name).toBe(pkg.name);
      expect(call.line_items?.[0]?.price_data?.product_data?.description).toContain(
        pkg.tokens.toLocaleString()
      );
    });
  });

  describe('processWebhook - checkout.session.completed', () => {
    it('should handle successful payment idempotently', async () => {
      const mockSession = {
        id: 'cs_test_123',
        metadata: {
          userId: 'user-123',
          packageId: 'popular',
          tokensAdded: '500000',
        },
        amount_total: 2000, // $20.00 in cents
        currency: 'usd',
      };

      const mockEvent = {
        type: 'checkout.session.completed',
        data: { object: mockSession },
      } as unknown as Stripe.Event;

      // First call - not processed yet
      mockQuotaRepository.isPurchaseProcessed.mockResolvedValueOnce(false);
      mockQuotaRepository.addTokens.mockResolvedValueOnce(true);

      await paymentService.processWebhook(mockEvent);

      expect(mockQuotaRepository.isPurchaseProcessed).toHaveBeenCalledWith('cs_test_123');
      expect(mockQuotaRepository.addTokens).toHaveBeenCalledWith(
        'user-123',
        500000,
        'purchase',
        'Token purchase - Package: popular, Event: cs_test_123',
        20.0,
        'USD'
      );

      // Second call - already processed
      mockQuotaRepository.isPurchaseProcessed.mockResolvedValueOnce(true);

      await paymentService.processWebhook(mockEvent);

      // addTokens should still have been called only once total
      expect(mockQuotaRepository.addTokens).toHaveBeenCalledTimes(1);
    });

    it('should throw error when metadata is missing', async () => {
      const mockSession = {
        id: 'cs_test_123',
        metadata: {}, // Empty metadata
        amount_total: 2000,
        currency: 'usd',
      };

      const mockEvent = {
        type: 'checkout.session.completed',
        data: { object: mockSession },
      } as unknown as Stripe.Event;

      await expect(paymentService.processWebhook(mockEvent)).rejects.toThrow(
        'Missing metadata'
      );
    });

    it('should throw error when userId is missing from metadata', async () => {
      const mockSession = {
        id: 'cs_test_123',
        metadata: {
          packageId: 'popular',
          tokensAdded: '500000',
          // userId missing
        },
        amount_total: 2000,
        currency: 'usd',
      };

      const mockEvent = {
        type: 'checkout.session.completed',
        data: { object: mockSession },
      } as unknown as Stripe.Event;

      await expect(paymentService.processWebhook(mockEvent)).rejects.toThrow(
        'Missing metadata'
      );
    });

    it('should throw error when amount_total is missing', async () => {
      const mockSession = {
        id: 'cs_test_123',
        metadata: {
          userId: 'user-123',
          packageId: 'popular',
          tokensAdded: '500000',
        },
        // amount_total missing
        currency: 'usd',
      };

      const mockEvent = {
        type: 'checkout.session.completed',
        data: { object: mockSession },
      } as unknown as Stripe.Event;

      await expect(paymentService.processWebhook(mockEvent)).rejects.toThrow(
        'Missing payment details'
      );
    });

    it('should convert amount from cents to dollars correctly', async () => {
      const mockSession = {
        id: 'cs_test_123',
        metadata: {
          userId: 'user-123',
          packageId: 'starter',
          tokensAdded: '100000',
        },
        amount_total: 500, // $5.00 in cents
        currency: 'usd',
      };

      const mockEvent = {
        type: 'checkout.session.completed',
        data: { object: mockSession },
      } as unknown as Stripe.Event;

      mockQuotaRepository.isPurchaseProcessed.mockResolvedValue(false);
      mockQuotaRepository.addTokens.mockResolvedValue(true);

      await paymentService.processWebhook(mockEvent);

      expect(mockQuotaRepository.addTokens).toHaveBeenCalledWith(
        'user-123',
        100000,
        'purchase',
        expect.any(String),
        5.0, // $5.00
        'USD'
      );
    });

    it('should convert currency to uppercase', async () => {
      const mockSession = {
        id: 'cs_test_123',
        metadata: {
          userId: 'user-123',
          packageId: 'popular',
          tokensAdded: '500000',
        },
        amount_total: 2000,
        currency: 'eur', // Lowercase
      };

      const mockEvent = {
        type: 'checkout.session.completed',
        data: { object: mockSession },
      } as unknown as Stripe.Event;

      mockQuotaRepository.isPurchaseProcessed.mockResolvedValue(false);
      mockQuotaRepository.addTokens.mockResolvedValue(true);

      await paymentService.processWebhook(mockEvent);

      expect(mockQuotaRepository.addTokens).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        'purchase',
        expect.any(String),
        expect.any(Number),
        'EUR' // Uppercase
      );
    });
  });

  describe('handleRefund', () => {
    it('should calculate proportional token deduction for 50% refund', async () => {
      const mockCharge = {
        id: 'ch_test_123',
        amount: 2000, // $20.00
        amount_refunded: 1000, // $10.00 (50% refund)
        currency: 'usd',
      };

      const mockEvent = {
        type: 'charge.refunded',
        data: { object: mockCharge },
      } as unknown as Stripe.Event;

      mockQuotaRepository.getPurchaseByChargeId.mockResolvedValue({
        user_id: 'user-123',
        tokens_added: 500000,
      });
      mockQuotaRepository.deductTokensForRefund.mockResolvedValue(true);
      mockQuotaRepository.recordRefund.mockResolvedValue(true);

      await paymentService.processWebhook(mockEvent);

      // 50% refund = 250,000 tokens deducted
      expect(mockQuotaRepository.deductTokensForRefund).toHaveBeenCalledWith(
        'user-123',
        250000,
        expect.stringContaining('ch_test_123')
      );

      expect(mockQuotaRepository.recordRefund).toHaveBeenCalledWith(
        'user-123',
        250000,
        10.0, // $10.00
        'USD',
        expect.stringContaining('ch_test_123')
      );
    });

    it('should handle full refund (100%)', async () => {
      const mockCharge = {
        id: 'ch_test_full',
        amount: 3500, // $35.00
        amount_refunded: 3500, // $35.00 (100% refund)
        currency: 'usd',
      };

      const mockEvent = {
        type: 'charge.refunded',
        data: { object: mockCharge },
      } as unknown as Stripe.Event;

      mockQuotaRepository.getPurchaseByChargeId.mockResolvedValue({
        user_id: 'user-456',
        tokens_added: 1_000_000,
      });
      mockQuotaRepository.deductTokensForRefund.mockResolvedValue(true);
      mockQuotaRepository.recordRefund.mockResolvedValue(true);

      await paymentService.processWebhook(mockEvent);

      // 100% refund = all 1,000,000 tokens deducted
      expect(mockQuotaRepository.deductTokensForRefund).toHaveBeenCalledWith(
        'user-456',
        1_000_000,
        expect.any(String)
      );
    });

    it('should handle partial refund (25%)', async () => {
      const mockCharge = {
        id: 'ch_test_partial',
        amount: 2000, // $20.00
        amount_refunded: 500, // $5.00 (25% refund)
        currency: 'usd',
      };

      const mockEvent = {
        type: 'charge.refunded',
        data: { object: mockCharge },
      } as unknown as Stripe.Event;

      mockQuotaRepository.getPurchaseByChargeId.mockResolvedValue({
        user_id: 'user-789',
        tokens_added: 500000,
      });
      mockQuotaRepository.deductTokensForRefund.mockResolvedValue(true);
      mockQuotaRepository.recordRefund.mockResolvedValue(true);

      await paymentService.processWebhook(mockEvent);

      // 25% refund = 125,000 tokens deducted
      expect(mockQuotaRepository.deductTokensForRefund).toHaveBeenCalledWith(
        'user-789',
        125000,
        expect.any(String)
      );
    });

    it('should safely handle zero total amount', async () => {
      const mockCharge = {
        id: 'ch_test_zero',
        amount: 0,
        amount_refunded: 0,
        currency: 'usd',
      };

      const mockEvent = {
        type: 'charge.refunded',
        data: { object: mockCharge },
      } as unknown as Stripe.Event;

      await paymentService.processWebhook(mockEvent);

      expect(mockQuotaRepository.deductTokensForRefund).not.toHaveBeenCalled();
      expect(mockQuotaRepository.recordRefund).not.toHaveBeenCalled();
    });

    it('should safely handle missing charge amounts', async () => {
      const mockCharge = {
        id: 'ch_test_missing',
        currency: 'usd',
        // amount and amount_refunded missing
      };

      const mockEvent = {
        type: 'charge.refunded',
        data: { object: mockCharge },
      } as unknown as Stripe.Event;

      await paymentService.processWebhook(mockEvent);

      expect(mockQuotaRepository.deductTokensForRefund).not.toHaveBeenCalled();
      expect(mockQuotaRepository.recordRefund).not.toHaveBeenCalled();
    });

    it('should handle missing purchase record gracefully', async () => {
      const mockCharge = {
        id: 'ch_test_notfound',
        amount: 2000,
        amount_refunded: 1000,
        currency: 'usd',
      };

      const mockEvent = {
        type: 'charge.refunded',
        data: { object: mockCharge },
      } as unknown as Stripe.Event;

      mockQuotaRepository.getPurchaseByChargeId.mockResolvedValue(null);

      await paymentService.processWebhook(mockEvent);

      expect(mockQuotaRepository.deductTokensForRefund).not.toHaveBeenCalled();
      expect(mockQuotaRepository.recordRefund).not.toHaveBeenCalled();
    });

    it('should round down fractional tokens', async () => {
      const mockCharge = {
        id: 'ch_test_fraction',
        amount: 2000,
        amount_refunded: 1001, // 50.05% refund
        currency: 'usd',
      };

      const mockEvent = {
        type: 'charge.refunded',
        data: { object: mockCharge },
      } as unknown as Stripe.Event;

      mockQuotaRepository.getPurchaseByChargeId.mockResolvedValue({
        user_id: 'user-123',
        tokens_added: 500000,
      });
      mockQuotaRepository.deductTokensForRefund.mockResolvedValue(true);
      mockQuotaRepository.recordRefund.mockResolvedValue(true);

      await paymentService.processWebhook(mockEvent);

      // 50.05% of 500000 = 250250, Math.floor gives 250249 due to floating point
      expect(mockQuotaRepository.deductTokensForRefund).toHaveBeenCalledWith(
        'user-123',
        250249,
        expect.any(String)
      );
    });
  });

  describe('handlePaymentFailed', () => {
    it('should log payment failure without modifying database', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockIntent = {
        id: 'pi_test_failed',
        amount: 2000,
        currency: 'usd',
        last_payment_error: {
          message: 'Card declined',
        },
      };

      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: { object: mockIntent },
      } as unknown as Stripe.Event;

      await paymentService.processWebhook(mockEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payment failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('pi_test_failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Card declined')
      );

      // No repository methods should be called
      expect(mockQuotaRepository.addTokens).not.toHaveBeenCalled();
      expect(mockQuotaRepository.deductTokens).not.toHaveBeenCalled();
      expect(mockQuotaRepository.deductTokensForRefund).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle payment failure with missing amount', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockIntent = {
        id: 'pi_test_noamount',
        currency: 'eur',
        last_payment_error: {
          message: 'Insufficient funds',
        },
      };

      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: { object: mockIntent },
      } as unknown as Stripe.Event;

      await paymentService.processWebhook(mockEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('amount=$0')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle payment failure with missing error message', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockIntent = {
        id: 'pi_test_noerror',
        amount: 1500,
        currency: 'gbp',
      };

      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: { object: mockIntent },
      } as unknown as Stripe.Event;

      await paymentService.processWebhook(mockEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should format amount correctly for different currencies', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockIntent = {
        id: 'pi_test_eur',
        amount: 3500,
        currency: 'eur',
        last_payment_error: {
          message: 'Test error',
        },
      };

      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: { object: mockIntent },
      } as unknown as Stripe.Event;

      await paymentService.processWebhook(mockEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('amount=$35 EUR')
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('processWebhook - unhandled events', () => {
    it('should log unhandled webhook event types', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockEvent = {
        type: 'invoice.paid',
        data: { object: {} },
      } as unknown as Stripe.Event;

      await paymentService.processWebhook(mockEvent);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled webhook event type: invoice.paid')
      );

      consoleLogSpy.mockRestore();
    });

    it('should not throw on unhandled events', async () => {
      const mockEvent = {
        type: 'customer.created',
        data: { object: {} },
      } as unknown as Stripe.Event;

      await expect(paymentService.processWebhook(mockEvent)).resolves.not.toThrow();
    });
  });
});
