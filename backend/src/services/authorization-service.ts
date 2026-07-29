/**
 * Authorization Service
 * Enforces tier-based access control for models
 * Platform-agnostic implementation
 */

import type { UserProfile, AccessCheckResult } from '../types/auth.types.ts';
import { ModelTierMapper } from './model-tier-mapper.ts';
import { InsufficientTierError } from '../errors/auth-errors.ts';

export class AuthorizationService {
  /**
   * Check if user can access model
   */
  checkModelAccess(user: UserProfile, modelId: string): AccessCheckResult {
    const canAccess = ModelTierMapper.canAccessModel(user.tier, modelId);

    if (!canAccess) {
      const allowedTiers = ModelTierMapper.getAllowedTiers(modelId);
      const tiersString = allowedTiers?.join(', ') || 'unknown';
      return {
        allowed: false,
        reason: `Model "${modelId}" requires one of [${tiersString}] tiers, but user has ${user.tier} tier`
      };
    }

    return {
      allowed: true
    };
  }

  /**
   * Check if user can access model (throws on failure)
   */
  requireModelAccess(user: UserProfile, modelId: string): void {
    const result = this.checkModelAccess(user, modelId);

    if (!result.allowed) {
      const allowedTiers = ModelTierMapper.getAllowedTiers(modelId);
      const requiredTier = allowedTiers?.[0] || 'unknown';
      throw new InsufficientTierError(requiredTier, user.tier);
    }
  }

  /**
   * Get accessible models for user
   */
  getAccessibleModels(user: UserProfile): string[] {
    return ModelTierMapper.getAccessibleModels(user.tier);
  }
}
