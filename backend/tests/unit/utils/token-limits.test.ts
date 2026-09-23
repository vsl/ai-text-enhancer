/**
 * Token Limits Utility Tests
 */

import {
  getMaxTokensForTier,
  getMaxTokensPerDayForTier,
  calculateEffectiveMaxTokens,
  isWithinTokenLimit,
} from '../../../src/utils/token-limits.ts';
import type { SystemConfig } from '../../../src/types/config.types.ts';

const mockConfig: SystemConfig = {
  llmProviders: [],
  supabase: {
    url: 'http://localhost:54321',
    serviceRoleKey: 'test-service-role-key',
  },
  rateLimits: {
    free: {
      requestsPerDay: 100,
      requestsPerHour: 20,
      maxTokensPerRequest: 2048,
      maxTokensPerDay: 50000,
    },
    plus: {
      requestsPerDay: 1000,
      requestsPerHour: 100,
      maxTokensPerRequest: 4096,
      maxTokensPerDay: 500000,
    },
    premium: {
      requestsPerDay: 10000,
      requestsPerHour: 1000,
      maxTokensPerRequest: 8192,
      maxTokensPerDay: 5000000,
    },
  },
  timeout: 30000,
  maxBatchSize: 10,
  models: [],
  roles: [],
  exposeErrorDetails: true,
};

describe('Token Limits Utility', () => {
  describe('getMaxTokensForTier', () => {
    it('should return correct max tokens for free tier', () => {
      expect(getMaxTokensForTier(mockConfig, 'free')).toBe(2048);
    });

    it('should return correct max tokens for plus tier', () => {
      expect(getMaxTokensForTier(mockConfig, 'plus')).toBe(4096);
    });

    it('should return correct max tokens for premium tier', () => {
      expect(getMaxTokensForTier(mockConfig, 'premium')).toBe(8192);
    });
  });

  describe('getMaxTokensPerDayForTier', () => {
    it('should return correct daily limit for free tier', () => {
      expect(getMaxTokensPerDayForTier(mockConfig, 'free')).toBe(50000);
    });

    it('should return correct daily limit for plus tier', () => {
      expect(getMaxTokensPerDayForTier(mockConfig, 'plus')).toBe(500000);
    });

    it('should return correct daily limit for premium tier', () => {
      expect(getMaxTokensPerDayForTier(mockConfig, 'premium')).toBe(5000000);
    });
  });

  describe('calculateEffectiveMaxTokens', () => {
    it('should return tier limit when no tokens requested', () => {
      expect(calculateEffectiveMaxTokens(undefined, 'free', mockConfig)).toBe(2048);
      expect(calculateEffectiveMaxTokens(undefined, 'plus', mockConfig)).toBe(4096);
      expect(calculateEffectiveMaxTokens(undefined, 'premium', mockConfig)).toBe(8192);
    });

    it('should return requested tokens if within tier limit', () => {
      expect(calculateEffectiveMaxTokens(1000, 'free', mockConfig)).toBe(1000);
      expect(calculateEffectiveMaxTokens(3000, 'plus', mockConfig)).toBe(3000);
      expect(calculateEffectiveMaxTokens(5000, 'premium', mockConfig)).toBe(5000);
    });

    it('should cap at tier limit if requested exceeds limit', () => {
      expect(calculateEffectiveMaxTokens(5000, 'free', mockConfig)).toBe(2048);
      expect(calculateEffectiveMaxTokens(10000, 'plus', mockConfig)).toBe(4096);
      expect(calculateEffectiveMaxTokens(20000, 'premium', mockConfig)).toBe(8192);
    });

    it('should handle edge cases', () => {
      // Request exactly at limit
      expect(calculateEffectiveMaxTokens(2048, 'free', mockConfig)).toBe(2048);
      
      // Request 0 tokens - should use tier default
      expect(calculateEffectiveMaxTokens(0, 'free', mockConfig)).toBe(2048);
      
      // Negative request - should use tier default
      expect(calculateEffectiveMaxTokens(-100, 'free', mockConfig)).toBe(2048);
    });
  });

  describe('isWithinTokenLimit', () => {
    it('should return true for requests within tier limits', () => {
      expect(isWithinTokenLimit(1000, 'free', mockConfig)).toBe(true);
      expect(isWithinTokenLimit(3000, 'plus', mockConfig)).toBe(true);
      expect(isWithinTokenLimit(7000, 'premium', mockConfig)).toBe(true);
    });

    it('should return true for requests at exact tier limits', () => {
      expect(isWithinTokenLimit(2048, 'free', mockConfig)).toBe(true);
      expect(isWithinTokenLimit(4096, 'plus', mockConfig)).toBe(true);
      expect(isWithinTokenLimit(8192, 'premium', mockConfig)).toBe(true);
    });

    it('should return false for requests exceeding tier limits', () => {
      expect(isWithinTokenLimit(3000, 'free', mockConfig)).toBe(false);
      expect(isWithinTokenLimit(5000, 'plus', mockConfig)).toBe(false);
      expect(isWithinTokenLimit(10000, 'premium', mockConfig)).toBe(false);
    });

    it('should handle edge cases', () => {
      // 0 tokens
      expect(isWithinTokenLimit(0, 'free', mockConfig)).toBe(true);
      
      // 1 token over limit
      expect(isWithinTokenLimit(2049, 'free', mockConfig)).toBe(false);
    });
  });
});
