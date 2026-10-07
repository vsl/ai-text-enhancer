import { fingerprintPrompt } from '../services/prompt-builder.ts';
import { buildJudgeRequest } from './jev-evaluator.ts';
import type { AttemptRecord, ExperimentReport, GatePolicy } from './experiments.ts';
import type { LLMResponse } from '../types/llm.types.ts';

const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function percentile(values: number[], fraction: number): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
}
// Langfuse custom buckets are exclusive. Reasoning/cache are subsets, not extra tokens.
export function tokenBuckets(usage: LLMResponse['usage'] | null, reported?: string[], reasoningIsSubset = true): Record<string, number> | undefined {
  if (!usage) return undefined;
  if (reported && (!reported.includes('inputTokens') || !reported.includes('outputTokens'))) return undefined;
  const cached = !reported || reported.includes('cachedTokens') ? usage.cachedTokens ?? 0 : 0;
  const reasoning = !reported || reported.includes('reasoningTokens') ? usage.reasoningTokens ?? 0 : 0;
  if ([usage.inputTokens, usage.outputTokens, cached, reasoning].some(n => !Number.isSafeInteger(n) || n < 0)
    || cached > usage.inputTokens || (reasoningIsSubset && reasoning > usage.outputTokens)) return undefined;
  return { input: usage.inputTokens - cached, output: usage.outputTokens - (reasoningIsSubset ? reasoning : 0),
    ...(usage.cachedTokens !== undefined && (!reported || reported.includes('cachedTokens')) ? { input_cached_tokens: cached } : {}),
    ...(usage.reasoningTokens !== undefined && (!reported || reported.includes('reasoningTokens')) ? { output_reasoning_tokens: reasoning } : {}),
    total: usage.inputTokens + usage.outputTokens + (reasoningIsSubset ? 0 : reasoning) };
}
function measurements(records: AttemptRecord[], judge: boolean) {
  const attempts = records.filter(r => judge ? r.judge !== null : r.generation !== null);
  const usages = attempts.map(r => judge ? r.judge?.usage : r.response?.usage);
  const isReused = (r: AttemptRecord) => judge ? !!r.reuse?.judge : !!r.reuse?.generation;
  const freshAttempts = attempts.filter(r => !isReused(r));
  const sum = (key: 'inputTokens' | 'outputTokens' | 'totalTokens' | 'cost', freshOnly = false) => {
    const values = usages.map((u, i) => !judge && attempts[i].response?.diagnostics.reportedUsage && !attempts[i].response!.diagnostics.reportedUsage!.includes(key) ? undefined
      : key === 'outputTokens' && !judge && attempts[i].response?.provider === 'gemini' && u ? u.outputTokens + (('reasoningTokens' in u ? u.reasoningTokens : 0) ?? 0) : u?.[key])
      .filter((v, i): v is number => (!freshOnly || !isReused(attempts[i])) && typeof v === 'number' && Number.isFinite(v));
    const count = freshOnly ? freshAttempts.length : attempts.length;
    return { reportedTotal: values.length ? values.reduce((a, b) => a + b, 0) : freshOnly && count === 0 ? 0 : null,
      available: values.length, attempted: count, complete: values.length === count && (count > 0 || freshOnly) };
  };
  const latencies = attempts.map(r => judge ? r.judge!.latencyMs : r.generation!.latencyMs);
  const freshLatencies = freshAttempts.map(r => judge ? r.judge!.latencyMs : r.generation!.latencyMs);
  const optionalTokens = (key: 'cachedTokens' | 'reasoningTokens') => {
    const values = attempts.map(r => judge ? r.judge?.usage?.[key] : r.response?.diagnostics.reportedUsage && !r.response.diagnostics.reportedUsage.includes(key) ? undefined : r.response?.usage[key]).filter((n): n is number => n !== undefined);
    return { reportedTotal: values.length ? values.reduce((a, b) => a + b, 0) : null, available: values.length };
  };
  return { latency: { medianMs: percentile(latencies, .5), p95Ms: percentile(latencies, .95), minMs: latencies.length ? Math.min(...latencies) : null,
    maxMs: latencies.length ? Math.max(...latencies) : null }, inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens'),
    totalTokens: sum('totalTokens'), costUsd: sum('cost'), cachedTokens: optionalTokens('cachedTokens'), reasoningTokens: optionalTokens('reasoningTokens'),
    reused: attempts.length - freshAttempts.length, newCalls: freshAttempts.length,
    newCostUsd: sum('cost', true), newTokens: sum('totalTokens', true),
    freshLatency: { medianMs: percentile(freshLatencies, .5), p95Ms: percentile(freshLatencies, .95) } };
}
export function summarizeCandidate(report: ExperimentReport, id: string) {
  const records = report.records.filter(r => r.candidateId === id);
  const dimensions: Record<string, number[]> = {}, slices: Record<string, number[]> = {};
  for (const r of records) for (const metric of r.judge?.metrics ?? []) {
    (dimensions[metric.name] ??= []).push(metric.value);
    for (const tag of r.tags) (slices[tag] ??= []).push(metric.value);
  }
  const checks = records.flatMap(r => r.checks);
  const scores = Object.values(dimensions).flat();
  return { id, expected: report.fixtures.length * report.definition.repetitions, attempted: records.length,
    complete: records.filter(r => !r.error && r.output !== null).length,
    deterministicPassRate: checks.length ? checks.filter(c => c.passed).length / checks.length : null,
    semanticMean: average(scores), dimensions: Object.fromEntries(Object.entries(dimensions).map(([k, v]) => [k, average(v)])),
    slices: Object.fromEntries(Object.entries(slices).map(([k, v]) => [k, average(v)])),
    generation: measurements(records, false), judging: measurements(records, true),
    errors: records.filter(r => r.error).map(r => ({ caseId: r.caseId, attempt: r.attempt, ...r.error })) };
}

