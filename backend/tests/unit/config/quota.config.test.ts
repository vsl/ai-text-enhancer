/**
 * Unit Tests for Quota Configuration
 * Tests quota limits and utilities
 */

import { QUOTA_CONFIG, QUOTA_LIMITS } from '../../../src/config/quota.config.ts';

describe('Quota Configuration', () => {
  describe('QUOTA_LIMITS', () => {
    it('should define limits for all tiers', () => {
      expect(QUOTA_LIMITS.free).toBe(100_000);
      expect(QUOTA_LIMITS.plus).toBe(1_000_000);
      expect(QUOTA_LIMITS.premium).toBe(10_000_000);
    });
  });

  describe('getDailyLimit', () => {
    it('should return correct limit for free tier', () => {
      expect(QUOTA_CONFIG.getDailyLimit('free')).toBe(100_000);
    });

    it('should return correct limit for plus tier', () => {
      expect(QUOTA_CONFIG.getDailyLimit('plus')).toBe(1_000_000);
    });

    it('should return correct limit for premium tier', () => {
      expect(QUOTA_CONFIG.getDailyLimit('premium')).toBe(10_000_000);
    });
  });

  describe('getNextResetTime', () => {
    it('should return tomorrow at midnight UTC', () => {
      const resetTime = QUOTA_CONFIG.getNextResetTime();
      const now = new Date();
      
      // Should be later than now
      expect(resetTime.getTime()).toBeGreaterThan(now.getTime());
      
      // Should be tomorrow
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      expect(resetTime.getUTCDate()).toBe(tomorrow.getUTCDate());
      
      // Should be at midnight
      expect(resetTime.getUTCHours()).toBe(0);
      expect(resetTime.getUTCMinutes()).toBe(0);
      expect(resetTime.getUTCSeconds()).toBe(0);
      expect(resetTime.getUTCMilliseconds()).toBe(0);
    });

    it('should return consistent results', () => {
      const time1 = QUOTA_CONFIG.getNextResetTime();
      const time2 = QUOTA_CONFIG.getNextResetTime();
      
      // Should be within same second (may differ slightly due to execution time)
      expect(Math.abs(time1.getTime() - time2.getTime())).toBeLessThan(1000);
    });
  });

  describe('getNextResetTimeISO', () => {
    it('should return ISO 8601 formatted string', () => {
      const resetTimeISO = QUOTA_CONFIG.getNextResetTimeISO();
      
      // Should match ISO format
      expect(resetTimeISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should be parseable as Date', () => {
      const resetTimeISO = QUOTA_CONFIG.getNextResetTimeISO();
      const parsed = new Date(resetTimeISO);
      
      expect(parsed.toString()).not.toBe('Invalid Date');
      expect(parsed.getTime()).toBeGreaterThan(Date.now());
    });

    it('should represent midnight UTC', () => {
      const resetTimeISO = QUOTA_CONFIG.getNextResetTimeISO();
      const parsed = new Date(resetTimeISO);
      
      expect(parsed.getUTCHours()).toBe(0);
      expect(parsed.getUTCMinutes()).toBe(0);
      expect(parsed.getUTCSeconds()).toBe(0);
    });
  });
});
