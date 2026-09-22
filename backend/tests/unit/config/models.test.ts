import { MODELS, getModelById, getModelsByProvider, getModelsByTier } from '../../../src/config/models.config';

describe('Models Configuration', () => {
  it('uses OpenRouter Free as the default and GPT-5 Nano as the second model', () => {
    expect(MODELS).toEqual([
      expect.objectContaining({
        id: 'open-router-free',
        provider: 'openrouter',
        providerModelId: 'openrouter/free',
        structuredOutputMode: 'json-schema',
        contextWindow: 200000,
      }),
      expect.objectContaining({
        id: 'openai-gpt-5-nano',
        provider: 'openrouter',
        providerModelId: 'openai/gpt-5-nano',
        structuredOutputMode: 'json-schema',
        contextWindow: 400000,
      }),
    ]);
  });

  it('makes both models available to every tier', () => {
    for (const tier of ['free', 'plus', 'premium'] as const) {
      expect(getModelsByTier(tier).map((model) => model.id)).toEqual([
        'open-router-free',
        'openai-gpt-5-nano',
      ]);
    }
  });

  it('exposes both models only through OpenRouter', () => {
    expect(getModelsByProvider('openrouter')).toHaveLength(2);
    expect(getModelsByProvider('gemini')).toHaveLength(0);
    expect(getModelById('openai-gpt-5-nano')?.displayName).toBe('GPT-5 Nano');
    expect(getModelById('gemini-flash')).toBeNull();
  });
});
