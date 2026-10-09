import { PRODUCTION_PROMPT, type ExperimentDefinition, type PromptVariant } from '../../src/evaluation/experiments.ts';
import { constructPrompt } from '../../src/services/prompt-builder.ts';

const checklist: PromptVariant = {
  id: 'final-checklist', version: 'v1',
  async build(input) {
    const prompt = await constructPrompt(input);
    return { ...prompt, systemPrompt: `${prompt.systemPrompt}\nBefore returning the result, check that all material facts, uncertainty, sender and recipient are preserved. Do not include the checklist in the output.`,
      promptRevision: `${prompt.promptRevision}/final-checklist-v1` };
  },
};
export default {
  id: 'production-vs-final-checklist', mode: 'prompts', suite: 'base', repetitions: 1,
  baseline: { id: 'production', provider: 'openrouter', model: 'openai/gpt-5-nano', structuredOutputMode: 'json-schema', prompt: PRODUCTION_PROMPT },
  candidate: { id: 'checklist', provider: 'openrouter', model: 'openai/gpt-5-nano', structuredOutputMode: 'json-schema', prompt: checklist },
} satisfies ExperimentDefinition;
