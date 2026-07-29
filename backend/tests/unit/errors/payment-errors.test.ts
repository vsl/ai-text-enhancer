/**
 * Unit Tests for Payment Errors
 * Tests custom error classes for payment processing
 */

import {
  PaymentError,
  InvalidPackageError,
  AnonymousPurchaseNotAllowedError,
  InvalidWebhookSignatureError,
  PaymentProcessingError,
} from '../../../src/errors/payment-errors.js';

describe('Payment Errors', () => {
  describe('PaymentError', () => {
    it('should create error with default status code', () => {
      const error = new PaymentError('Test payment error', 'TEST_ERROR');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('PaymentError');
      expect(error.message).toBe('Test payment error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should create error with custom status code', () => {
      const error = new PaymentError('Test error', 'TEST_ERROR', 400);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
    });

    it('should have correct inheritance chain', () => {
      const error = new PaymentError('Test', 'TEST');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PaymentError);
    });
  });

  describe('InvalidPackageError', () => {
    it('should create error with correct properties', () => {
      const error = new InvalidPackageError('invalid-pkg');

      expect(error).toBeInstanceOf(PaymentError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('InvalidPackageError');
      expect(error.code).toBe('INVALID_PACKAGE_ID');
      expect(error.statusCode).toBe(400);
    });

    it('should format message with package ID', () => {
      const error = new InvalidPackageError('nonexistent-package');

      expect(error.message).toContain('Invalid package ID');
      expect(error.message).toContain('nonexistent-package');
    });

    it('should be catchable as PaymentError', () => {
      const error = new InvalidPackageError('test-pkg');

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentError);
        expect(e).toBeInstanceOf(InvalidPackageError);
      }
    });

    it('should work with different package IDs', () => {
      const error1 = new InvalidPackageError('starter');
      const error2 = new InvalidPackageError('premium');

      expect(error1.message).toContain('starter');
      expect(error2.message).toContain('premium');
    });
  });

  describe('AnonymousPurchaseNotAllowedError', () => {
    it('should create error with correct properties', () => {
      const error = new AnonymousPurchaseNotAllowedError();

      expect(error).toBeInstanceOf(PaymentError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AnonymousPurchaseNotAllowedError');
      expect(error.code).toBe('ANONYMOUS_PURCHASE_NOT_ALLOWED');
      expect(error.statusCode).toBe(403);
    });

    it('should have informative message', () => {
      const error = new AnonymousPurchaseNotAllowedError();

      expect(error.message).toContain('Anonymous users cannot purchase tokens');
      expect(error.message).toContain('permanent account');
    });

    it('should be catchable as PaymentError', () => {
      const error = new AnonymousPurchaseNotAllowedError();

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentError);
        expect(e).toBeInstanceOf(AnonymousPurchaseNotAllowedError);
      }
    });

    it('should have 403 Forbidden status code', () => {
      const error = new AnonymousPurchaseNotAllowedError();

      expect(error.statusCode).toBe(403);
    });
  });

  describe('InvalidWebhookSignatureError', () => {
    it('should create error with correct properties', () => {
      const error = new InvalidWebhookSignatureError();

      expect(error).toBeInstanceOf(PaymentError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('InvalidWebhookSignatureError');
      expect(error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
      expect(error.statusCode).toBe(400);
    });

    it('should have informative message', () => {
      const error = new InvalidWebhookSignatureError();

      expect(error.message).toBe('Invalid webhook signature');
    });

    it('should be catchable as PaymentError', () => {
      const error = new InvalidWebhookSignatureError();

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentError);
        expect(e).toBeInstanceOf(InvalidWebhookSignatureError);
      }
    });

    it('should have 400 Bad Request status code to prevent Stripe retries', () => {
      const error = new InvalidWebhookSignatureError();

      // 400 status code prevents Stripe from retrying invalid signatures
      expect(error.statusCode).toBe(400);
    });
  });

  describe('PaymentProcessingError', () => {
    it('should create error with correct properties', () => {
      const error = new PaymentProcessingError('Failed to create session');

      expect(error).toBeInstanceOf(PaymentError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('PaymentProcessingError');
      expect(error.code).toBe('PAYMENT_PROCESSING_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should accept custom error messages', () => {
      const error1 = new PaymentProcessingError('Database connection failed');
      const error2 = new PaymentProcessingError('Stripe API error');

      expect(error1.message).toBe('Database connection failed');
      expect(error2.message).toBe('Stripe API error');
    });

    it('should be catchable as PaymentError', () => {
      const error = new PaymentProcessingError('Test error');

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentError);
        expect(e).toBeInstanceOf(PaymentProcessingError);
      }
    });

    it('should have 500 Internal Server Error status code', () => {
      const error = new PaymentProcessingError('Test');

      expect(error.statusCode).toBe(500);
    });

    it('should preserve detailed error messages', () => {
      const detailedMessage = 'Failed to process payment: Card declined (insufficient funds)';
      const error = new PaymentProcessingError(detailedMessage);

      expect(error.message).toBe(detailedMessage);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize InvalidPackageError to JSON', () => {
      const error = new InvalidPackageError('test-package');

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.name).toBe('InvalidPackageError');
      expect(parsed.code).toBe('INVALID_PACKAGE_ID');
      expect(parsed.statusCode).toBe(400);
    });

    it('should serialize AnonymousPurchaseNotAllowedError to JSON', () => {
      const error = new AnonymousPurchaseNotAllowedError();

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.name).toBe('AnonymousPurchaseNotAllowedError');
      expect(parsed.code).toBe('ANONYMOUS_PURCHASE_NOT_ALLOWED');
      expect(parsed.statusCode).toBe(403);
    });

    it('should serialize InvalidWebhookSignatureError to JSON', () => {
      const error = new InvalidWebhookSignatureError();

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.name).toBe('InvalidWebhookSignatureError');
      expect(parsed.code).toBe('INVALID_WEBHOOK_SIGNATURE');
      expect(parsed.statusCode).toBe(400);
    });

    it('should serialize PaymentProcessingError to JSON', () => {
      const error = new PaymentProcessingError('Custom error message');

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.name).toBe('PaymentProcessingError');
      expect(parsed.message).toBe('Custom error message');
      expect(parsed.code).toBe('PAYMENT_PROCESSING_ERROR');
      expect(parsed.statusCode).toBe(500);
    });
  });

  describe('Error Hierarchy', () => {
    it('should allow catching all payment errors as PaymentError', () => {
      const errors = [
        new InvalidPackageError('pkg'),
        new AnonymousPurchaseNotAllowedError(),
        new InvalidWebhookSignatureError(),
        new PaymentProcessingError('error'),
      ];

      errors.forEach((error) => {
        try {
          throw error;
        } catch (e) {
          expect(e).toBeInstanceOf(PaymentError);
        }
      });
    });

    it('should preserve specific error types when caught', () => {
      try {
        throw new InvalidPackageError('test');
      } catch (e) {
        if (e instanceof InvalidPackageError) {
          expect(e.code).toBe('INVALID_PACKAGE_ID');
          expect(e.statusCode).toBe(400);
        } else {
          fail('Should have caught InvalidPackageError');
        }
      }
    });

    it('should allow error type checking with instanceof', () => {
      const packageError = new InvalidPackageError('test');
      const webhookError = new InvalidWebhookSignatureError();
      const processingError = new PaymentProcessingError('test');

      expect(packageError instanceof InvalidPackageError).toBe(true);
      expect(packageError instanceof PaymentError).toBe(true);
      expect(packageError instanceof InvalidWebhookSignatureError).toBe(false);

      expect(webhookError instanceof InvalidWebhookSignatureError).toBe(true);
      expect(webhookError instanceof PaymentError).toBe(true);
      expect(webhookError instanceof InvalidPackageError).toBe(false);

      expect(processingError instanceof PaymentProcessingError).toBe(true);
      expect(processingError instanceof PaymentError).toBe(true);
      expect(processingError instanceof InvalidPackageError).toBe(false);
    });
  });

  describe('Status Code Validation', () => {
    it('should use 400 for client errors', () => {
      const clientErrors = [
        new InvalidPackageError('test'),
        new InvalidWebhookSignatureError(),
      ];

      clientErrors.forEach((error) => {
        expect(error.statusCode).toBe(400);
      });
    });

    it('should use 403 for forbidden errors', () => {
      const error = new AnonymousPurchaseNotAllowedError();

      expect(error.statusCode).toBe(403);
    });

    it('should use 500 for server errors', () => {
      const serverErrors = [
        new PaymentError('test', 'TEST'),
        new PaymentProcessingError('test'),
      ];

      serverErrors.forEach((error) => {
        expect(error.statusCode).toBe(500);
      });
    });
  });
});
