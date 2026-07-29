/**
 * Token Quota Configuration
 * Platform-agnostic quota limits and utilities
 */

import type { UserTier } from '../types/auth.types.ts';

export const QUOTA_LIMITS: Record<UserTier, number> = {
  free: 100_000,      // 100k tokens/day
  plus: 1_000_000,    // 1M tokens/day
  premium: 10_000_000 // 10M tokens/day
};

export const QUOTA_CONFIG = {
  /**
   * Get daily token limit for tier
   */
  getDailyLimit(tier: UserTier): number {
    return QUOTA_LIMITS[tier];
  },

  /**
   * Calculate next reset time (midnight UTC)
   */
  getNextResetTime(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  },

  /**
   * Format reset time as ISO string
   */
  getNextResetTimeISO(): string {
    return this.getNextResetTime().toISOString();
  }
};
