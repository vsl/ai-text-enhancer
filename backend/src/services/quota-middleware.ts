/**
 * Token Quota Middleware
 * High-level quota validation wrapper for handler layer
 * Platform-agnostic implementation using Supabase
 */

import type { UserProfile } from '../types/auth.types.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QuotaService } from './quota-service.ts';

export class QuotaMiddleware {
  private quotaService: QuotaService;

  constructor(supabase: SupabaseClient) {
    this.quotaService = new QuotaService(supabase);
  }

  /**
   * Pre-validate quota before processing
   */
  async preValidate(user: UserProfile, estimatedTokens: number): Promise<void> {
    this.quotaService.requireQuota(user, estimatedTokens);
  }

  /**
   * Post-update quota after processing
   */
  async postUpdate(
    user: UserProfile,
    actualTokens: number,
    model: string
  ): Promise<void> {
    await this.quotaService.reportUsage(user.userId, actualTokens, model);
  }

  /**
   * Get quota service for advanced usage
   */
  getService(): QuotaService {
    return this.quotaService;
  }
}
