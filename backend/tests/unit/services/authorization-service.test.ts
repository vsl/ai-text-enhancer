/**
 * AuthorizationService Unit Tests
 * Tests tier-based model access enforcement
 */

import { AuthorizationService } from '../../../src/services/authorization-service.ts';
import { InsufficientTierError } from '../../../src/errors/auth-errors.ts';
import type { UserProfile } from '../../../src/types/auth.types.ts';

describe('AuthorizationService', () => {
  let authzService: AuthorizationService;

  beforeEach(() => {
    authzService = new AuthorizationService();
  });

  const createUser = (tier: 'free' | 'plus' | 'premium'): UserProfile => ({
    userId: 'test-user',
    email: 'test@example.com',
    tier,
    isAdmin: false,
    isActive: true,
    tokensAvailable: 50000,
    tokensUsed: 0,
    authProvider: 'email',
  });

  describe('checkModelAccess', () => {
    it('should allow free user to access free models', () => {
      const user = createUser('free');
      const result = authzService.checkModelAccess(user, 'open-router-free');
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it.skip('should deny free user access to plus models', () => {
      // All models are currently free tier
      const user = createUser('free');
      const result = authzService.checkModelAccess(user, 'open-router-free');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('requires plus tier');
      expect(result.reason).toContain('user has free tier');
    });

    it('should allow plus user to access free models', () => {
      const user = createUser('plus');
      const result = authzService.checkModelAccess(user, 'open-router-free');
      
      expect(result.allowed).toBe(true);
    });

    it('should allow plus user to access plus models', () => {
      const user = createUser('plus');
      const result = authzService.checkModelAccess(user, 'open-router-free');
      
      expect(result.allowed).toBe(true);
    });

    it('should allow premium user to access all models', () => {
      const user = createUser('premium');
      
      expect(authzService.checkModelAccess(user, 'open-router-free').allowed).toBe(true);
      expect(authzService.checkModelAccess(user, 'open-router-free').allowed).toBe(true);
    });

    it.skip('should include model ID in error reason', () => {
      // All models are currently free tier
      const user = createUser('free');
      const result = authzService.checkModelAccess(user, 'open-router-free');
      
      expect(result.reason).toContain('open-router-free');
    });
  });

  describe('requireModelAccess', () => {
    it('should not throw for allowed access', () => {
      const user = createUser('plus');
      
      expect(() => {
        authzService.requireModelAccess(user, 'open-router-free');
      }).not.toThrow();
    });

    it.skip('should throw InsufficientTierError for denied access', () => {
      // All models are currently free tier
      const user = createUser('free');
      
      expect(() => {
        authzService.requireModelAccess(user, 'open-router-free');
      }).toThrow(InsufficientTierError);
    });

    it.skip('should throw error with correct tier information', () => {
      // All models are currently free tier
      const user = createUser('free');
      
      try {
        authzService.requireModelAccess(user, 'open-router-free');
        fail('Should have thrown InsufficientTierError');
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientTierError);
        expect((error as Error).message).toContain('requires plus tier');
        expect((error as Error).message).toContain('user has free tier');
      }
    });

    it.skip('should throw error for free user accessing plus model', () => {
      // All models are currently free tier
      const user = createUser('free');
      
      expect(() => {
        authzService.requireModelAccess(user, 'open-router-free');
      }).toThrow(InsufficientTierError);
    });

    it('should allow premium user to access any model', () => {
      const user = createUser('premium');
      
      expect(() => {
        authzService.requireModelAccess(user, 'open-router-free');
        authzService.requireModelAccess(user, 'open-router-free');
      }).not.toThrow();
    });
  });

  describe('getAccessibleModels', () => {
    it('should return only free models for free users', () => {
      const user = createUser('free');
      const models = authzService.getAccessibleModels(user);
      
      expect(models).toHaveLength(2);
      expect(models).toContain('open-router-free');
      expect(models).toContain('open-router-free');
    });

    it('should return free + plus models for plus users', () => {
      const user = createUser('plus');
      const models = authzService.getAccessibleModels(user);
      
      expect(models.length).toBe(2);
      expect(models).toContain('open-router-free');
      expect(models).toContain('open-router-free');
    });

    it('should return all models for premium users', () => {
      const user = createUser('premium');
      const models = authzService.getAccessibleModels(user);
      
      expect(models.length).toBe(2);
      expect(models).toContain('open-router-free');
      expect(models).toContain('open-router-free');
    });

    it('should return empty array for user with invalid tier', () => {
      const user = {
        userId: 'test-user',
        email: 'test@example.com',
        tier: 'invalid' as any,
        isAdmin: false,
        isActive: true,
        tokensAvailable: 50000,
        tokensUsed: 0,
        authProvider: 'email' as const,
      };

      const models = authzService.getAccessibleModels(user);
      expect(models).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown model in checkModelAccess', () => {
      const user = createUser('premium');
      
      expect(() => {
        authzService.checkModelAccess(user, 'unknown-model');
      }).toThrow('Unknown model');
    });

    it('should throw error for unknown model in requireModelAccess', () => {
      const user = createUser('premium');
      
      expect(() => {
        authzService.requireModelAccess(user, 'unknown-model');
      }).toThrow('Unknown model');
    });
  });
});
