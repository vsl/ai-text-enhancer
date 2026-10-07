import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fingerprintPrompt } from '../../src/services/prompt-builder.ts';
import type { ExperimentDefinition } from '../../src/evaluation/experiments.ts';
import type { PromptEvaluationCase } from '../../src/evaluation/prompt-evaluator.ts';

// Include wire serialization and strict parsing, not just prompt fingerprints.
const executionFiles = [
  'src/connectors/llm-connectors/openrouter-connector.ts',
  'src/connectors/llm-connectors/gemini-connector.ts',
  'src/connectors/llm-connectors/provider-response.ts',
  'src/config/output-contract.config.ts',
  'src/services/generation-settings.ts',
  'package-lock.json',
];
export async function executionFingerprint(revision?: string): Promise<string> {
  if (revision && !/^[0-9a-f]{40}$/.test(revision)) throw new Error('Invalid saved Git revision');
  const contents = await Promise.all(executionFiles.map(async path => [path, revision
    ? execFileSync('git', ['show', `${revision}:backend/${path}`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
    : await readFile(path, 'utf8')]));
  return fingerprintPrompt(JSON.stringify(contents));
}
export async function loadSuite(suite: ExperimentDefinition['suite'] = 'base'): Promise<PromptEvaluationCase[]> {
  if (suite === 'development') return (await import('../../evaluations/development-cases.ts')).DEVELOPMENT_CASES;
  const all = JSON.parse(await readFile('evaluations/acceptance.json', 'utf8')) as PromptEvaluationCase[];
  if (suite !== 'base') return all;
  const ids = JSON.parse(await readFile('evaluations/base-case-ids.json', 'utf8')) as string[];
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !all.some(c => c.id === id))) throw new Error('Base suite contains duplicate or unknown case IDs');
  return ids.map(id => all.find(c => c.id === id)!);
}
