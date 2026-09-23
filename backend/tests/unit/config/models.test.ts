import { MODELS, getModelById, getModelsByProvider, getModelsByTier } from '../../../src/config/models.config';

describe('Models Configuration', () => {
  it('uses GPT-5 Nano as the default and includes the Qwen model', () => {
    expect(MODELS).toEqual([
      expect.objectContaining({
        id: 'openai-gpt-5-nano',
        provider: 'openrouter',
        providerModelId: 'openai/gpt-5-nano',
        structuredOutputMode: 'json-schema',
        serviceTier: 'flex',
        contextWindow: 400000,
      }),
      expect.objectContaining({
        id: 'open-router-free',
        provider: 'openrouter',
        providerModelId: 'openrouter/free',
        structuredOutputMode: 'json-schema',
        contextWindow: 200000,
      }),
      expect.objectContaining({
        id: 'qwen-qwen3-30b-a3b-instruct-2507',
        provider: 'openrouter',
        providerModelId: 'qwen/qwen3-30b-a3b-instruct-2507',
        structuredOutputMode: 'json-schema',
        contextWindow: 262144,
      }),
    ]);
  });

  it('makes all models available to every tier', () => {
    for (const tier of ['free', 'plus', 'premium'] as const) {
      expect(getModelsByTier(tier).map((model) => model.id)).toEqual([
        'openai-gpt-5-nano',
        'open-router-free',
        'qwen-qwen3-30b-a3b-instruct-2507',
      ]);
    }
  });

  it('exposes all models only through OpenRouter', () => {
    expect(getModelsByProvider('openrouter')).toHaveLength(3);
    expect(getModelsByProvider('gemini')).toHaveLength(0);
    expect(getModelById('openai-gpt-5-nano')?.displayName).toBe('GPT-5 Nano');
    expect(getModelById('qwen-qwen3-30b-a3b-instruct-2507')?.displayName).toBe('Qwen3 30B A3B Instruct 2507');
    expect(getModelById('gemini-flash')).toBeNull();
  });
});
