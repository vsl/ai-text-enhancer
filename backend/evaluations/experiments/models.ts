import type { ExperimentDefinition } from '../../src/evaluation/experiments.ts';

// Each model inherits its own production generation settings.
export default {
  id: 'qwen-vs-openrouter-free', mode: 'models', suite: 'base', repetitions: 1,
  baseline: { id: 'qwen', provider: 'openrouter', model: 'qwen/qwen3-30b-a3b-instruct-2507', structuredOutputMode: 'json-schema' },
  candidate: { id: 'free', provider: 'openrouter', model: 'openrouter/free', structuredOutputMode: 'json-schema' },
} satisfies ExperimentDefinition;
