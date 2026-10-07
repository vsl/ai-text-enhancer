import { LangfuseClient, type Evaluation } from '@langfuse/client';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { propagateAttributes, startObservation } from '@langfuse/tracing';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { fingerprintPrompt } from '../../src/services/prompt-builder.ts';
import { caseTags, type AttemptRecord, type ExperimentReport } from '../../src/evaluation/experiments.ts';
import { summarizeCandidate, tokenBuckets } from '../../src/evaluation/experiment-review.ts';
import type { CalibrationControl } from '../../evaluations/calibration-cases.ts';
import type { JudgeEvaluation } from '../../src/evaluation/jev-evaluator.ts';

export interface Publication {
  status: 'complete' | 'error';
  runs: Record<string, { id: string; url: string | null; traceIds: string[] }>;
  error?: string;
  reportHash?: string;
}
export function scoresForRecord(record: AttemptRecord | undefined): Evaluation[] {
  if (!record) return [{ name: 'request_complete', value: 0, comment: 'Missing attempted result' }];
  return [
    { name: 'request_complete', value: record.error || record.output === null ? 0 : 1, comment: record.error?.message },
    ...record.checks.map(c => ({ name: `code.${c.check}`, value: c.passed ? 1 : 0 })),
    ...(record.judge?.metrics ?? []).map(m => ({ name: `semantic.${m.name}`, value: m.value,
      metadata: { type: m.type, rawValue: m.rawValue, scale: m.scale, probabilities: m.probabilities, confidence: m.confidence,
        interpretation: m.type === 'noul' ? 'Probability of true, not a rubric grade' : 'Ordered rubric grade normalized to 0..1' } })),
    ...(record.generation ? [{ name: 'generation_latency_ms', value: record.generation.latencyMs }] : []),
    ...(record.judge ? [{ name: 'judge_latency_ms', value: record.judge.latencyMs }] : []),
  ];
}
function publishObservations(record: AttemptRecord) {
  if (record.generation && record.request) {
    const generation = startObservation('generator', { model: record.response?.model ?? record.request.model,
      input: record.request, output: record.response?.text ?? null, usageDetails: tokenBuckets(record.response?.usage ?? null, record.response?.diagnostics.reportedUsage, record.response?.provider !== 'gemini'),
      ...(record.response?.usage.cost !== undefined ? { costDetails: { total: record.response.usage.cost } } : {}),
      level: record.error && record.error.stage !== 'judge' ? 'ERROR' : 'DEFAULT', statusMessage: record.error?.message,
      metadata: { requestedModel: record.request.model, resolvedModel: record.response?.model ?? null,
        provider: record.response?.provider ?? null, providerReportedCost: record.response?.usage.cost ?? null,
        diagnostics: record.response?.diagnostics ?? null, prompt: record.prompt, latencyMs: record.generation.latencyMs,
        usage: record.response?.usage ?? null, failure: record.error } },
    { asType: 'generation', startTime: new Date(record.generation.startedAt) });
    generation.end(new Date(record.generation.endedAt));
  }
  if (record.judge) publishJudgeObservation(record.judge);
}
function publishJudgeObservation(result: JudgeEvaluation) {
  const judge = startObservation('judge', { model: result.model ?? result.request.model,
    input: result.request, output: result.rawResponse, usageDetails: tokenBuckets(result.usage),
    ...(result.usage?.cost !== undefined ? { costDetails: { total: result.usage.cost } } : {}),
    level: result.status === 'error' ? 'ERROR' : 'DEFAULT', statusMessage: result.error ?? undefined,
    metadata: { provider: result.provider, generationId: result.generationId, metrics: result.metrics,
      providerReportedCost: result.usage?.cost ?? null, latencyMs: result.latencyMs } },
  { asType: 'generation', startTime: new Date(result.startedAt) });
  judge.end(new Date(result.endedAt));
}

