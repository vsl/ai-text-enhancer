import type { ExperimentDefinition } from '../../src/evaluation/experiments.ts';

// Both candidates inherit their production settings from models.config.ts.
export default {
  id: 'luna-vs-haiku-production-settings', mode: 'models', suite: 'base', repetitions: 1,
  baseline: { id: 'luna', provider: 'openrouter', model: 'openai/gpt-6-luna', structuredOutputMode: 'json-schema' },
  candidate: { id: 'haiku', provider: 'openrouter', model: 'anthropic/claude-haiku-5.5', structuredOutputMode: 'json-schema' },
} satisfies ExperimentDefinition;
