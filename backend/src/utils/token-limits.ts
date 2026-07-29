/**
 * Token Limits Utility
 * 
 * Helper functions for determining token limits based on user tier.
 * Platform-agnostic implementation.
 */

import type { SystemConfig } from '../types/config.types.ts';

/**
 * Get maximum tokens per request for a user tier
 * 
 * @param config - System configuration
 * @param userTier - User tier (free, plus, premium)
 * @returns Maximum tokens allowed per request
 */
export function getMaxTokensForTier(
  config: SystemConfig,
  userTier: 'free' | 'plus' | 'premium'
): number {
  return config.rateLimits[userTier].maxTokensPerRequest;
}

/**
 * Get maximum tokens per day for a user tier
 * 
 * @param config - System configuration
 * @param userTier - User tier (free, plus, premium)
 * @returns Maximum tokens allowed per day
 */
export function getMaxTokensPerDayForTier(
  config: SystemConfig,
  userTier: 'free' | 'plus' | 'premium'
): number {
  return config.rateLimits[userTier].maxTokensPerDay;
}

/**
 * Calculate effective max tokens for a request
 * Enforces tier limits and provides sensible defaults
 * 
 * @param requestedTokens - Tokens requested by user (optional)
 * @param userTier - User tier
 * @param config - System configuration
 * @returns Effective max tokens (capped at tier limit)
 */
export function calculateEffectiveMaxTokens(
  requestedTokens: number | undefined,
  userTier: 'free' | 'plus' | 'premium',
  config: SystemConfig
): number {
  const tierLimit = getMaxTokensForTier(config, userTier);
  
  // If no specific request or 0, use tier default
  if (!requestedTokens || requestedTokens <= 0) {
    return tierLimit;
  }
  
  // Cap at tier limit
  return Math.min(requestedTokens, tierLimit);
}

/**
 * Validate if requested tokens are within tier limits
 * 
 * @param requestedTokens - Tokens requested
 * @param userTier - User tier
 * @param config - System configuration
 * @returns True if within limits
 */
export function isWithinTokenLimit(
  requestedTokens: number,
  userTier: 'free' | 'plus' | 'premium',
  config: SystemConfig
): boolean {
  const tierLimit = getMaxTokensForTier(config, userTier);
  return requestedTokens <= tierLimit;
}