// Publish already-computed artifacts. This module never imports an AI connector.
// Retrying an export cannot regenerate or rejudge any output.
export async function publishExperiment(report: ExperimentReport, checkpoint?: (publication: Publication) => Promise<void>,
  dependencies: { client?: LangfuseClient; processor?: LangfuseSpanProcessor } = {}): Promise<Publication> {
  const publication: Publication = { status: 'error', runs: {}, reportHash: await fingerprintPrompt(JSON.stringify(report)) };
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_BASE_URL) {
    return { ...publication, error: 'LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and LANGFUSE_BASE_URL are required' };
  }
  const processor = dependencies.processor ?? new LangfuseSpanProcessor({ environment: 'evaluation', release: report.git.revision, mediaUploadEnabled: false });
  const sdk = new NodeSDK({ spanProcessors: [processor] });
  sdk.start();
  const client = dependencies.client ?? new LangfuseClient();
  const logger = client.experiment.logger;
  const originalError = logger?.error;
  const exportErrors: string[] = [];
  if (logger && originalError) logger.error = (message: string, ...messages: unknown[]) => { exportErrors.push(message); originalError.call(logger, message, ...messages); };
  try {
    const name = `text-enhancer/${report.definition.suite}/${report.datasetHash}/repeat-${report.definition.repetitions}`;
    await client.createDataset({ name, description: 'Immutable repository-owned fixture snapshot; no automatic hosted AI evaluators.',
      metadata: { datasetHash: report.datasetHash, suite: report.definition.suite, source: 'Git' } });
    const data = [];
    for (const fixture of report.fixtures) for (let attempt = 1; attempt <= report.definition.repetitions; attempt++) {
      data.push(await client.createDatasetItem({ datasetName: name,
        id: await fingerprintPrompt(`${name}/${fixture.id}/${attempt}`), input: fixture,
        expectedOutput: { expectations: fixture.expectations ?? [], checks: fixture.checks },
        metadata: { caseId: fixture.id, attempt, tags: caseTags(fixture), role: fixture.roleId, language: fixture.language, options: fixture.options } }));
    }
    for (const candidate of report.definition.candidates) {
      const lookup = (metadata: unknown) => { const m = metadata as { caseId?: string; attempt?: number } | undefined;
        return report.records.find(r => r.candidateId === candidate.id && r.caseId === m?.caseId && r.attempt === m?.attempt); };
      const result = await client.experiment.run({ name: report.definition.id, runName: `${report.comparisonId}/${candidate.id}`, data,
        maxConcurrency: 1, description: 'Artifact publication; root duration is export time. Generator/judge observations carry original call timing.',
        metadata: { comparisonId: report.comparisonId, datasetHash: report.datasetHash, evaluatorHash: report.evaluatorHash,
          evaluator: report.evaluator, git: report.git, candidate, definition: report.definition, overrides: report.overrides ?? {},
          partialSuite: report.partialSuite ?? false, judgeExecution: 'external-cli-only', metricsSource: 'provider-reported' },
        task: async item => {
          const record = lookup(item.metadata);
          if (!record) return { error: 'Missing attempted result' };
          return propagateAttributes({ tags: record.tags }, async () => {
            publishObservations(record);
            return record.output ?? { error: record.error, rawOutput: record.response?.text ?? null };
          });
        },
        evaluators: [async ({ metadata }) => scoresForRecord(lookup(metadata))],
        runEvaluators: [async () => { const summary = summarizeCandidate(report, candidate.id);
          return [{ name: 'complete_rate', value: summary.complete / summary.expected },
            ...(summary.semanticMean !== null ? [{ name: 'semantic_mean', value: summary.semanticMean }] : [])]; }],
      });
      if (result.itemResults.some(item => item.evaluations.length === 0) || result.itemResults.length !== data.length) throw new Error('Incomplete Langfuse experiment publication');
      publication.runs[candidate.id] = { id: result.datasetRunId ?? result.experimentId, url: result.datasetRunUrl ?? null,
        traceIds: result.itemResults.flatMap(item => item.traceId ? [item.traceId] : []) };
      await checkpoint?.(publication);
    }
    await client.flush();
    await processor.forceFlush();
    if (exportErrors.length) throw new Error(`Langfuse export reported errors: ${exportErrors.join('; ')}`);
    publication.status = 'complete';
  } catch (error) { publication.error = (error as Error).message; }
  finally {
    try { await client.shutdown(); await sdk.shutdown(); }
    catch (error) { publication.status = 'error'; publication.error = (error as Error).message; }
    if (logger && originalError) logger.error = originalError;
  }
  return publication;
}

export async function publishCalibration(controls: Array<CalibrationControl & { judge: JudgeEvaluation | null }>): Promise<{ id: string; url: string | null }> {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_BASE_URL) throw new Error('Langfuse credentials and base URL are required');
  const processor = new LangfuseSpanProcessor({ environment: 'evaluation', mediaUploadEnabled: false });
  const sdk = new NodeSDK({ spanProcessors: [processor] }); sdk.start();
  const client = new LangfuseClient();
  try {
    const hash = await fingerprintPrompt(JSON.stringify(controls.map(c => ({ fixture: c.fixture, output: c.output }))));
    const name = `text-enhancer/human-calibration/${hash}`;
    await client.createDataset({ name, description: 'Human calibration: label semantic dimensions in an annotation queue. Proposed control labels remain local to avoid anchoring reviewers.' });
    const data = [];
    for (const control of controls) data.push(await client.createDatasetItem({ datasetName: name,
      id: await fingerprintPrompt(`${name}/${control.id}`), input: control.fixture, metadata: { caseId: control.id, tags: control.fixture.tags } }));
    const lookup = (metadata: unknown) => controls.find(c => c.id === (metadata as { caseId: string }).caseId)!;
    const result = await client.experiment.run({ name: 'Human calibration', runName: `calibration-${crypto.randomUUID()}`, data, maxConcurrency: 1,
      metadata: { judgeExecution: 'external-cli-only', humanLabels: 'pending', calibrationHash: hash },
      task: async item => { const control = lookup(item.metadata); if (control.judge) publishJudgeObservation(control.judge); return control.output; },
      evaluators: [async ({ metadata }) => (lookup(metadata).judge?.metrics ?? []).map(m => ({ name: `semantic.${m.name}`, value: m.value, metadata: { ...m } }))],
    });
    await client.flush(); await processor.forceFlush();
    return { id: result.datasetRunId ?? result.experimentId, url: result.datasetRunUrl ?? null };
  } finally { await client.shutdown(); await sdk.shutdown(); }
}
