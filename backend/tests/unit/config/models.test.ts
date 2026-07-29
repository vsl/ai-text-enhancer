/**
 * Models Configuration Tests
 */

import { MODELS, getModelById, getModelsByProvider, getModelsByTier } from '../../../src/config/models.config';

describe('Models Configuration', () => {
  describe('MODELS', () => {
    it('should have exactly 3 models defined', () => {
      expect(MODELS.length).toBe(3);
    });

    it('should have all required fields for each model', () => {
      MODELS.forEach((model) => {
        expect(model.id).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(model.providerModelId).toBeDefined();
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

    it('should have models from all three providers', () => {
      const providers = new Set(MODELS.map((m) => m.provider));
      expect(providers.has('gemini')).toBe(true);
      expect(providers.has('openrouter')).toBe(true);
      expect(providers.has('lmstudio')).toBe(true);
      expect(providers.size).toBe(3);
    });

    it('should include gemini-flash model', () => {
      const model = MODELS.find((m) => m.id === 'gemini-flash');
      expect(model).toBeDefined();
      expect(model?.provider).toBe('gemini');
      expect(model?.providerModelId).toBe('gemini-2.5-flash');
      expect(model?.allowedTiers).toContain('free');
    });

    it('should include open-router-free model', () => {
      const model = MODELS.find((m) => m.id === 'open-router-free');
      expect(model).toBeDefined();
      expect(model?.provider).toBe('openrouter');
      expect(model?.allowedTiers).toContain('free');
    });

    it('should include local-debug-model', () => {
      const model = MODELS.find((m) => m.id === 'local-debug-model');
      expect(model).toBeDefined();
      expect(model?.provider).toBe('lmstudio');
      expect(model?.providerModelId).toBe('google/gemma-3-12b');
      expect(model?.allowedTiers).toContain('free');
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

    it('should return correct model for local-debug-model', () => {
      const model = getModelById('local-debug-model');
      expect(model).not.toBeNull();
      expect(model?.provider).toBe('lmstudio');
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

    it('should return lmstudio model', () => {
      const models = getModelsByProvider('lmstudio');
      expect(models.length).toBe(1);
      expect(models.every((m) => m.provider === 'lmstudio')).toBe(true);
      expect(models[0].id).toBe('local-debug-model');
    });

    it('should return empty array for non-existent provider', () => {
      const models = getModelsByProvider('non-existent');
      expect(models).toHaveLength(0);
    });
  });

  describe('getModelsByTier', () => {
    it('should return all models accessible to free tier', () => {
      const models = getModelsByTier('free');
      expect(models.length).toBe(3);
      expect(models.every((m) => m.allowedTiers.includes('free'))).toBe(true);
      expect(models.some((m) => m.id === 'open-router-free')).toBe(true);
      expect(models.some((m) => m.id === 'local-debug-model')).toBe(true);
      expect(models.some((m) => m.id === 'gemini-flash')).toBe(true);
    });

    it('should return all models accessible to plus tier', () => {
      const models = getModelsByTier('plus');
      
      expect(models.length).toBe(3);
      expect(models.every((m) => m.allowedTiers.includes('plus'))).toBe(true);
      expect(models.some((m) => m.id === 'gemini-flash')).toBe(true);
      expect(models.some((m) => m.id === 'open-router-free')).toBe(true);
      expect(models.some((m) => m.id === 'local-debug-model')).toBe(true);
    });

    it('should return all models accessible to premium tier', () => {
      const models = getModelsByTier('premium');
      
      expect(models.length).toBe(3);
      expect(models.every((m) => m.allowedTiers.includes('premium'))).toBe(true);
      expect(models.length).toBe(MODELS.length);
    });

    it('should support models accessible to multiple tiers', () => {
      const freeModels = getModelsByTier('free');
      const plusModels = getModelsByTier('plus');
      const premiumModels = getModelsByTier('premium');

      // All current models are accessible to all tiers
      expect(freeModels.length).toBe(3);
      expect(plusModels.length).toBe(3);
      expect(premiumModels.length).toBe(3);
    });
  });
});
