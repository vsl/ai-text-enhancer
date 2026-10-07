import { MODELS } from '../config/models.config.ts';
import { PROMPT_VERSION } from '../services/prompt-templates.ts';
import { getRoleById } from '../config/roles.config.ts';
import { getLimitsForTier } from '../config/tier-limits.config.ts';
import { parseTextOutput } from '../config/output-contract.config.ts';
import { constructPrompt, fingerprintPrompt } from '../services/prompt-builder.ts';
import { generationSettings, type GenerationSettings } from '../services/generation-settings.ts';
import { validateOptions } from '../services/request-validator.ts';
import type { ConstructedPrompt } from '../types/prompt.types.ts';
import type { UserTier } from '../types/auth.types.ts';
import type { LLMConnector, LLMRequestParams, LLMResponse } from '../types/llm.types.ts';
import type { DecisionConnector } from '../connectors/openrouter-decision-connector.ts';
import { preflightCandidate, runDeterministicChecks, type EvaluationCandidate, type PromptEvaluationCase, type CatalogPreflight } from './prompt-evaluator.ts';
import { evaluateWithJev, EVALUATOR_DEFINITION, type JudgeEvaluation } from './jev-evaluator.ts';

export interface PromptVariant {
  id: string;
  version: string;
  build(input: { aiRoleId: string; userText: string; contextText?: string; options: PromptEvaluationCase['options'] }): Promise<ConstructedPrompt>;
}
export const PRODUCTION_PROMPT: PromptVariant = { id: 'production', version: PROMPT_VERSION, build: constructPrompt };
export interface ExperimentCandidate extends EvaluationCandidate {
  id: string;
  prompt?: PromptVariant;
  settings?: GenerationSettings;
}
export interface GatePolicy {
  semanticMinimum: number;
  aggregateTolerance: number;
  sliceTolerance: number;
  maxP95LatencyMs?: number;
  maxCostUsd?: number;
}
export const DEFAULT_GATES: GatePolicy = { semanticMinimum: 0.6, aggregateTolerance: 0.02, sliceTolerance: 0.05 };
export interface ExperimentDefinition {
  id: string;
  mode: 'models' | 'prompts';
  suite?: 'acceptance' | 'development';
  baseline: ExperimentCandidate;
  candidate: ExperimentCandidate;
  tier?: UserTier;
  settings?: GenerationSettings;
  repetitions?: number;
  judge?: { enabled: boolean; model?: string; timeoutMs?: number };
  gates?: Partial<GatePolicy>;
}
export interface AttemptRecord {
  candidateId: string;
  caseId: string;
  attempt: number;
  fixture: PromptEvaluationCase;
  tags: string[];
  prompt: ConstructedPrompt | null;
  request: LLMRequestParams | null;
  response: LLMResponse | null;
  output: string | null;
  preparationMs: number;
  generation: { startedAt: string; endedAt: string; latencyMs: number } | null;
  checksMs: number;
  checks: Array<{ check: string; passed: boolean }>;
  judge: JudgeEvaluation | null;
  error: { stage: 'preflight' | 'prompt' | 'generation' | 'parse' | 'checks' | 'judge'; message: string; code?: string; statusCode?: number; details?: unknown } | null;
}
export interface ExperimentReport {
  schemaVersion: 1;
  comparisonId: string;
  generatedAt: string;
  git: { revision: string; dirty: boolean };
  datasetHash: string;
  evaluatorHash: string;
  evaluator: typeof EVALUATOR_DEFINITION;
  definition: {
    id: string; mode: ExperimentDefinition['mode']; suite: string; tier: UserTier; repetitions: number;
    judge: { enabled: boolean; model: string; timeoutMs: number }; gates: GatePolicy;
    candidates: Array<{ id: string; provider: EvaluationCandidate['provider']; model: string;
      prompt: { id: string; version: string }; settings: GenerationSettings }>;
  };
  fixtures: PromptEvaluationCase[];
  preflights: Record<string, CatalogPreflight>;
  records: AttemptRecord[];
  partialSuite?: boolean;
  overrides?: Record<string, unknown>;
}

