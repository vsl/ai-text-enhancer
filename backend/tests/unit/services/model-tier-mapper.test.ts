import { ModelTierMapper } from '../../../src/services/model-tier-mapper.ts';
import * as catalog from '../../../src/config/models.config.ts';
import type { UserTier } from '../../../src/types/auth.types.ts';

afterEach(() => { jest.restoreAllMocks(); });

it('does not leak a mutable catalog reference', () => {
  const tiers = ModelTierMapper.getAllowedTiers('open-router-free')!;
  tiers.length = 0;
  expect(ModelTierMapper.getAllowedTiers('open-router-free')).toEqual(['free', 'plus', 'premium']);
});

it.each([
  ['free', ['plus', 'premium'], false],
  ['plus', ['plus', 'premium'], true],
  ['plus', ['premium'], false],
  ['premium', ['premium'], true],
] as const)('enforces %s access to %j', (tier, allowedTiers, allowed) => {
  jest.spyOn(catalog, 'getModelById').mockReturnValue({ ...catalog.MODELS[0], allowedTiers: [...allowedTiers] as UserTier[] });
  expect(ModelTierMapper.canAccessModel(tier, 'restricted-fixture')).toBe(allowed);
});

it('handles unknown models explicitly', () => {
  expect(ModelTierMapper.getAllowedTiers('unknown')).toBeNull();
  expect(() => ModelTierMapper.canAccessModel('free', 'unknown')).toThrow('Unknown model');
});
