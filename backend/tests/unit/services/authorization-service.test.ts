import { AuthorizationService } from '../../../src/services/authorization-service.ts';
import { InsufficientTierError } from '../../../src/errors/auth-errors.ts';
import * as catalog from '../../../src/config/models.config.ts';
import type { UserProfile, UserTier } from '../../../src/types/auth.types.ts';

const user = (tier: UserTier): UserProfile => ({ userId: 'user', email: 'test@example.com', tier,
  isAdmin: false, isActive: true, tokensAvailable: 50_000, tokensUsed: 0, authProvider: 'email' });

const service = new AuthorizationService();
afterEach(() => { jest.restoreAllMocks(); });

it.each(['free', 'plus', 'premium'] as const)('allows current demo models for %s users', tier => {
  for (const model of catalog.MODELS) expect(service.checkModelAccess(user(tier), model.id).allowed).toBe(true);
  expect(service.getAccessibleModels(user(tier))).toHaveLength(5);
});

it('denies a free user a restricted model with a useful tier error', () => {
  const restricted = { ...catalog.MODELS[0], id: 'paid-fixture', allowedTiers: ['plus', 'premium'] as UserTier[] };
  jest.spyOn(catalog, 'getModelById').mockReturnValue(restricted);
  expect(service.checkModelAccess(user('free'), restricted.id)).toEqual({ allowed: false,
    reason: expect.stringContaining('paid-fixture') });
  expect(() => service.requireModelAccess(user('free'), restricted.id)).toThrow(InsufficientTierError);
  expect(() => service.requireModelAccess(user('plus'), restricted.id)).not.toThrow();
});

it('rejects unknown models', () => {
  expect(() => service.requireModelAccess(user('premium'), 'unknown-model')).toThrow('Unknown model');
});
