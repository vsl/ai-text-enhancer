import { parseTextOutput } from '../config/output-contract.config.ts';
import { getRoleById } from '../config/roles.config.ts';
import { MODELS } from '../config/models.config.ts';
import { PromptTemplates, PROMPT_VERSION } from '../services/prompt-templates.ts';
import type { TransformationOptions } from '../types/api.types.ts';
import type { ModelConfig, StructuredOutputMode } from '../types/config.types.ts';
import type { LLMConnector } from '../types/llm.types.ts';
import { buildPromptRevision, fingerprintPrompt } from '../services/prompt-builder.ts';
import { checkOutput } from '../services/output-checks.ts';
import { JEV_POLICY_VERSION, type ResultSelector } from '../services/jev-result-selector.ts';
import type { BatchSelection } from '../types/api.types.ts';

export type EvaluationProvider = 'gemini' | 'openrouter';

export interface EvaluationCandidate {
  provider: EvaluationProvider;
  model: string;
  structuredOutputMode: StructuredOutputMode;
}

export type EvaluationCheck =
  | { type: 'contains' | 'not-contains' | 'matches'; value: string; flags?: string }
  | { type: 'no-emoji' }
  | { type: 'max-length-ratio' | 'min-length-ratio'; value: number };

export interface PromptEvaluationCase {
  id: string;
  roleId: string;
  language: string;
  userText: string;
  contextText?: string;
  options: TransformationOptions;
  checks: EvaluationCheck[];
}

export interface CatalogPreflight {
  status: 'available' | 'unavailable' | 'unsupported' | 'missing-api-key' | 'error';
  supportedParameters: string[];
  message?: string;
}

export interface PromptEvaluationReport {
  promptVersion: string;
  judgePolicyVersion: string | null;
  generatedAt: string;
  candidates: Array<{
    provider: EvaluationProvider;
    requestedModel: string;
    modelRevision: string | null;
    structuredOutputMode: StructuredOutputMode;
    settings: {
      temperature: null;
      maxTokens: number;
      reasoningEffort?: ModelConfig['reasoningEffort'];
    };
    preflight: CatalogPreflight;
    status: 'completed' | 'skipped';
    skipReason: string | null;
    cases: Array<{
      caseId: string;
      attempt: number;
      roleId: string;
      language: string;
      promptVersion: string;
      promptRevision: string;
      promptFingerprint: string;
      rawResponse: string | null;
      output: string | null;
      latencyMs: number;
      tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
      modelRevision: string | null;
      deterministicChecks: Array<{ check: string; passed: boolean }>;
      error: string | null;
      judge: BatchSelection | null;
      humanReview: {
        meaningPreserved: number | null;
        roleFit: number | null;
        languageQuality: number | null;
        notes: string | null;
      };
    }>;
  }>;
}

const MAX_TOKENS = 2000;

