import { createExperimentReport, runExperiment, validateExperiment, resolvedSettings, prepareExperiment, plannedCalls, PRODUCTION_PROMPT, type AttemptRecord, type ExperimentDefinition, type ExperimentReport } from '../../../src/evaluation/experiments.ts';
import { buildJudgeRequest, parseJudgeResponse, evaluateWithJev } from '../../../src/evaluation/jev-evaluator.ts';
import { createReview, evaluateGates, tokenBuckets } from '../../../src/evaluation/experiment-review.ts';
import { PromptBuilder } from '../../../src/services/prompt-builder.ts';
import { generationSettings } from '../../../src/services/generation-settings.ts';
import { MODELS } from '../../../src/config/models.config.ts';
import { DEVELOPMENT_CASES } from '../../../evaluations/development-cases.ts';
import { CALIBRATION_CONTROLS } from '../../../evaluations/calibration-cases.ts';
import { BOOLEAN_TRANSFORMATION_KEYS, FORMALITY_VALUES, LANGUAGE_LEVEL_VALUES, LANGUAGE_VALUES, TONE_VALUES } from '../../../src/config/transformation-options.config.ts';
import type { PromptEvaluationCase } from '../../../src/evaluation/prompt-evaluator.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture: PromptEvaluationCase = { id: 'facts', roleId: 'editor', language: 'en', userText: 'Ana will not pay $20.', options: { avoidCommonAiSymbols: true, tone: 'Confident' }, critical: true,
  checks: [{ type: 'contains', value: '$20' }] };
const definition: ExperimentDefinition = { id: 'comparison', mode: 'models', suite: 'acceptance',
  baseline: { id: 'baseline', provider: 'openrouter', model: 'model-a', structuredOutputMode: 'json-schema' },
  candidate: { id: 'candidate', provider: 'openrouter', model: 'model-b', structuredOutputMode: 'json-schema' } };
