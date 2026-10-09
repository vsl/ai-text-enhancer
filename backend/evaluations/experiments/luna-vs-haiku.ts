import type { ExperimentDefinition } from '../../src/evaluation/experiments.ts';

// Proposed production settings for models not yet in the production catalog.
export default {
  id: 'luna-vs-haiku-production-settings', mode: 'models', suite: 'base', repetitions: 1,
  baseline: { id: 'luna', provider: 'openrouter', model: 'openai/gpt-6-luna', structuredOutputMode: 'json-schema',
    settings: { reasoningEffort: 'none' } },
  candidate: { id: 'haiku', provider: 'openrouter', model: 'anthropic/claude-haiku-5.5', structuredOutputMode: 'json-schema',
    settings: { reasoningEffort: 'low', reasoningEnabled: false } },
} satisfies ExperimentDefinition;
