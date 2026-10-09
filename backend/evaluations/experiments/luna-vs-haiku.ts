import type { ExperimentDefinition } from '../../src/evaluation/experiments.ts';

// Both models allow thinking to be disabled; neither lists minimal effort.
export default {
  id: 'luna-vs-haiku-reasoning-off', mode: 'models', suite: 'base', repetitions: 1,
  settings: { reasoningEffort: 'low', reasoningEnabled: false },
  baseline: { id: 'luna', provider: 'openrouter', model: 'openai/gpt-6-luna', structuredOutputMode: 'json-schema' },
  candidate: { id: 'haiku', provider: 'openrouter', model: 'anthropic/claude-haiku-5.5', structuredOutputMode: 'json-schema' },
} satisfies ExperimentDefinition;