export async function preflightCandidate(
  candidate: EvaluationCandidate,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<CatalogPreflight> {
  try {
    if (candidate.provider === 'gemini') {
      if (!apiKey) {
        return { status: 'missing-api-key', supportedParameters: [], message: 'GEMINI_API_KEY is not set' };
      }
      if (candidate.structuredOutputMode !== 'json-schema') {
        return { status: 'unsupported', supportedParameters: [], message: 'Gemini adapter requires json-schema mode' };
      }

      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate.model)}?key=${encodeURIComponent(apiKey)}`,
      );
      if (response.status === 404) {
        return { status: 'unavailable', supportedParameters: [], message: 'Model is not in the Gemini catalog' };
      }
      if (!response.ok) {
        return { status: 'error', supportedParameters: [], message: `Gemini catalog returned HTTP ${response.status}` };
      }

      const data = await response.json() as { supportedGenerationMethods?: string[] };
      const methods = data.supportedGenerationMethods ?? [];
      return methods.includes('generateContent')
        ? { status: 'available', supportedParameters: methods }
        : { status: 'unsupported', supportedParameters: methods, message: 'generateContent is not supported' };
    }

    const response = await fetchImpl('https://openrouter.ai/api/v1/models');
    if (!response.ok) {
      return { status: 'error', supportedParameters: [], message: `OpenRouter catalog returned HTTP ${response.status}` };
    }

    const data = await response.json() as {
      data?: Array<{ id?: string; supported_parameters?: string[] }>;
    };
    const model = data.data?.find((item) => item.id === candidate.model);
    if (!model) {
      return { status: 'unavailable', supportedParameters: [], message: 'Model is not in the OpenRouter catalog' };
    }

    const supportedParameters = model.supported_parameters ?? [];
    return supportedParameters.includes('response_format')
      ? { status: 'available', supportedParameters }
      : { status: 'unsupported', supportedParameters, message: 'response_format is not supported' };
  } catch (error) {
    return { status: 'error', supportedParameters: [], message: (error as Error).message };
  }
}

export function runDeterministicChecks(
  evaluationCase: PromptEvaluationCase,
  output: string,
): Array<{ check: string; passed: boolean }> {
  return [
    ...(evaluationCase.options.avoidCommonAiSymbols === true
      ? [{ check: 'no-em-dash', passed: checkOutput(evaluationCase.options, output).length === 0 }] : []),
    ...evaluationCase.checks.map((check) => {
      switch (check.type) {
        case 'contains':
          return { check: `contains:${check.value}`, passed: output.includes(check.value) };
        case 'not-contains':
          return { check: `not-contains:${check.value}`, passed: !output.includes(check.value) };
        case 'matches':
          return { check: `matches:${check.value}`, passed: new RegExp(check.value, check.flags).test(output) };
        case 'no-emoji':
          return { check: 'no-emoji', passed: !/\p{Extended_Pictographic}/u.test(output) };
        case 'max-length-ratio':
          return { check: `max-length-ratio:${check.value}`, passed: output.length <= evaluationCase.userText.length * check.value };
        case 'min-length-ratio':
          return { check: `min-length-ratio:${check.value}`, passed: output.length >= evaluationCase.userText.length * check.value };
      }
    }),
  ];
}

export async function runPromptEvaluation(params: {
  candidates: EvaluationCandidate[];
  cases: PromptEvaluationCase[];
  apiKeys: Partial<Record<EvaluationProvider, string>>;
  connectors: Partial<Record<EvaluationProvider, LLMConnector>>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  repetitions?: number;
  selector?: ResultSelector;
}): Promise<PromptEvaluationReport> {
  const now = params.now ?? Date.now;
  const repetitions = params.repetitions ?? 1;
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100) {
    throw new Error('Repetitions must be an integer from 1 to 100');
  }
  const report: PromptEvaluationReport = {
    promptVersion: PROMPT_VERSION,
    judgePolicyVersion: params.selector ? JEV_POLICY_VERSION : null,
    generatedAt: new Date(now()).toISOString(),
    candidates: [],
  };

  for (const candidate of params.candidates) {
    const preflight = await preflightCandidate(candidate, params.apiKeys[candidate.provider], params.fetchImpl);
    const connector = params.connectors[candidate.provider];
    const reasoningEffort = MODELS.find(model =>
      model.provider === candidate.provider && model.providerModelId === candidate.model
    )?.reasoningEffort;
    const candidateReport: PromptEvaluationReport['candidates'][number] = {
      provider: candidate.provider,
      requestedModel: candidate.model,
      modelRevision: null,
      structuredOutputMode: candidate.structuredOutputMode,
      settings: { temperature: null, maxTokens: MAX_TOKENS, reasoningEffort },
      preflight,
      status: preflight.status === 'available' && connector ? 'completed' : 'skipped',
      skipReason: preflight.status !== 'available'
        ? (preflight.message ?? preflight.status)
        : connector ? null : `${candidate.provider.toUpperCase()} API key is not set`,
      cases: [],
    };

    if (candidateReport.status === 'completed' && connector) {
      for (const { evaluationCase, attempt } of params.cases.flatMap(evaluationCase =>
        Array.from({ length: repetitions }, (_, index) => ({ evaluationCase, attempt: index + 1 }))
      )) {
        const startedAt = now();
        let output: string | null = null;
        let rawResponse: string | null = null;
        let tokenUsage: PromptEvaluationReport['candidates'][number]['cases'][number]['tokenUsage'] = null;
        let modelRevision: string | null = null;
        let error: string | null = null;
        let deterministicChecks: Array<{ check: string; passed: boolean }> = [];
        let promptRevision = PROMPT_VERSION;
        let promptFingerprint = '';
        let judge: BatchSelection | null = null;

        try {
          const role = getRoleById(evaluationCase.roleId);
          if (!role) throw new Error(`Unknown evaluation role: ${evaluationCase.roleId}`);
          const systemPrompt = PromptTemplates.buildSystemPrompt(role.systemPrompt, evaluationCase.options);
          promptRevision = buildPromptRevision(role.id, role.systemPromptVersion);
          promptFingerprint = await fingerprintPrompt(systemPrompt);

          const response = await connector.sendRequest({
            model: candidate.model,
            systemPrompt,
            userPrompt: PromptTemplates.buildUserPrompt({
              userText: evaluationCase.userText,
              contextText: evaluationCase.contextText,
            }),
            structuredOutputMode: candidate.structuredOutputMode,
            reasoningEffort,
            maxTokens: MAX_TOKENS,
          });
          rawResponse = response.text;
          tokenUsage = response.usage;
          modelRevision = response.model;
          candidateReport.modelRevision ??= response.model;
          output = parseTextOutput(response.text);
          deterministicChecks = [
            { check: 'valid-json-text-contract', passed: true },
            ...runDeterministicChecks(evaluationCase, output),
          ];
          if (params.selector) {
            judge = await params.selector.select({ assistants: [{
              id: evaluationCase.id,
              model: candidate.model,
              aiRoleId: evaluationCase.roleId,
              userText: evaluationCase.userText,
              contextText: evaluationCase.contextText,
              options: evaluationCase.options,
            }] }, [{ id: evaluationCase.id, status: 'success', enhancedText: output,
              total_tokens: response.usage.totalTokens }], `eval-${evaluationCase.id}-${attempt}`);
          }
        } catch (caught) {
          error = (caught as Error).message;
          if (output === null) deterministicChecks.push({ check: 'valid-json-text-contract', passed: false });
          else judge = { status: 'unavailable', reason: 'JUDGE_FAILED' };
        }

        candidateReport.cases.push({
          caseId: evaluationCase.id,
          attempt,
          roleId: evaluationCase.roleId,
          language: evaluationCase.language,
          promptVersion: PROMPT_VERSION,
          promptRevision,
          promptFingerprint,
          rawResponse,
          output,
          latencyMs: Math.max(0, now() - startedAt),
          tokenUsage,
          modelRevision,
          deterministicChecks,
          error,
          judge,
          humanReview: {
            meaningPreserved: null,
            roleFit: null,
            languageQuality: null,
            notes: null,
          },
        });
      }
    }

    report.candidates.push(candidateReport);
  }

  return report;
}

export function evaluationPassed(report: PromptEvaluationReport): boolean {
  return report.candidates.length > 0 && report.candidates.every(candidate =>
    candidate.status === 'completed' && candidate.cases.length > 0 && candidate.cases.every(item =>
      !item.error && item.deterministicChecks.length > 0 && item.deterministicChecks.every(check => check.passed)
      && (report.judgePolicyVersion === null || (item.judge?.status === 'success' && item.judge.selectedResultId !== null))
    )
  );
}
