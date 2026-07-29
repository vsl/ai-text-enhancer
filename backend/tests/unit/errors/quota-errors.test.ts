/**
 * Unit Tests for Quota Errors
 * Tests custom error classes for quota management
 */

import { QuotaError, QuotaExceededError, InsufficientQuotaError } from '../../../src/errors/quota-errors.ts';

describe('Quota Errors', () => {
  describe('QuotaError', () => {
    it('should create error with default status code', () => {
      const error = new QuotaError('Test quota error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('QuotaError');
      expect(error.message).toBe('Test quota error');
      expect(error.statusCode).toBe(429);
    });

    it('should create error with custom status code', () => {
      const error = new QuotaError('Test error', 503);
      
      expect(error.statusCode).toBe(503);
    });
  });

  describe('QuotaExceededError', () => {
    it('should create error with correct properties', () => {
      const error = new QuotaExceededError(
        1_000_000,
        1_000_000,
        '2024-01-16T00:00:00Z'
      );
      
      expect(error).toBeInstanceOf(QuotaError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('QuotaExceededError');
      expect(error.used).toBe(1_000_000);
      expect(error.limit).toBe(1_000_000);
      expect(error.resetAt).toBe('2024-01-16T00:00:00Z');
      expect(error.statusCode).toBe(429);
    });

    it('should format message correctly', () => {
      const error = new QuotaExceededError(
        500_000,
        1_000_000,
        '2024-01-16T00:00:00Z'
      );
      
      expect(error.message).toContain('500000');
      expect(error.message).toContain('1000000');
      expect(error.message).toContain('2024-01-16T00:00:00Z');
      expect(error.message).toContain('exceeded');
    });

    it('should be catchable as QuotaError', () => {
      const error = new QuotaExceededError(100, 100, '2024-01-16T00:00:00Z');
      
      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(QuotaError);
        expect(e).toBeInstanceOf(QuotaExceededError);
      }
    });
  });

  describe('InsufficientQuotaError', () => {
    it('should create error with correct properties', () => {
      const error = new InsufficientQuotaError(600_000, 500_000);
      
      expect(error).toBeInstanceOf(QuotaError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('InsufficientQuotaError');
      expect(error.required).toBe(600_000);
      expect(error.available).toBe(500_000);
      expect(error.statusCode).toBe(429);
    });

    it('should format message correctly', () => {
      const error = new InsufficientQuotaError(600_000, 500_000);
      
      expect(error.message).toContain('600000');
      expect(error.message).toContain('500000');
      expect(error.message).toContain('Insufficient');
    });

    it('should be catchable as QuotaError', () => {
      const error = new InsufficientQuotaError(100, 50);
      
      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(QuotaError);
        expect(e).toBeInstanceOf(InsufficientQuotaError);
      }
    });
  });

  describe('Error Serialization', () => {
    it('should serialize QuotaExceededError to JSON', () => {
      const error = new QuotaExceededError(
        1_000_000,
        1_000_000,
        '2024-01-16T00:00:00Z'
      );
      
      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        used: error.used,
        limit: error.limit,
        resetAt: error.resetAt
      });
      
      const parsed = JSON.parse(serialized);
      expect(parsed.name).toBe('QuotaExceededError');
      expect(parsed.statusCode).toBe(429);
    });

    it('should serialize InsufficientQuotaError to JSON', () => {
      const error = new InsufficientQuotaError(600_000, 500_000);
      
      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        required: error.required,
        available: error.available
      });
      
      const parsed = JSON.parse(serialized);
      expect(parsed.name).toBe('InsufficientQuotaError');
      expect(parsed.required).toBe(600_000);
    });
  });
});