export interface ReviewArtifact {
  schemaVersion: 1;
  decision: 'approved' | 'rejected';
  reviewer: string;
  reviewedAt: string;
  notes: string;
  humanReviewUrl: string;
  reportHash: string;
  comparisonId: string;
  runIds: Record<string, string>;
  candidate: ExperimentReport['definition']['candidates'][number];
  datasetHash: string;
  evaluatorHash: string;
  judgeModel: string;
  repetitions: number;
  thresholds: GatePolicy;
  semanticGatesApproved: boolean;
  exceptions: string[];
  protectedCases: Array<{ id: string; promptFingerprint: string; checks: string[]; semanticPassed: boolean }>;
  summary: ReturnType<typeof summarizeCandidate>;
}
export async function validateStoredReport(report: ExperimentReport): Promise<void> {
  if (report.schemaVersion !== 1 || !Array.isArray(report.fixtures) || !report.fixtures.length || !Array.isArray(report.records)
    || report.definition.candidates.length !== 2 || !Number.isInteger(report.definition.repetitions) || report.definition.repetitions < 1) throw new Error('Invalid stored experiment report');
  if (await fingerprintPrompt(JSON.stringify(report.fixtures)) !== report.datasetHash
    || await fingerprintPrompt(JSON.stringify(report.evaluator)) !== report.evaluatorHash) throw new Error('Stored dataset/evaluator hash mismatch');
  for (const record of report.records) if (JSON.stringify(record.fixture) !== JSON.stringify(report.fixtures.find(f => f.id === record.caseId))) throw new Error('Attempt fixture differs from frozen dataset');
}
export function evaluateGates(report: ExperimentReport, approved?: ReviewArtifact) {
  const failures: string[] = [], advisory: string[] = [], regressions: Array<{ caseId: string; attempt: number; candidateId: string; check: string }> = [];
  const summaries = report.definition.candidates.map(c => summarizeCandidate(report, c.id));
  const expectedKeys = new Set(report.definition.candidates.flatMap(c => report.fixtures.flatMap(f =>
    Array.from({ length: report.definition.repetitions }, (_, i) => `${c.id}/${f.id}/${i + 1}`))));
  const actualKeys = report.records.map(r => `${r.candidateId}/${r.caseId}/${r.attempt}`);
  if (actualKeys.length !== expectedKeys.size || new Set(actualKeys).size !== actualKeys.length || actualKeys.some(k => !expectedKeys.has(k))) failures.push('Incomplete or duplicate attempt matrix');
  const semanticBlocking = approved?.decision === 'approved' && approved.semanticGatesApproved;
  const semanticIssues: string[] = [];
  if (approved && (approved.decision !== 'approved' || approved.datasetHash !== report.datasetHash || approved.evaluatorHash !== report.evaluatorHash
    || approved.judgeModel !== report.definition.judge.model || approved.repetitions !== report.definition.repetitions
    || JSON.stringify(approved.thresholds) !== JSON.stringify(report.definition.gates))) failures.push('Approved baseline dataset/evaluator/judge/repetition/policy mismatch');
  if (approved && JSON.stringify(approved.candidate) !== JSON.stringify(report.definition.candidates[0])) failures.push('Experiment baseline identity/settings do not match the explicitly approved baseline');
  for (const r of report.records) {
    const key = `${r.candidateId}/${r.caseId}/${r.attempt}`;
    if (r.error || r.output === null || !r.checks.some(c => c.check === 'valid-json-text-contract' && c.passed)) failures.push(`${key}: incomplete result${r.error ? ` (${r.error.stage})` : ''}`);
    if (r.fixture.critical && r.checks.some(c => !c.passed)) failures.push(`${key}: critical deterministic failure`);
    if (report.definition.judge.enabled && r.fixture.judge !== false) {
      const names = Object.keys(buildJudgeRequest(r.fixture, r.output ?? '', report.definition.judge.model).questions);
      if (r.judge?.status !== 'success' || names.some(name => !r.judge!.metrics.some(m => m.name === name && Number.isFinite(m.value)))) failures.push(`${key}: required judge scores missing`);
      else if (r.judge.metrics.some(m => m.value < report.definition.gates.semanticMinimum)) semanticIssues.push(`${key}: semantic minimum not met`);
    }
    const matching = report.records.find(b => b.candidateId === report.definition.candidates[0].id && b.caseId === r.caseId && b.attempt === r.attempt);
    if (r.candidateId !== report.definition.candidates[0].id) for (const check of r.checks) {
      if (!check.passed && matching?.checks.some(c => c.check === check.check && c.passed)) regressions.push({ caseId: r.caseId, attempt: r.attempt, candidateId: r.candidateId, check: check.check });
    }
    const protectedCase = approved?.protectedCases.find(c => c.id === r.caseId);
    if (protectedCase && r.candidateId === report.definition.candidates[0].id && r.prompt?.promptFingerprint !== protectedCase.promptFingerprint) failures.push(`${key}: baseline rendered prompt changed`);
    if (protectedCase && r.candidateId !== report.definition.candidates[0].id && protectedCase.checks.some(name => !r.checks.some(c => c.check === name && c.passed))) failures.push(`${key}: newly failing protected baseline case`);
    if (protectedCase?.semanticPassed && r.candidateId !== report.definition.candidates[0].id && r.judge?.metrics.some(m => m.value < report.definition.gates.semanticMinimum)) semanticIssues.push(`${key}: protected semantic regression`);
  }
  const [baseline, candidate] = summaries;
  if (baseline.semanticMean !== null && candidate.semanticMean !== null && baseline.semanticMean - candidate.semanticMean > report.definition.gates.aggregateTolerance) semanticIssues.push('Overall semantic regression exceeds tolerance');
  for (const [tag, value] of Object.entries(baseline.slices)) if (value !== null && candidate.slices[tag] !== undefined && candidate.slices[tag] !== null
    && value - candidate.slices[tag]! > report.definition.gates.sliceTolerance) semanticIssues.push(`Slice regression exceeds tolerance: ${tag}`);
  if (approved && candidate.semanticMean !== null && approved.summary.semanticMean !== null
    && approved.summary.semanticMean - candidate.semanticMean > report.definition.gates.aggregateTolerance) semanticIssues.push('Overall regression against approved baseline exceeds tolerance');
  for (const summary of summaries) {
    if (report.definition.gates.maxP95LatencyMs !== undefined && (summary.generation.latency.p95Ms === null || summary.generation.latency.p95Ms > report.definition.gates.maxP95LatencyMs)) failures.push(`${summary.id}: generation latency limit not met`);
    if (report.definition.gates.maxCostUsd !== undefined) {
      const gen = summary.generation.costUsd, judge = summary.judging.costUsd;
      if (!gen.complete || (report.definition.judge.enabled && judge.attempted > 0 && !judge.complete) || (gen.reportedTotal ?? 0) + (judge.reportedTotal ?? 0) > report.definition.gates.maxCostUsd) failures.push(`${summary.id}: cost limit exceeded or cost unavailable`);
    }
  }
  if (semanticBlocking) failures.push(...semanticIssues.filter(issue => !approved?.exceptions.includes(issue)));
  else advisory.push(...semanticIssues);
  return { eligible: failures.length === 0, semanticGates: semanticBlocking ? 'enforced' : 'advisory', thresholds: report.definition.gates,
    failures: [...new Set(failures)], advisory: [...new Set(advisory)], regressions, summaries,
    totals: { generation: measurements(report.records, false), judging: measurements(report.records, true) } };
}

