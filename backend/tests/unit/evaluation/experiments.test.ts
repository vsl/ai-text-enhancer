import { createExperimentReport, runExperiment, validateExperiment, resolvedSettings, PRODUCTION_PROMPT, type ExperimentDefinition } from '../../../src/evaluation/experiments.ts';
import { buildJudgeRequest, parseJudgeResponse, evaluateWithJev } from '../../../src/evaluation/jev-evaluator.ts';
import { createReview, evaluateGates, tokenBuckets } from '../../../src/evaluation/experiment-review.ts';
import { PromptBuilder } from '../../../src/services/prompt-builder.ts';
import { generationSettings } from '../../../src/services/generation-settings.ts';
import { MODELS } from '../../../src/config/models.config.ts';
import { DEVELOPMENT_CASES } from '../../../evaluations/development-cases.ts';
import { BOOLEAN_TRANSFORMATION_KEYS, FORMALITY_VALUES, LANGUAGE_LEVEL_VALUES, LANGUAGE_VALUES, TONE_VALUES } from '../../../src/config/transformation-options.config.ts';
import type { PromptEvaluationCase } from '../../../src/evaluation/prompt-evaluator.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture: PromptEvaluationCase = { id: 'facts', roleId: 'editor', language: 'en', userText: 'Ana will not pay $20.', options: { avoidCommonAiSymbols: true, tone: 'Confident' }, critical: true,
  checks: [{ type: 'contains', value: '$20' }] };
const definition: ExperimentDefinition = { id: 'comparison', mode: 'models',
  baseline: { id: 'baseline', provider: 'openrouter', model: 'model-a', structuredOutputMode: 'json-schema' },
  candidate: { id: 'candidate', provider: 'openrouter', model: 'model-b', structuredOutputMode: 'json-schema' } };
function judgeResponse(request: ReturnType<typeof buildJudgeRequest>, grade = 3) {
  return { id: 'judge-id', model: 'judge-resolved', provider: 'judge-provider', usage: { input_tokens: 30, output_tokens: 8, cost: .001 },
    answers: Object.fromEntries(Object.entries(request.questions).map(([k, q]) => [k, q.type === 'noul' ? { type: 'noul', noul: .99, probabilities: { true: .99, false: .01 } }
      : { type: 'score', score: grade, confidence: .9, probabilities: { '0': 0, '1': 0, '2': .1, '3': .9 } }])) };
}
async function run(options: { text?: string; grade?: number; generationError?: boolean; judgeError?: boolean; judge?: boolean } = {}) {
  const def = { ...definition, judge: { enabled: options.judge ?? true } };
  const report = await createExperimentReport(def, [fixture], { revision: 'commit', dirty: false });
  const sendRequest = jest.fn().mockImplementation(async () => {
    if (options.generationError) throw new Error('Provider failed');
    return { text: options.text ?? '{"text":"Ana will not pay $20."}', model: 'resolved', provider: 'provider',
      usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130, cachedTokens: 20, reasoningTokens: 10, cost: .002 },
      diagnostics: { httpStatus: 200, providerModel: 'model-a', latencyMs: 20 } };
  });
  const decide = jest.fn().mockImplementation(async request => {
    if (options.judgeError) throw new Error('Judge failed');
    return judgeResponse(request, options.grade);
  });
  await runExperiment(def, report, { keys: { openrouter: 'key' }, connectors: { openrouter: { name: 'openrouter', supportsStreaming: false, sendRequest } }, judge: { decide },
    fetchImpl: jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: ['model-a', 'model-b'].map(id => ({ id, supported_parameters: ['response_format'] })) }) }) });
  return { report, sendRequest, decide };
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
  it('frozen acceptance fixtures cover every supported UI value and disabled controls independently of development edits', () => {
    const cases = JSON.parse(readFileSync(resolve('evaluations/acceptance.json'), 'utf8')) as PromptEvaluationCase[];
    validateExperiment(definition, cases); expect(cases).toHaveLength(248);
    for (const role of ['editor', 'summarizer', 'email_assistant']) {
      const rows = cases.filter(c => c.roleId === role);
      for (const [key, values] of Object.entries({ formality: FORMALITY_VALUES, tone: TONE_VALUES, languageLevel: LANGUAGE_LEVEL_VALUES, translateTo: LANGUAGE_VALUES }))
        for (const value of values) expect(rows.some(r => r.options[key as keyof typeof r.options] === value)).toBe(true);
      for (const key of BOOLEAN_TRANSFORMATION_KEYS) for (const value of [true, false]) expect(rows.some(r => r.options[key] === value)).toBe(true);
      expect(rows.some(r => !Object.keys(r.options).length)).toBe(true);
    }
  });
});