function judgeResponse(request: ReturnType<typeof buildJudgeRequest>, grade = 3) {
  return { id: 'judge-id', model: 'judge-resolved', provider: 'judge-provider', usage: { input_tokens: 30, output_tokens: 8, cost: .001 },
    answers: Object.fromEntries(Object.entries(request.questions).map(([k, q]) => [k, q.type === 'noul' ? { type: 'noul', noul: .99, probabilities: { true: .99, false: .01 } }
      : { type: 'score', score: grade, confidence: .9, probabilities: { '0': 0, '1': 0, '2': .1, '3': .9 } }])) };
}
async function run(options: { text?: string; grade?: number; generationError?: boolean; judgeError?: boolean; judge?: boolean;
  concurrency?: number; beforeGeneration?: () => Promise<void>; beforeJudge?: () => Promise<void>; onRecord?: (record: AttemptRecord) => Promise<void>;
  definition?: ExperimentDefinition; fixtures?: PromptEvaluationCase[]; sources?: ExperimentReport[]; executionHash?: string } = {}) {
  const def = { ...definition, judge: { enabled: options.judge ?? true }, ...options.definition };
  const report = await createExperimentReport(def, options.fixtures ?? [fixture], { revision: 'commit', dirty: false });
  report.executionHash = options.executionHash ?? 'execution-v1';
  const prepared = await prepareExperiment(def, report, options.sources);
  const calls = plannedCalls(report, prepared);
  const sendRequest = jest.fn().mockImplementation(async () => {
    await options.beforeGeneration?.();
    if (options.generationError) throw new Error('Provider failed');
    return { text: options.text ?? '{"text":"Ana will not pay $20."}', model: 'resolved', provider: 'provider',
      usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130, cachedTokens: 20, reasoningTokens: 10, cost: .002 },
      diagnostics: { httpStatus: 200, providerModel: 'model-a', latencyMs: 20 } };
  });
  const decide = jest.fn().mockImplementation(async request => {
    await options.beforeJudge?.();
    if (options.judgeError) throw new Error('Judge failed');
    return judgeResponse(request, options.grade);
  });
  const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [def.baseline.model, def.candidate.model].map(id => ({ id, supported_parameters: ['response_format'] })) }) });
  await runExperiment(def, report, { keys: { openrouter: 'key' }, prepared, concurrency: options.concurrency, onRecord: options.onRecord,
    connectors: { openrouter: { name: 'openrouter', supportsStreaming: false, sendRequest } }, judge: { decide }, fetchImpl });
  return { report, sendRequest, decide, fetchImpl, calls };
}
describe('evaluation experiments', () => {
  it('production prompt parity covers every role and UI option configuration', async () => {
    const builder = new PromptBuilder();
    for (const f of DEVELOPMENT_CASES.filter(f => f.id.startsWith('coverage-'))) {
      const input = { id: 'test', model: 'qwen-3-30b', aiRoleId: f.roleId, userText: f.userText, contextText: f.contextText, options: f.options };
      // Use the public model ID from the catalog, not a provider ID.
      input.model = MODELS.find(m => m.providerModelId === 'qwen/qwen3-30b-a3b-instruct-2507')!.id;
      expect(await PRODUCTION_PROMPT.build(input)).toEqual(await builder.buildPrompt(input));
    }
  });
  it('uses production tier, reasoning, service tier and timeout defaults', () => {
    const model = MODELS.find(m => m.providerModelId === 'openai/gpt-5-nano')!;
    const candidate = { ...definition.baseline, model: model.providerModelId };
    expect(resolvedSettings(candidate, { ...definition, tier: 'premium' })).toEqual(generationSettings(model, 'premium'));
    expect(resolvedSettings(candidate, definition)).toMatchObject({ maxTokens: 3500, timeout: 30000, serviceTier: 'flex', reasoningEffort: 'minimal' });
  });
  it('rejects undeclared axes and validates fixtures before paid calls', () => {
    expect(() => validateExperiment(definition, [fixture])).not.toThrow();
    expect(() => validateExperiment({ ...definition, candidate: { ...definition.candidate, settings: { maxTokens: 10 } } }, [fixture])).toThrow('identical generation');
    expect(() => validateExperiment({ ...definition, mode: 'prompts' }, [fixture])).toThrow('same model');
    expect(() => validateExperiment({ ...definition, repetitions: 0 }, [fixture])).toThrow('repetitions');
    expect(() => validateExperiment(definition, [{ ...fixture, options: { shorten: true, lengthen: true } }])).toThrow();
    expect(() => validateExperiment(definition, [{ ...fixture, checks: [{ type: 'matches', value: '[' }] }])).toThrow();
    expect(() => validateExperiment(definition, [])).toThrow('Dataset');
    expect(() => validateExperiment(definition, [{ ...fixture, roleId: 'summarizer' }])).toThrow('Unknown role');
    expect(() => buildJudgeRequest({ ...fixture, roleId: 'summarizer' }, 'Output', 'judge')).toThrow('Unknown evaluator role');
  });
  it('preserves six attempts, exact settings, raw outputs and separate judge usage without retries', async () => {
    const { report, sendRequest, decide } = await run();
    expect(sendRequest).toHaveBeenCalledTimes(6); expect(decide).toHaveBeenCalledTimes(6);
    expect(report.records.map(r => r.candidateId)).toEqual(['baseline', 'candidate', 'candidate', 'baseline', 'baseline', 'candidate']);
    expect(report.records.every(r => r.response?.text === '{"text":"Ana will not pay $20."}' && r.prompt && r.request?.maxTokens === 3500)).toBe(true);
    const gates = evaluateGates(report); expect(gates.eligible).toBe(true); expect(gates.semanticGates).toBe('advisory');
    expect(gates.summaries[0].generation.totalTokens.reportedTotal).toBe(390);
    expect(gates.summaries[0].judging.totalTokens.reportedTotal).toBe(114);
  });
  it('checks decoded forbidden symbols and never repairs malformed JSON', async () => {
    const escaped = await run({ text: '{"text":"Ana will not pay $20\\u2014today."}' });
    expect(escaped.report.records[0].output).toContain('—');
    expect(evaluateGates(escaped.report).failures.some(f => f.includes('critical deterministic'))).toBe(true);
    const broken = await run({ text: '{"text":' });
    expect(broken.decide).not.toHaveBeenCalled(); expect(broken.report.records[0].error?.stage).toBe('parse');
    expect(broken.report.records[0].response?.text).toBe('{"text":');
  });
  it.each([1, 5, 10])('bounds generation and judging at concurrency %i and serializes checkpoints', async concurrency => {
    let active = 0, peak = 0, writes = 0, peakWrites = 0;
    const checkpointed: string[] = [];
    const delayedCall = async () => {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
    };
    const { report, sendRequest, decide } = await run({ concurrency,
      fixtures: [fixture, { ...fixture, id: 'second' }, { ...fixture, id: 'third' }],
      beforeGeneration: delayedCall, beforeJudge: delayedCall,
      onRecord: async record => {
        peakWrites = Math.max(peakWrites, ++writes);
        await new Promise(resolve => setTimeout(resolve, 1));
        checkpointed.push(`${record.candidateId}/${record.caseId}/${record.attempt}`);
        writes--;
      } });
    expect(peak).toBe(concurrency); expect(active).toBe(0); expect(peakWrites).toBe(1);
    expect(sendRequest).toHaveBeenCalledTimes(18); expect(decide).toHaveBeenCalledTimes(18);
    expect(new Set(checkpointed).size).toBe(18); expect(report.records).toHaveLength(18);
    expect(checkpointed).toEqual(report.records.map(r => `${r.candidateId}/${r.caseId}/${r.attempt}`));
    expect(evaluateGates(report).eligible).toBe(true);
  });
  it.each([0, -1, 1.5, 11, NaN, Infinity])('rejects concurrency %s before provider calls', async concurrency => {
    const beforeGeneration = jest.fn(), beforeJudge = jest.fn();
    await expect(run({ concurrency, beforeGeneration, beforeJudge })).rejects.toThrow('concurrency');
    expect(beforeGeneration).not.toHaveBeenCalled(); expect(beforeJudge).not.toHaveBeenCalled();
  });
  it.each(['generationError', 'judgeError'] as const)('retains all parallel %s attempts without retries', async flag => {
    const { report, sendRequest } = await run({ concurrency: 5, [flag]: true });
    expect(sendRequest).toHaveBeenCalledTimes(6); expect(report.records).toHaveLength(6);
    expect(report.records.every(r => r.error?.stage === (flag === 'generationError' ? 'generation' : 'judge'))).toBe(true);
    expect(evaluateGates(report).eligible).toBe(false);
  });
  it('drains in-flight attempts and stops new work when a checkpoint fails', async () => {
    let started = 0, active = 0;
    const checkpointed: AttemptRecord[] = [];
    await expect(run({ concurrency: 3,
      beforeGeneration: async () => {
        started++; active++;
        await new Promise(resolve => setTimeout(resolve, 5));
        active--;
      },
      onRecord: async record => {
        checkpointed.push(record);
        if (checkpointed.length === 1) throw new Error('Journal write failed');
      } })).rejects.toThrow('Journal write failed');
    expect(started).toBe(3); expect(active).toBe(0); expect(checkpointed).toHaveLength(3);
    expect(checkpointed.every(r => r.judge?.status === 'success')).toBe(true);
  });
  it.each(['generationError', 'judgeError'] as const)('keeps %s attempts and blocks eligibility', async flag => {
    const { report, sendRequest } = await run({ [flag]: true });
    expect(report.records).toHaveLength(6); expect(sendRequest).toHaveBeenCalledTimes(6);
    expect(evaluateGates(report).eligible).toBe(false);
  });
  it('counts missing metrics as unavailable rather than zero', async () => {
    const { report } = await run();
    delete report.records[0].response!.usage.cost;
    report.definition.gates.maxCostUsd = 1;
    const gate = evaluateGates(report);
    expect(gate.summaries[0].generation.costUsd.complete).toBe(false);
    expect(gate.failures).toContain('baseline: cost limit exceeded or cost unavailable');
  });
  it('reports historical generation failures for retired roles without reconstructing current judge questions', async () => {
    const { report } = await run({ generationError: true });
    report.fixtures = report.fixtures.map(f => ({ ...f, roleId: 'summarizer' }));
    for (const r of report.records) r.fixture = report.fixtures[0];
    const gates = evaluateGates(report);
    expect(gates.eligible).toBe(false);
    expect(gates.failures.some(f => f.includes('required judge scores missing'))).toBe(true);
  });
  it('detects incomplete, duplicated and newly failing protected results', async () => {
    const { report } = await run();
    const approved = await createReview(report, { decision: 'approved', reviewer: 'Owner', notes: 'Calibrated against human labels', humanReviewUrl: 'https://langfuse.example/review',
      semanticGatesApproved: true, candidateId: 'baseline', exceptions: [], runIds: { baseline: 'a', candidate: 'b' } });
    expect(evaluateGates(report, approved).semanticGates).toBe('enforced');
    report.records.find(r => r.candidateId === 'candidate')!.checks[1].passed = false;
    expect(evaluateGates(report, approved).failures.some(f => f.includes('protected baseline'))).toBe(true);
    report.records.pop(); expect(evaluateGates(report).eligible).toBe(false);
    report.records.push(report.records[0]); expect(evaluateGates(report).failures[0]).toContain('duplicate');
  });
  it('semantic gates are advisory before calibration; approval needs review, full suite and matching identity', async () => {
    const { report } = await run({ grade: 1 });
    expect(evaluateGates(report).eligible).toBe(true); expect(evaluateGates(report).advisory.length).toBeGreaterThan(0);
    report.partialSuite = true;
    await expect(createReview(report, { decision: 'approved', reviewer: 'Owner', notes: 'Review', humanReviewUrl: 'https://example.com/review',
      semanticGatesApproved: false, candidateId: 'baseline', exceptions: [], runIds: { baseline: 'a', candidate: 'b' } })).rejects.toThrow('complete frozen');
  });
  it('judge criteria are atomic, independently frozen and distinguish probabilities from grades', () => {
    const request = buildJudgeRequest({ ...fixture, contextText: 'Old thread', options: { tone: 'Confident', fixMistakes: false, languageLevel: 'default' } }, 'Output', 'judge');
    expect(request.questions.option_tone).toBeDefined(); expect(request.questions.option_fixMistakes).toBeUndefined(); expect(request.questions.option_languageLevel).toBeUndefined();
    expect(request.questions.context_correctness).toBeDefined(); expect(JSON.stringify(request.state)).not.toContain('systemPrompt');
    const parsed = parseJudgeResponse(request, judgeResponse(request, 2));
    expect(parsed.metrics.find(m => m.name === 'meaning_preserved')).toMatchObject({ type: 'score', rawValue: 2, value: 2 / 3, confidence: .9 });
    expect(parsed.metrics.find(m => m.name === 'factual_grounding')).toMatchObject({ type: 'noul', rawValue: .99, value: .99, scale: null });
    const broken = judgeResponse(request); delete (broken.answers as Record<string, unknown>).meaning_preserved;
    expect(() => parseJudgeResponse(request, broken)).toThrow('Invalid Jev metric');
  });
  it('retains paid judge usage and raw answers when a required metric is malformed', async () => {
    const request = buildJudgeRequest(fixture, 'Output', 'judge');
    const raw = judgeResponse(request); delete (raw.answers as Record<string, unknown>).meaning_preserved;
    const result = await evaluateWithJev(fixture, 'Output', { decide: async () => raw }, 'judge');
    expect(result.status).toBe('error'); expect(result.rawResponse).toBe(raw);
    expect(result.usage).toMatchObject({ totalTokens: 38, cost: .001 }); expect(result.model).toBe('judge-resolved');
  });
  it('maps token categories without double counting', () => {
    expect(tokenBuckets({ inputTokens: 100, outputTokens: 30, totalTokens: 130, cachedTokens: 20, reasoningTokens: 10 })).toEqual({ input: 80, output: 20, input_cached_tokens: 20, output_reasoning_tokens: 10, total: 130 });
    expect(tokenBuckets(null)).toBeUndefined(); expect(tokenBuckets({ inputTokens: 1, outputTokens: 1, totalTokens: 2, cachedTokens: 2 })).toBeUndefined();
    expect(tokenBuckets({ inputTokens: 100, outputTokens: 5, reasoningTokens: 20, totalTokens: 125 }, undefined, false)).toEqual({ input: 100, output: 5, output_reasoning_tokens: 20, total: 125 });
    expect(tokenBuckets({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }, [])).toBeUndefined();
  });
  it('judges email perspective independently and includes observed failures in calibration controls', () => {
    const f = DEVELOPMENT_CASES.find(c => c.id === 'coverage-email_assistant-context-conflict')!;
    const request = buildJudgeRequest(f, 'Hi Alex, thanks for the update. Thanks, Morgan', 'judge');
    expect(request.state).toMatchObject({ source: f.userText, context: f.contextText, expectations: f.expectations });
    expect(request.questions.source_perspective).toMatchObject({ type: 'noul', instructions: expect.stringContaining('from Alex to Morgan') });
    expect(request.questions.meaning_preserved.instructions).toContain('invented confirmation');
    const response = judgeResponse(request);
    response.answers.source_perspective = { type: 'noul', noul: .02, probabilities: { true: .02, false: .98 } };
    expect(parseJudgeResponse(request, response).metrics.find(m => m.name === 'source_perspective')).toMatchObject({ value: .02, scale: null });
    delete response.answers.source_perspective;
    expect(() => parseJudgeResponse(request, response)).toThrow('source_perspective');
    expect(buildJudgeRequest(fixture, 'Output', 'judge').questions.source_perspective).toBeUndefined();
    for (const name of ['perspective-faithful', 'perspective-reversed', 'confirmation-request-faithful', 'invented-confirmation']) {
      const control = CALIBRATION_CONTROLS.find(c => c.id === `email_assistant-${name}`)!;
      expect(control).toBeDefined();
      const questions = buildJudgeRequest(control.fixture, control.output, 'judge').questions;
      for (const metric of Object.keys(control.proposedLabels)) expect(questions[metric]).toBeDefined();
    }
  });
  it('checks required metrics against the rubric actually used, preserving historical runs', async () => {
    const email = DEVELOPMENT_CASES.find(c => c.id === 'coverage-email_assistant-context-conflict')!;
    const { report } = await run({ fixtures: [email], text: '{"text":"Subject: Update\\n\\nHi Morgan,\\nFriday delivery, $20 refund, approval uncertain.\\n\\nThanks,\\nAlex"}' });
    expect(evaluateGates(report).eligible).toBe(true);
    report.records[0].judge!.metrics = report.records[0].judge!.metrics.filter(m => m.name !== 'source_perspective');
    expect(evaluateGates(report).failures).toContain('baseline/coverage-email_assistant-context-conflict/1: required judge scores missing');
    // A saved v1 request did not ask this question; v2 must not rewrite history.
    report.evaluator = { ...report.evaluator, version: 'text-quality-v1' };
    for (const r of report.records) {
      delete r.judge!.request.questions.source_perspective;
      r.judge!.metrics = r.judge!.metrics.filter(m => m.name !== 'source_perspective');
    }
    expect(evaluateGates(report).eligible).toBe(true);
  });
  it('supports the prompt axis without changing request settings', async () => {
    const variant = { id: 'experiment', version: 'v1', build: async (input: Parameters<typeof PRODUCTION_PROMPT.build>[0]) => {
      const prompt = await PRODUCTION_PROMPT.build(input); return { ...prompt, systemPrompt: `${prompt.systemPrompt}\nCheck facts.` };
    } };
    const def: ExperimentDefinition = { ...definition, mode: 'prompts', candidate: { ...definition.candidate, model: definition.baseline.model, prompt: variant } };
    expect(() => validateExperiment(def, [fixture])).not.toThrow();
    expect(resolvedSettings(def.baseline, def)).toEqual(resolvedSettings(def.candidate, def));
    const input = { aiRoleId: fixture.roleId, userText: fixture.userText, options: fixture.options };
    expect((await variant.build(input)).systemPrompt).not.toEqual((await PRODUCTION_PROMPT.build(input)).systemPrompt);
  });
  it('can disable paid judging explicitly and preserves missing provider keys without fallback', async () => {
    const disabled = await run({ judge: false }); expect(disabled.decide).not.toHaveBeenCalled();
    expect(disabled.report.records.every(r => r.judge === null)).toBe(true);
    const report = await createExperimentReport(definition, [fixture], { revision: 'commit', dirty: false });
    const fetchImpl = jest.fn();
    await runExperiment(definition, report, { keys: {}, connectors: {}, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled(); expect(report.records).toHaveLength(6);
    expect(report.records.every(r => r.error?.stage === 'preflight')).toBe(true);
    expect(evaluateGates(report).eligible).toBe(false);
  });
  it('reports absent provider usage independently of legacy zero fallbacks', async () => {
    const { report } = await run();
    for (const record of report.records) record.response!.diagnostics.reportedUsage = [];
    const summary = evaluateGates(report).summaries[0];
    expect(summary.generation.inputTokens).toMatchObject({ reportedTotal: null, available: 0, complete: false });
    expect(summary.generation.reasoningTokens.reportedTotal).toBeNull();
  });
  it('frozen acceptance fixtures focus on English with one spot check per selected language', () => {
    const cases = JSON.parse(readFileSync(resolve('evaluations/acceptance.json'), 'utf8')) as PromptEvaluationCase[];
    validateExperiment(definition, cases); expect(cases).toHaveLength(140);
    expect(cases.filter(c => c.language === 'en')).toHaveLength(137);
    expect(cases.filter(c => c.language !== 'en').map(c => c.options.translateTo)).toEqual(['es', 'pt', 'en']);
    for (const role of ['editor', 'email_assistant']) {
      const rows = cases.filter(c => c.roleId === role);
      for (const [key, values] of Object.entries({ formality: FORMALITY_VALUES, tone: TONE_VALUES, languageLevel: LANGUAGE_LEVEL_VALUES }))
        for (const value of values) expect(rows.some(r => r.options[key as keyof typeof r.options] === value)).toBe(true);
      for (const key of BOOLEAN_TRANSFORMATION_KEYS) for (const value of [true, false]) expect(rows.some(r => r.options[key] === value)).toBe(true);
      expect(rows.some(r => !Object.keys(r.options).length)).toBe(true);
    }
    // The exhaustive language matrix is still checked offline, not paid per run.
    for (const language of LANGUAGE_VALUES) expect(DEVELOPMENT_CASES.some(c => c.options.translateTo === language)).toBe(true);
    const ids = JSON.parse(readFileSync(resolve('evaluations/base-case-ids.json'), 'utf8')) as string[];
    expect(ids).toHaveLength(26); expect(new Set(ids).size).toBe(ids.length);
    const base = ids.map(id => cases.find(c => c.id === id)!);
    expect(base.every(Boolean)).toBe(true); validateExperiment({ ...definition, suite: 'base' }, base);
    expect(base.filter(c => c.language !== 'en')).toHaveLength(3);
    for (const role of ['editor', 'email_assistant']) expect(base.some(c => c.roleId === role && !Object.keys(c.options).length)).toBe(true);
  });

  it.each([1, 5])('reuses an unchanged baseline with concurrency %i, paying only for the new model', async concurrency => {
    const previous = await run();
    const current = await run({ concurrency, sources: [previous.report], definition: { ...definition, id: 'new-comparison',
      baseline: { ...definition.baseline, id: 'renamed-baseline' }, candidate: { ...definition.candidate, model: 'model-c' } } });
    expect(current.calls).toEqual({ generations: 3, judgments: 3, reusedGenerations: 3, reusedJudgments: 3, catalogChecks: 1 });
    expect(current.sendRequest).toHaveBeenCalledTimes(3); expect(current.decide).toHaveBeenCalledTimes(3);
    expect(current.fetchImpl).toHaveBeenCalledTimes(1);
    const summary = evaluateGates(current.report).summaries[0];
    expect(summary.generation).toMatchObject({ reused: 3, newCalls: 0, newCostUsd: { reportedTotal: 0, complete: true }, costUsd: { reportedTotal: .006 }, freshLatency: { p95Ms: null } });
    expect(current.report.records[0].reuse).toMatchObject({ generation: { comparisonId: previous.report.comparisonId, candidateId: 'baseline' }, judge: { comparisonId: previous.report.comparisonId } });
    expect(evaluateGates(current.report).eligible).toBe(true);
  });
  it('can reuse every result without provider keys or network calls, retaining original samples and measurements', async () => {
    const previous = await run();
    const original = JSON.stringify(previous.report);
    const report = await createExperimentReport(definition, [fixture], { revision: 'new', dirty: true });
    report.executionHash = previous.report.executionHash;
    const prepared = await prepareExperiment(definition, report, [previous.report]);
    const fetchImpl = jest.fn();
    await runExperiment(definition, report, { keys: {}, connectors: {}, fetchImpl, prepared, concurrency: 5 });
    expect(fetchImpl).not.toHaveBeenCalled(); expect(evaluateGates(report).eligible).toBe(true);
    expect(report.records.every(r => r.reuse?.generation && r.reuse.judge)).toBe(true);
    expect(report.records[0].generation).toEqual(previous.report.records[0].generation);
    expect(report.records[0].response).toEqual(previous.report.records[0].response);
    expect(JSON.stringify(previous.report)).toBe(original);
    const totals = evaluateGates(report).totals;
    expect(totals.generation.newCostUsd.reportedTotal).toBe(0); expect(totals.judging.newCostUsd.reportedTotal).toBe(0);
  });
  it('does not clone one cached repetition into multiple independent samples', async () => {
    const previous = await run({ definition: { ...definition, repetitions: 1 } });
    const current = await run({ sources: [previous.report] });
    expect(current.calls).toMatchObject({ generations: 4, judgments: 4, reusedGenerations: 2, reusedJudgments: 2 });
    expect(current.report.records.filter(r => r.reuse).map(r => r.attempt)).toEqual([1, 1]);
  });
  it('also reuses the unchanged production prompt when comparing a new prompt implementation', async () => {
    const previous = await run();
    const prompt = { id: 'new-prompt', version: 'v1', build: async (input: Parameters<typeof PRODUCTION_PROMPT.build>[0]) => {
      const p = await PRODUCTION_PROMPT.build(input); return { ...p, systemPrompt: `${p.systemPrompt}\nCheck facts.` };
    } };
    const current = await run({ sources: [previous.report], definition: { ...definition, mode: 'prompts',
      candidate: { ...definition.candidate, model: definition.baseline.model, prompt } } });
    expect(current.calls).toMatchObject({ generations: 3, judgments: 3, reusedGenerations: 3, reusedJudgments: 3 });
    expect(current.sendRequest).toHaveBeenCalledTimes(3); expect(current.decide).toHaveBeenCalledTimes(3);
  });
  it('reuses a code-only run and pays only for newly enabled Jev judging', async () => {
    const previous = await run({ judge: false });
    const current = await run({ sources: [previous.report] });
    expect(current.sendRequest).not.toHaveBeenCalled(); expect(current.decide).toHaveBeenCalledTimes(6);
  });
  it('detects unequal rendered model prompts before any paid call, including cache hits', async () => {
    let counter = 0;
    const prompt = { ...PRODUCTION_PROMPT, build: async (input: Parameters<typeof PRODUCTION_PROMPT.build>[0]) => {
      const p = await PRODUCTION_PROMPT.build(input); return { ...p, systemPrompt: `${p.systemPrompt}\nRevision ${++counter}` };
    } };
    const current = await run({ definition: { ...definition, baseline: { ...definition.baseline, prompt }, candidate: { ...definition.candidate, prompt } } });
    expect(current.sendRequest).not.toHaveBeenCalled(); expect(current.decide).not.toHaveBeenCalled();
    expect(current.fetchImpl).not.toHaveBeenCalled();
    expect(current.report.records.every(r => r.error?.stage === 'prompt')).toBe(true);
  });
  it.each(['source', 'context', 'options', 'settings', 'prompt', 'execution'] as const)('invalidates generation reuse when %s changes', async change => {
    const previous = await run();
    let def = definition, changedFixture = fixture;
    if (change === 'source') changedFixture = { ...fixture, userText: `${fixture.userText} Thanks.` };
    if (change === 'context') changedFixture = { ...fixture, contextText: 'Background.' };
    if (change === 'options') changedFixture = { ...fixture, options: { ...fixture.options, formality: 'Formal' } };
    if (change === 'settings') def = { ...definition, settings: { temperature: .1 } };
    if (change === 'prompt') {
      const prompt = { ...PRODUCTION_PROMPT, build: async (input: Parameters<typeof PRODUCTION_PROMPT.build>[0]) => {
        const p = await PRODUCTION_PROMPT.build(input); return { ...p, systemPrompt: `${p.systemPrompt}\nCheck facts.` };
      } };
      def = { ...definition, baseline: { ...definition.baseline, prompt }, candidate: { ...definition.candidate, prompt } };
    }
    const current = await run({ sources: [previous.report], definition: def, fixtures: [changedFixture], executionHash: change === 'execution' ? 'execution-v2' : undefined });
    expect(current.calls.reusedGenerations).toBe(0); expect(current.sendRequest).toHaveBeenCalledTimes(6);
  });
  it.each(['model', 'rubric'] as const)('reuses generation but rejudges when judge %s changes', async change => {
    const previous = await run();
    if (change === 'rubric') previous.report.evaluatorHash = 'old-rubric';
    const current = await run({ sources: [previous.report], definition: change === 'model'
      ? { ...definition, judge: { enabled: true, model: 'another-judge' } } : definition });
    expect(current.sendRequest).not.toHaveBeenCalled(); expect(current.decide).toHaveBeenCalledTimes(6);
    expect(current.calls).toMatchObject({ generations: 0, judgments: 6, reusedGenerations: 6, reusedJudgments: 0 });
    expect(current.report.records.every(r => r.reuse?.generation && !r.reuse.judge)).toBe(true);
  });
  it('reruns deterministic checks rather than trusting cached check results', async () => {
    const previous = await run({ text: '{"text":"Ana will not pay $20—today."}' });
    previous.report.records.forEach(r => r.checks.forEach(c => c.passed = true));
    const current = await run({ sources: [previous.report] });
    expect(current.sendRequest).not.toHaveBeenCalled();
    expect(current.report.records.every(r => r.checks.some(c => !c.passed))).toBe(true);
    expect(evaluateGates(current.report).eligible).toBe(false);
  });
  it('runs new code assertions for free and pays only for judging when semantic expectations change', async () => {
    const previous = await run();
    const code = await run({ sources: [previous.report], fixtures: [{ ...fixture, checks: [{ type: 'contains', value: 'missing fact' }] }] });
    expect(code.sendRequest).not.toHaveBeenCalled(); expect(code.decide).not.toHaveBeenCalled();
    expect(code.report.records.every(r => r.checks.some(c => !c.passed))).toBe(true);
    const semantic = await run({ sources: [previous.report], fixtures: [{ ...fixture, expectations: ['Preserve negation.'] }] });
    expect(semantic.sendRequest).not.toHaveBeenCalled(); expect(semantic.decide).toHaveBeenCalledTimes(6);
  });
  it.each(['generationError', 'judgeError'] as const)('does not reuse failed %s attempts', async flag => {
    const previous = await run({ [flag]: true });
    const current = await run({ sources: [previous.report] });
    expect(current.calls.reusedGenerations).toBe(0); expect(current.sendRequest).toHaveBeenCalledTimes(6);
    expect(previous.report.records.every(r => r.error)).toBe(true);
  });
  it('reparses raw judge answers; corrupt answers are rejudged, not accepted from cached metrics', async () => {
    const previous = await run();
    for (const r of previous.report.records) delete (r.judge!.rawResponse as { answers: Record<string, unknown> }).answers.meaning_preserved;
    const current = await run({ sources: [previous.report] });
    expect(current.sendRequest).not.toHaveBeenCalled(); expect(current.decide).toHaveBeenCalledTimes(6);
  });
  it('keeps unavailable historical cost unavailable while showing zero marginal cache spend', async () => {
    const previous = await run();
    previous.report.records.forEach(r => delete r.response!.usage.cost);
    const current = await run({ sources: [previous.report] });
    const totals = evaluateGates(current.report).totals.generation;
    expect(totals.costUsd.reportedTotal).toBeNull(); expect(totals.costUsd.complete).toBe(false);
    expect(totals.newCostUsd).toMatchObject({ reportedTotal: 0, complete: true });
  });
  it('does not reuse variable routing aliases or outputs without implementation provenance', async () => {
    const def = { ...definition, candidate: { ...definition.candidate, model: 'openrouter/free' } };
    const previous = await run({ definition: def });
    const current = await run({ definition: def, sources: [previous.report] });
    expect(current.calls.reusedGenerations).toBe(3); expect(current.sendRequest).toHaveBeenCalledTimes(3);
    delete previous.report.executionHash;
    const unversioned = await run({ definition: def, sources: [previous.report] });
    expect(unversioned.calls.reusedGenerations).toBe(0);
  });
  it('base suites cannot become approved acceptance baselines', async () => {
    const { report } = await run({ definition: { ...definition, suite: 'base' } });
    await expect(createReview(report, { decision: 'approved', reviewer: 'Owner', notes: 'Review', humanReviewUrl: 'https://example.com/review',
      semanticGatesApproved: false, candidateId: 'baseline', exceptions: [], runIds: { baseline: 'a', candidate: 'b' } })).rejects.toThrow('complete frozen');
  });
});