export async function createReview(report: ExperimentReport, input: Pick<ReviewArtifact, 'decision' | 'reviewer' | 'notes' | 'humanReviewUrl' | 'semanticGatesApproved' | 'exceptions' | 'runIds'> & { candidateId: string }, approved?: ReviewArtifact): Promise<ReviewArtifact> {
  await validateStoredReport(report);
  if (!['approved', 'rejected'].includes(input.decision) || typeof input.semanticGatesApproved !== 'boolean'
    || !Array.isArray(input.exceptions) || input.exceptions.some(e => typeof e !== 'string')) throw new Error('Invalid review decision, semantic gate approval or exceptions');
  if (!input.reviewer.trim() || !input.notes.trim() || !/^https?:\/\//.test(input.humanReviewUrl)) throw new Error('Reviewer, notes and human review URL are required');
  const candidate = report.definition.candidates.find(c => c.id === input.candidateId);
  if (!candidate) throw new Error('Unknown reviewed candidate');
  if (input.decision === 'approved') {
    if (!['all', 'acceptance'].includes(report.definition.suite) || report.partialSuite) throw new Error('Only a complete frozen acceptance suite can become a baseline');
    if (!report.definition.judge.enabled || report.fixtures.some(f => f.judge === false)) throw new Error('Baseline approval requires semantic evaluation of every acceptance case');
    if (Object.keys(input.runIds).length !== 2 || report.definition.candidates.some(c => !input.runIds[c.id])) throw new Error('Approval requires both published run IDs');
    const gates = evaluateGates(report, approved);
    if (gates.failures.length) throw new Error(`Hard gate failures cannot be excepted: ${gates.failures.join('; ')}`);
    if (input.semanticGatesApproved && gates.advisory.some(issue => !input.exceptions.includes(issue))) throw new Error('Every advisory semantic failure requires an explicit accepted exception');
  }
  const records = report.records.filter(r => r.candidateId === candidate.id);
  return { schemaVersion: 1, ...input, reviewedAt: new Date().toISOString(), reportHash: await fingerprintPrompt(JSON.stringify(report)),
    comparisonId: report.comparisonId, candidate, datasetHash: report.datasetHash, evaluatorHash: report.evaluatorHash,
    judgeModel: report.definition.judge.model, repetitions: report.definition.repetitions, thresholds: report.definition.gates,
    protectedCases: report.fixtures.map(f => { const attempts = records.filter(r => r.caseId === f.id);
      return { id: f.id, promptFingerprint: attempts[0]?.prompt?.promptFingerprint ?? '',
        checks: attempts[0]?.checks.filter(c => attempts.every(r => r.checks.some(x => x.check === c.check && x.passed))).map(c => c.check) ?? [],
        semanticPassed: attempts.length === report.definition.repetitions && attempts.every(r => r.judge?.status === 'success' && r.judge.metrics.every(m => m.value >= report.definition.gates.semanticMinimum)) };
    }), summary: summarizeCandidate(report, candidate.id) };
}
