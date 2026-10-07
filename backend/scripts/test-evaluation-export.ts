import assert from 'node:assert/strict';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import type { LangfuseClient } from '@langfuse/client';
import { startActiveObservation } from '@langfuse/tracing';
import { publishExperiment } from './lib/langfuse-export.ts';
import { createExperimentReport, type ExperimentDefinition } from '../src/evaluation/experiments.ts';
import { buildJudgeRequest, evaluateWithJev } from '../src/evaluation/jev-evaluator.ts';

// Test real SDK observations with an in-memory exporter; no Langfuse or AI network calls.
process.env.LANGFUSE_PUBLIC_KEY = 'test-public'; process.env.LANGFUSE_SECRET_KEY = 'test-secret'; process.env.LANGFUSE_BASE_URL = 'https://example.invalid';
const spans: Array<{ name: string; attributes: Record<string, unknown>; startTime: number[]; endTime: number[] }> = [];
const processor = new LangfuseSpanProcessor({ mediaUploadEnabled: false, exporter: {
  export(batch, callback) { spans.push(...batch); callback({ code: 0 }); }, async shutdown() {},
} });
const definition: ExperimentDefinition = { id: 'export-test', mode: 'models', repetitions: 1,
  baseline: { id: 'a', model: 'a', provider: 'openrouter', structuredOutputMode: 'json-schema' },
  candidate: { id: 'b', model: 'b', provider: 'openrouter', structuredOutputMode: 'json-schema' } };
const fixture = { id: 'f', roleId: 'editor', language: 'en', userText: 'Hello.', options: {}, checks: [] };
const report = await createExperimentReport(definition, [fixture], { revision: 'test', dirty: false });
const judgeRequest = buildJudgeRequest(fixture, 'Hello.', 'judge');
const judge = await evaluateWithJev(fixture, 'Hello.', { async decide() { return { model: 'judge', answers: Object.fromEntries(Object.entries(judgeRequest.questions).map(([name, q]) => [name, q.type === 'noul' ? { type: 'noul', noul: .9 } : { type: 'score', score: 3, confidence: .8 } ])), usage: { input_tokens: 10, output_tokens: 5, cost: .001 } }; } });
report.records = ['a', 'b'].map(candidateId => ({ candidateId, caseId: 'f', attempt: 1, fixture, tags: ['role:editor'],
  prompt: { systemPrompt: 'System', userPrompt: 'User', promptRevision: 'v1', promptFingerprint: 'hash' },
  request: { model: candidateId, systemPrompt: 'System', userPrompt: 'User' }, output: 'Hello.',
  response: { text: '{"text":"Hello."}', model: 'resolved', provider: 'provider', usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130, reasoningTokens: 10, cachedTokens: 20, cost: .01 },
    diagnostics: { httpStatus: 200, providerModel: candidateId, latencyMs: 123 } },
  generation: { startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:00.123Z', latencyMs: 123 }, preparationMs: 1, checksMs: 1,
  checks: [{ check: 'valid-json-text-contract', passed: true }], judge, error: null }));
let flushes = 0, tasks = 0;
const failExport = process.argv.includes('--fail-export');
const client = {
  async createDataset() {}, async createDatasetItem(item: Record<string, unknown>) { return item; },
  experiment: { async run(config: { data: Array<{ metadata: Record<string, unknown> }>; task: (item: unknown) => Promise<unknown>; evaluators: Array<(item: unknown) => Promise<unknown[]>> }) {
    const itemResults: Array<{ evaluations: unknown[]; traceId: string }> = [];
    for (const item of config.data) await startActiveObservation('experiment-task', async () => {
      tasks++; const output = await config.task(item); assert.equal(output, 'Hello.');
      const evaluations = await config.evaluators[0]({ metadata: item.metadata, output });
      assert.ok(evaluations.length > 5); itemResults.push({ evaluations, traceId: 'trace' });
    });
    return { datasetRunId: `run-${tasks}`, datasetRunUrl: 'https://example.invalid/run', itemResults };
  } },
  async flush() { flushes++; if (failExport) throw new Error('Simulated export failure'); }, async shutdown() { flushes++; },
} as unknown as LangfuseClient;
const publication = await publishExperiment(report, undefined, { client, processor });
assert.equal(publication.status, failExport ? 'error' : 'complete', publication.error);
if (failExport) assert.equal(publication.error, 'Simulated export failure');
assert.equal(tasks, 2); assert.equal(Object.keys(publication.runs).length, 2); assert.equal(flushes, 2);
assert.equal(spans.filter(s => s.name === 'generator').length, 2); assert.equal(spans.filter(s => s.name === 'judge').length, 2);
const generation = spans.find(s => s.name === 'generator')!;
assert.equal((generation.endTime[0] - generation.startTime[0]) * 1000 + (generation.endTime[1] - generation.startTime[1]) / 1e6, 123);
assert.ok(JSON.stringify(generation.attributes).includes('input_cached_tokens'));
assert.ok(JSON.stringify(generation.attributes).includes('output_reasoning_tokens'));
console.log(`Langfuse ${failExport ? 'export failure' : 'export'} verified: two generator + two judge observations, original timing, token buckets, scores, flush; zero AI calls.`);
