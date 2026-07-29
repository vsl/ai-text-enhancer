/**
 * Tier Limits Configuration
 *
 * Defines tier-specific limits for message sizes and batch operations.
 * These limits control what users can do based on their subscription tier.
 *
 * Platform-agnostic - uses only TypeScript types.
 */

import type { UserTier } from '../types/auth.types.ts';

/**
 * Configuration for tier-specific limits
 */
export interface TierLimits {
  /**
   * Maximum length of user text (main message) in characters
   */
  maxUserTextLength: number;

  /**
   * Maximum length of context text in characters
   */
  maxContextTextLength: number;

  /**
   * Maximum number of assistants in a single batch request
   */
  maxBatchSize: number;
}

/**
 * Tier limits configuration
 *
 * FREE TIER:
 * - Suitable for casual users and testing
 * - Small messages (500 chars user text, 800 chars context)
 * - Limited batch size (3 assistants)
 *
 * PLUS TIER:
 * - For regular users with moderate needs
 * - Medium messages (2000 chars user text, 3000 chars context)
 * - Full batch size (10 assistants)
 *
 * PREMIUM TIER:
 * - For power users and businesses
 * - Large messages (5000 chars user text, 10000 chars context)
 * - Full batch size (10 assistants)
 */
export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    maxUserTextLength: 500,
    maxContextTextLength: 800,
    maxBatchSize: 3,
  },
  plus: {
    maxUserTextLength: 2000,
    maxContextTextLength: 3000,
    maxBatchSize: 10,
  },
  premium: {
    maxUserTextLength: 5000,
    maxContextTextLength: 10000,
    maxBatchSize: 10,
  },
};

/**
 * Get limits for a specific tier
 * @param tier - User tier
 * @returns Tier limits configuration
 */
export function getLimitsForTier(tier: UserTier): TierLimits {
  return TIER_LIMITS[tier];
}

/**
 * Check if user text length is within tier limit
 * @param tier - User tier
 * @param length - Text length to check
 * @returns True if within limit
 */
export function isUserTextWithinLimit(tier: UserTier, length: number): boolean {
  return length <= TIER_LIMITS[tier].maxUserTextLength;
}

/**
 * Check if context text length is within tier limit
 * @param tier - User tier
 * @param length - Text length to check
 * @returns True if within limit
 */
export function isContextTextWithinLimit(tier: UserTier, length: number): boolean {
  return length <= TIER_LIMITS[tier].maxContextTextLength;
}

/**
 * Check if batch size is within tier limit
 * @param tier - User tier
 * @param size - Batch size to check
 * @returns True if within limit
 */
export function isBatchSizeWithinLimit(tier: UserTier, size: number): boolean {
  return size <= TIER_LIMITS[tier].maxBatchSize;
}