export function resolvedSettings(candidate: ExperimentCandidate, definition: ExperimentDefinition): GenerationSettings {
  const configured = MODELS.find(m => m.provider === candidate.provider && m.providerModelId === candidate.model);
  return { ...generationSettings({ structuredOutputMode: candidate.structuredOutputMode,
    serviceTier: configured?.serviceTier, reasoningEffort: configured?.reasoningEffort }, definition.tier ?? 'free'),
    ...definition.settings, ...candidate.settings };
}
export function caseTags(item: PromptEvaluationCase): string[] {
  return [...new Set([`role:${item.roleId}`, `language:${item.language}`, ...(item.tags ?? []),
    ...Object.entries(item.options).map(([key, value]) => `option:${key}:${value}`)])];
}
const json = (value: unknown) => JSON.stringify(value);
function requireString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a nonblank string`);
}
export function validateExperiment(definition: ExperimentDefinition, cases: PromptEvaluationCase[]): void {
  requireString(definition.id, 'Experiment id');
  if (!['models', 'prompts'].includes(definition.mode)) throw new Error('mode must be models or prompts');
  if (definition.suite !== undefined && !['acceptance', 'development'].includes(definition.suite)) throw new Error('Unknown suite');
  if (definition.tier !== undefined && !['free', 'plus', 'premium'].includes(definition.tier)) throw new Error('Unknown user tier');
  const repetitions = definition.repetitions ?? 3;
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100) throw new Error('repetitions must be 1 to 100');
  const candidates = [definition.baseline, definition.candidate];
  for (const candidate of candidates) {
    if (!candidate) throw new Error('Both baseline and candidate are required');
    requireString(candidate.id, 'Candidate id'); requireString(candidate.model, 'Model');
    if (!['gemini', 'openrouter'].includes(candidate.provider)) throw new Error('Unsupported provider');
    const prompt = candidate.prompt ?? PRODUCTION_PROMPT;
    requireString(prompt.id, 'Prompt id'); requireString(prompt.version, 'Prompt version');
    if (typeof prompt.build !== 'function') throw new Error('Prompt variant requires a build function');
    const settings = resolvedSettings(candidate, definition);
    const allowed = ['structuredOutputMode', 'serviceTier', 'reasoningEffort', 'temperature', 'maxTokens', 'timeout'];
    if ([...Object.keys(candidate.settings ?? {}), ...Object.keys(definition.settings ?? {})].some(k => !allowed.includes(k))) throw new Error('Unknown generation setting');
    if (!['json-schema', 'json-object'].includes(settings.structuredOutputMode ?? '')) throw new Error('Unsupported output mode');
    if (candidate.provider === 'gemini' && settings.structuredOutputMode !== 'json-schema') throw new Error('Gemini requires json-schema');
    if (settings.serviceTier !== undefined && settings.serviceTier !== 'flex') throw new Error('Unsupported service tier');
    if (settings.reasoningEffort !== undefined && !['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(settings.reasoningEffort)) throw new Error('Unsupported reasoning effort');
    for (const key of ['maxTokens', 'timeout'] as const) if (!Number.isSafeInteger(settings[key]) || settings[key]! <= 0) throw new Error(`${key} must be a positive integer`);
    if (settings.temperature !== undefined && (!Number.isFinite(settings.temperature) || settings.temperature < 0 || settings.temperature > 2)) throw new Error('temperature must be 0 to 2');
  }
  if (candidates[0].id === candidates[1].id) throw new Error('Candidate IDs must be different');
  if (json(resolvedSettings(candidates[0], definition)) !== json(resolvedSettings(candidates[1], definition))) throw new Error('Comparison must use identical generation settings; set common explicit overrides');
  const promptIdentity = (c: ExperimentCandidate) => `${(c.prompt ?? PRODUCTION_PROMPT).id}@${(c.prompt ?? PRODUCTION_PROMPT).version}`;
  const sameModel = candidates[0].provider === candidates[1].provider && candidates[0].model === candidates[1].model;
  if (definition.mode === 'models' && (sameModel || promptIdentity(candidates[0]) !== promptIdentity(candidates[1])
    || (candidates[0].prompt ?? PRODUCTION_PROMPT).build !== (candidates[1].prompt ?? PRODUCTION_PROMPT).build)) throw new Error('Model comparison requires different models and the same prompt builder');
  if (definition.mode === 'prompts' && (!sameModel || promptIdentity(candidates[0]) === promptIdentity(candidates[1]))) throw new Error('Prompt comparison requires the same model and distinct prompt versions');
  if (definition.judge && typeof definition.judge.enabled !== 'boolean') throw new Error('judge.enabled must be a boolean');
  if (definition.judge?.model !== undefined) requireString(definition.judge.model, 'Judge model');
  if (definition.judge?.timeoutMs !== undefined && (!Number.isSafeInteger(definition.judge.timeoutMs) || definition.judge.timeoutMs < 1)) throw new Error('Judge timeout must be a positive integer');
  const gates = { ...DEFAULT_GATES, ...definition.gates };
  if (Object.keys(gates).some(k => !['semanticMinimum', 'aggregateTolerance', 'sliceTolerance', 'maxP95LatencyMs', 'maxCostUsd'].includes(k))) throw new Error('Unknown gate');
  for (const key of ['semanticMinimum', 'aggregateTolerance', 'sliceTolerance'] as const) if (!Number.isFinite(gates[key]) || gates[key] < 0 || gates[key] > 1) throw new Error(`${key} must be 0 to 1`);
  for (const key of ['maxP95LatencyMs', 'maxCostUsd'] as const) if (gates[key] !== undefined && (!Number.isFinite(gates[key]) || gates[key]! < 0)) throw new Error(`Invalid ${key}`);
  if (!cases.length || new Set(cases.map(c => c.id)).size !== cases.length) throw new Error('Dataset must be nonempty with unique case IDs');
  const limits = getLimitsForTier(definition.tier ?? 'free');
  for (const item of cases) {
    requireString(item.id, 'Case id'); requireString(item.userText, 'Case source'); requireString(item.language, 'Case language');
    if (!getRoleById(item.roleId)) throw new Error(`Unknown role: ${item.roleId}`);
    if (item.contextText !== undefined && typeof item.contextText !== 'string') throw new Error('contextText must be a string');
    if (item.userText.length > limits.maxUserTextLength || (item.contextText?.length ?? 0) > limits.maxContextTextLength) throw new Error(`Case ${item.id} exceeds ${definition.tier ?? 'free'} input limits`);
    validateOptions(item.options);
    for (const key of ['critical', 'judge'] as const) if (item[key] !== undefined && typeof item[key] !== 'boolean') throw new Error(`Case ${key} must be boolean`);
    for (const key of ['tags', 'expectations'] as const) if (item[key] !== undefined && (!Array.isArray(item[key]) || item[key]!.some(v => typeof v !== 'string'))) throw new Error(`Invalid ${key}`);
    if (!Array.isArray(item.checks)) throw new Error('checks must be an array');
    for (const check of item.checks) {
      if (!check || !['contains', 'not-contains', 'matches', 'no-emoji', 'max-length-ratio', 'min-length-ratio'].includes(check.type)) throw new Error('Unknown deterministic check');
      if (['contains', 'not-contains', 'matches'].includes(check.type) && typeof (check as { value: unknown }).value !== 'string') throw new Error('Check value must be a string');
      if (check.type === 'matches') new RegExp(check.value, check.flags);
      if ((check.type === 'max-length-ratio' || check.type === 'min-length-ratio') && (!Number.isFinite(check.value) || check.value <= 0)) throw new Error('Length ratio must be positive');
    }
  }
}

export async function createExperimentReport(definition: ExperimentDefinition, fixtures: PromptEvaluationCase[],
  git: ExperimentReport['git'], comparisonId = crypto.randomUUID()): Promise<ExperimentReport> {
  validateExperiment(definition, fixtures);
  return { schemaVersion: 1, comparisonId, generatedAt: new Date().toISOString(), git,
    datasetHash: await fingerprintPrompt(json(fixtures)), evaluatorHash: await fingerprintPrompt(json(EVALUATOR_DEFINITION)),
    evaluator: EVALUATOR_DEFINITION, fixtures, preflights: {}, records: [], definition: {
      id: definition.id, mode: definition.mode, suite: definition.suite ?? 'acceptance', tier: definition.tier ?? 'free', repetitions: definition.repetitions ?? 3,
      judge: { enabled: definition.judge?.enabled ?? true, model: definition.judge?.model ?? 'typesafe/jev-1.13', timeoutMs: definition.judge?.timeoutMs ?? 5000 },
      gates: { ...DEFAULT_GATES, ...definition.gates },
      candidates: [definition.baseline, definition.candidate].map(candidate => ({ id: candidate.id, provider: candidate.provider, model: candidate.model,
        prompt: { id: (candidate.prompt ?? PRODUCTION_PROMPT).id, version: (candidate.prompt ?? PRODUCTION_PROMPT).version }, settings: resolvedSettings(candidate, definition) })),
    } };
}

export async function runExperiment(definition: ExperimentDefinition, report: ExperimentReport, dependencies: {
  connectors: Partial<Record<EvaluationCandidate['provider'], LLMConnector>>;
  keys: Partial<Record<EvaluationCandidate['provider'], string>>;
  judge?: DecisionConnector;
  fetchImpl?: typeof fetch;
  onRecord?: (record: AttemptRecord) => Promise<void>;
}): Promise<void> {
  validateExperiment(definition, report.fixtures);
  for (const candidate of [definition.baseline, definition.candidate]) {
    const settings = resolvedSettings(candidate, definition);
    report.preflights[candidate.id] = dependencies.keys[candidate.provider] ? await preflightCandidate({ ...candidate,
      structuredOutputMode: settings.structuredOutputMode! }, dependencies.keys[candidate.provider], dependencies.fetchImpl)
      : { status: 'missing-api-key', supportedParameters: [], message: `${candidate.provider} key is missing` };
  }
  for (const item of report.fixtures) for (let attempt = 1; attempt <= report.definition.repetitions; attempt++) {
    const candidates = attempt % 2 ? [definition.baseline, definition.candidate] : [definition.candidate, definition.baseline];
    const prompts = new Map<string, ConstructedPrompt>();
    // Also compare rendered prompts, not just their declared version.
    for (const candidate of candidates) {
      const started = Date.now();
      let stage: NonNullable<AttemptRecord['error']>['stage'] = 'preflight';
      const record: AttemptRecord = { candidateId: candidate.id, caseId: item.id, attempt, fixture: item,
        tags: caseTags(item), prompt: null, request: null, response: null, output: null,
        preparationMs: 0, generation: null, checksMs: 0, checks: [], judge: null, error: null };
      try {
        const preflight = report.preflights[candidate.id];
        const connector = dependencies.connectors[candidate.provider];
        if (preflight.status !== 'available' || !connector) throw new Error(preflight.message ?? 'Connector is unavailable');
        stage = 'prompt';
        record.prompt = await (candidate.prompt ?? PRODUCTION_PROMPT).build({ aiRoleId: item.roleId,
          userText: item.userText, contextText: item.contextText, options: item.options });
        requireString(record.prompt.systemPrompt, 'System prompt'); requireString(record.prompt.userPrompt, 'User prompt');
        record.prompt.promptFingerprint = await fingerprintPrompt(record.prompt.systemPrompt);
        const previous = [...prompts.values()][0];
        if (definition.mode === 'models' && previous && (previous.systemPrompt !== record.prompt.systemPrompt || previous.userPrompt !== record.prompt.userPrompt)) throw new Error('Model comparison produced different prompts');
        prompts.set(candidate.id, record.prompt);
        record.preparationMs = Date.now() - started;
        record.request = { model: candidate.model, requestId: `${report.comparisonId}-${candidate.id}-${item.id}-${attempt}`,
          systemPrompt: record.prompt.systemPrompt, userPrompt: record.prompt.userPrompt, ...resolvedSettings(candidate, definition) };
        stage = 'generation';
        const generationStart = Date.now();
        record.generation = { startedAt: new Date(generationStart).toISOString(), endedAt: '', latencyMs: 0 };
        try { record.response = await connector.sendRequest(record.request); }
        finally { record.generation.endedAt = new Date().toISOString(); record.generation.latencyMs = Date.now() - generationStart; }
        stage = 'parse';
        record.output = parseTextOutput(record.response.text, record.response.diagnostics);
        stage = 'checks';
        const checkStart = Date.now();
        record.checks = [{ check: 'valid-json-text-contract', passed: true }, ...runDeterministicChecks(item, record.output)];
        record.checksMs = Date.now() - checkStart;
        if (report.definition.judge.enabled && item.judge !== false) {
          stage = 'judge';
          if (!dependencies.judge) throw new Error('OpenRouter judge key is missing');
          record.judge = await evaluateWithJev(item, record.output, dependencies.judge, report.definition.judge.model);
          if (record.judge.status === 'error') throw new Error(record.judge.error ?? 'Judge failed');
        }
      } catch (error) {
        const e = error as Error & { code?: string; statusCode?: number; details?: unknown };
        record.error = { stage, message: e.message, ...(e.code ? { code: e.code } : {}),
          ...(e.statusCode ? { statusCode: e.statusCode } : {}), ...(e.details !== undefined ? { details: e.details } : {}) };
        if (stage === 'parse') record.checks.push({ check: 'valid-json-text-contract', passed: false });
      }
      report.records.push(record);
      await dependencies.onRecord?.(record);
    }
  }
}
