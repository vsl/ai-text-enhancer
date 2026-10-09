import type { ExperimentDefinition } from '../../src/evaluation/experiments.ts';

// Full English-focused acceptance suite. Keep both models on identical
// production prompts and each model's own settings; one repetition limits cost.
export default {
  id: 'qwen-vs-glm-5.3-flash', mode: 'models', suite: 'all', repetitions: 1,
  baseline: { id: 'qwen', provider: 'openrouter', model: 'qwen/qwen3-30b-a3b-instruct-2507', structuredOutputMode: 'json-schema' },
  candidate: { id: 'glm', provider: 'openrouter', model: 'z-ai/glm-5.3-flash', structuredOutputMode: 'json-schema' },
} satisfies ExperimentDefinition;
