import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GeminiConnector } from '../src/connectors/llm-connectors/gemini-connector.ts';
import { OpenRouterConnector } from '../src/connectors/llm-connectors/openrouter-connector.ts';
import { MODELS } from '../src/config/models.config.ts';
import {
  runPromptEvaluation,
  type EvaluationCandidate,
  type EvaluationProvider,
} from '../src/evaluation/prompt-evaluator.ts';
import type { LLMConnector } from '../src/types/llm.types.ts';
import { PROMPT_EVALUATION_CASES } from '../evaluations/cases.ts';

function parseCandidates(args: string[]): EvaluationCandidate[] {
  const requested = args.filter((arg) => arg.startsWith('--model=')).map((arg) => arg.slice('--model='.length));
  if (requested.length === 0) {
    return MODELS.map((model) => ({
      provider: model.provider as EvaluationProvider,
      model: model.providerModelId,
      structuredOutputMode: model.structuredOutputMode,
    }));
  }

  return requested.map((value) => {
    const separator = value.indexOf(':');
    if (separator < 1) throw new Error(`Invalid --model value: ${value}`);
    const provider = value.slice(0, separator);
    const modelAndMode = value.slice(separator + 1);
    const modeSeparator = modelAndMode.lastIndexOf('#');
    const model = modeSeparator === -1 ? modelAndMode : modelAndMode.slice(0, modeSeparator);
    const structuredOutputMode = modeSeparator === -1
      ? (provider === 'gemini' ? 'json-schema' : 'json-object')
      : modelAndMode.slice(modeSeparator + 1);

    if ((provider !== 'gemini' && provider !== 'openrouter') ||
        (structuredOutputMode !== 'json-schema' && structuredOutputMode !== 'json-object') ||
        !model) {
      throw new Error(`Invalid --model value: ${value}`);
    }

    return { provider, model, structuredOutputMode };
  });
}

if (process.argv.includes('--help')) {
  console.log('Usage: npm run eval:prompts -- [--model=provider:model-id#json-schema|json-object]');
  process.exit(0);
}

const candidates = parseCandidates(process.argv.slice(2));
const apiKeys: Partial<Record<EvaluationProvider, string>> = {
  gemini: process.env.GEMINI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
};
const connectors: Partial<Record<EvaluationProvider, LLMConnector>> = {};
if (apiKeys.gemini) connectors.gemini = new GeminiConnector(apiKeys.gemini);
if (apiKeys.openrouter) connectors.openrouter = new OpenRouterConnector(apiKeys.openrouter);

const report = await runPromptEvaluation({
  candidates,
  cases: PROMPT_EVALUATION_CASES,
  apiKeys,
  connectors,
});

const outputDirectory = resolve('evaluation-results');
await mkdir(outputDirectory, { recursive: true });
const timestamp = report.generatedAt.replaceAll(':', '-');
const outputPath = resolve(outputDirectory, `${timestamp}.json`);
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

for (const candidate of report.candidates) {
  const passed = candidate.cases.flatMap((item) => item.deterministicChecks).filter((check) => check.passed).length;
  const total = candidate.cases.flatMap((item) => item.deterministicChecks).length;
  console.log(`${candidate.provider}:${candidate.requestedModel} ${candidate.status} (${candidate.preflight.status}); checks ${passed}/${total}`);
}
console.log(`Report: ${outputPath}`);
