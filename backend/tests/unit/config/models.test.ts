/**
 * Models Configuration Tests
 */

import { MODELS, getModelById, getModelsByProvider, getModelsByTier } from '../../../src/config/models.config';

describe('Models Configuration', () => {
  describe('MODELS', () => {
    it('should have exactly 2 production models defined', () => {
      expect(MODELS.length).toBe(2);
    });

    it('should have all required fields for each model', () => {
      MODELS.forEach((model) => {
        expect(model.id).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(model.providerModelId).toBeDefined();
        expect(['json-schema', 'json-object']).toContain(model.structuredOutputMode);
        expect(model.allowedTiers).toBeDefined();
        expect(Array.isArray(model.allowedTiers)).toBe(true);
        expect(model.allowedTiers.length).toBeGreaterThan(0);
        expect(model.displayName).toBeDefined();
        expect(model.contextWindow).toBeGreaterThan(0);
        expect(model.costPer1kTokens).toBeDefined();
        expect(model.costPer1kTokens.input).toBeGreaterThanOrEqual(0);
        expect(model.costPer1kTokens.output).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have unique model IDs', () => {
      const ids = MODELS.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have models from both production providers', () => {
      const providers = new Set(MODELS.map((m) => m.provider));
      expect(providers.has('gemini')).toBe(true);
      expect(providers.has('openrouter')).toBe(true);
      expect(providers.size).toBe(2);
    });

    it('should include gemini-flash model', () => {
      const model = MODELS.find((m) => m.id === 'gemini-flash');
      expect(model).toBeDefined();
      expect(model?.provider).toBe('gemini');
      expect(model?.providerModelId).toBe('gemini-2.5-flash');
      expect(model?.structuredOutputMode).toBe('json-schema');
      expect(model?.allowedTiers).toContain('free');
    });

    it('should include open-router-free model', () => {
      const model = MODELS.find((m) => m.id === 'open-router-free');
      expect(model).toBeDefined();
      expect(model?.provider).toBe('openrouter');
      expect(model?.structuredOutputMode).toBe('json-object');
      expect(model?.allowedTiers).toContain('free');
      expect(model?.contextWindow).toBe(163840);
    });
  });

  describe('getModelById', () => {
    it('should return model for valid ID', () => {
      const model = getModelById('gemini-flash');
      expect(model).not.toBeNull();
      expect(model?.id).toBe('gemini-flash');
    });

    it('should return null for invalid ID', () => {
      const model = getModelById('non-existent-model');
      expect(model).toBeNull();
    });

    it('should return correct model for open-router-free', () => {
      const model = getModelById('open-router-free');
      expect(model).not.toBeNull();
      expect(model?.provider).toBe('openrouter');
    });

    it('should not expose the local debug model', () => {
      const model = getModelById('local-debug-model');
      expect(model).toBeNull();
    });
  });

  describe('getModelsByProvider', () => {
    it('should return gemini model', () => {
      const models = getModelsByProvider('gemini');
      expect(models.length).toBe(1);
      expect(models.every((m) => m.provider === 'gemini')).toBe(true);
      expect(models[0].id).toBe('gemini-flash');
    });

    it('should return openrouter model', () => {
      const models = getModelsByProvider('openrouter');
      expect(models.length).toBe(1);
      expect(models.every((m) => m.provider === 'openrouter')).toBe(true);
      expect(models[0].id).toBe('open-router-free');
    });

    it('should not expose lmstudio models', () => {
      const models = getModelsByProvider('lmstudio');
      expect(models).toHaveLength(0);
    });

    it('should return empty array for non-existent provider', () => {
      const models = getModelsByProvider('non-existent');
      expect(models).toHaveLength(0);
    });
  });

  describe('getModelsByTier', () => {
    it('should return all models accessible to free tier', () => {
      const models = getModelsByTier('free');
      expect(models.length).toBe(2);
      expect(models.every((m) => m.allowedTiers.includes('free'))).toBe(true);
      expect(models.some((m) => m.id === 'open-router-free')).toBe(true);
      expect(models.some((m) => m.id === 'gemini-flash')).toBe(true);
    });

    it('should return all models accessible to plus tier', () => {
      const models = getModelsByTier('plus');
      
      expect(models.length).toBe(2);
      expect(models.every((m) => m.allowedTiers.includes('plus'))).toBe(true);
      expect(models.some((m) => m.id === 'gemini-flash')).toBe(true);
      expect(models.some((m) => m.id === 'open-router-free')).toBe(true);
    });

    it('should return all models accessible to premium tier', () => {
      const models = getModelsByTier('premium');
      
      expect(models.length).toBe(2);
      expect(models.every((m) => m.allowedTiers.includes('premium'))).toBe(true);
      expect(models.length).toBe(MODELS.length);
    });

    it('should support models accessible to multiple tiers', () => {
      const freeModels = getModelsByTier('free');
      const plusModels = getModelsByTier('plus');
      const premiumModels = getModelsByTier('premium');

      // All current models are accessible to all tiers
      expect(freeModels.length).toBe(2);
      expect(plusModels.length).toBe(2);
      expect(premiumModels.length).toBe(2);
    });
  });
});
