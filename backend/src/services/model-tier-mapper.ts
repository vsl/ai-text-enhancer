/**
 * Model Tier Mapper
 * Maps models to allowed tiers and checks user access
 * Platform-agnostic implementation
 */

import type { UserTier } from '../types/auth.types.ts';
import { getModelById, MODELS } from '../config/models.config.ts';

export class ModelTierMapper {
  /**
   * Get allowed tiers for a model
   * Uses models.config.ts as single source of truth
   * @returns Array of allowed tiers, or null if model not found
   */
  static getAllowedTiers(modelId: string): UserTier[] | null {
    const model = getModelById(modelId);
    
    if (!model) {
      return null;
    }

    return [...model.allowedTiers];
  }

  /**
   * Check if user tier can access model
   */
  static canAccessModel(userTier: UserTier, modelId: string): boolean {
    const model = getModelById(modelId);
    
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    return model.allowedTiers.includes(userTier);
  }

  /**
   * Get all accessible models for user tier
   * Uses models.config.ts as single source of truth
   */
  static getAccessibleModels(userTier: UserTier): string[] {
    return MODELS
      .filter((model) => model.allowedTiers.includes(userTier))
      .map((model) => model.id);
  }
}
