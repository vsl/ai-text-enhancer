import {
  preflightCandidate,
  runPromptEvaluation,
  runDeterministicChecks,
  type PromptEvaluationCase,
} from '../../../src/evaluation/prompt-evaluator.ts';
import type { LLMConnector } from '../../../src/types/llm.types.ts';
import { ROLES } from '../../../src/config/roles.config.ts';
import { PROMPT_EVALUATION_CASES } from '../../../evaluations/cases.ts';

const evaluationCase: PromptEvaluationCase = {
  id: 'facts',
  roleId: 'editor',
  language: 'en',
  userText: 'Ana will not pay $20 on 4 May.',
  options: { improve: true },
  checks: [
    { type: 'contains', value: 'Ana' },
    { type: 'contains', value: '$20' },
    { type: 'contains', value: 'will not' },
  ],
};

describe('prompt evaluator', () => {
  it.each(PROMPT_EVALUATION_CASES.filter(item => item.id.startsWith('email-source-priority')))(
    '$id accepts the reply and rejects swapped recipients or invented commitments', evaluationCase => {
      const reply = 'Subject: Emergency contact for Casey\n\nDear Morgan,\n\nWe do not have another emergency contact for Casey.\n\nThank you,\nAlex';
      expect(runDeterministicChecks(evaluationCase, reply).every(check => check.passed)).toBe(true);
      for (const badReply of [
        reply.replace('Dear Morgan,', 'Dear Ms. Taylor and Mr. Alex,'),
        reply.replace('We do not have another emergency contact for Casey.', 'Please provide us with a second emergency contact.'),
        reply.replace('Thank you,', 'Our family situation is difficult. We will provide details soon. Thank you,'),
        reply.replace(/Alex$/, 'Morgan'),
      ]) {
        expect(runDeterministicChecks(evaluationCase, badReply).some(check => !check.passed)).toBe(true);
      }
    }
  );

  it('preflights catalog availability and supported parameters', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'available/model', supported_parameters: ['response_format', 'temperature'] },
        ],
      }),
    }) as unknown as typeof fetch;

    await expect(preflightCandidate({
      provider: 'openrouter',
      model: 'available/model',
      structuredOutputMode: 'json-schema',
    }, undefined, fetchImpl)).resolves.toEqual({
      status: 'available',
      supportedParameters: ['response_format', 'temperature'],
    });

    await expect(preflightCandidate({
      provider: 'openrouter',
      model: 'microsoft/mai-ds-r1:free',
      structuredOutputMode: 'json-object',
    }, undefined, fetchImpl)).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('records prompt version, settings, revision, usage, checks, and human-review fields', async () => {
    const sendRequest = jest.fn().mockResolvedValue({
      text: '{"text":"Ana will not pay $20 on 4 May."}',
      usage: { inputTokens: 11, outputTokens: 9, totalTokens: 20 },
      model: 'gemini-2.5-flash-001',
      provider: 'gemini',
    });
    const connector = { name: 'gemini', supportsStreaming: false, sendRequest } as LLMConnector;
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ supportedGenerationMethods: ['generateContent'] }),
    }) as unknown as typeof fetch;

    const report = await runPromptEvaluation({
      candidates: [{ provider: 'gemini', model: 'gemini-2.5-flash', structuredOutputMode: 'json-schema' }],
      cases: [evaluationCase],
      apiKeys: { gemini: 'key' },
      connectors: { gemini: connector },
      fetchImpl,
      now: () => 1000,
    });

    expect(report).toMatchObject({
      promptVersion: 'prompt-v3',
      candidates: [{
        status: 'completed',
        modelRevision: 'gemini-2.5-flash-001',
        settings: { temperature: null, maxTokens: 2000 },
        cases: [{
          promptVersion: 'prompt-v3',
          promptRevision: 'prompt-v3/editor@v1',
          tokenUsage: { totalTokens: 20 },
          error: null,
          humanReview: { meaningPreserved: null, roleFit: null, languageQuality: null, notes: null },
        }],
      }],
    });
    expect(report.candidates[0].cases[0].promptFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(report.candidates[0].cases[0].deterministicChecks.every((check) => check.passed)).toBe(true);
    expect(sendRequest).toHaveBeenCalledWith(expect.objectContaining({
      structuredOutputMode: 'json-schema',
      maxTokens: 2000,
    }));
    expect(sendRequest.mock.calls[0][0]).not.toHaveProperty('temperature');
    expect(sendRequest.mock.calls[0][0].systemPrompt).toContain('meticulous professional editor');
  });

  it.each([
    ['openai/gpt-5-nano', 'minimal'],
    ['openrouter/free', undefined],
    ['unconfigured/model', undefined],
  ] as const)('uses model-config reasoning effort when evaluating %s', async (model, reasoningEffort) => {
    const sendRequest = jest.fn().mockResolvedValue({
      text: '{"text":"ok"}',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      model,
      provider: 'openrouter',
    });
    const report = await runPromptEvaluation({
      candidates: [{ provider: 'openrouter', model, structuredOutputMode: 'json-schema' }],
      cases: [evaluationCase],
      apiKeys: { openrouter: 'key' },
      connectors: { openrouter: { name: 'openrouter', supportsStreaming: false, sendRequest } },
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: model, supported_parameters: ['response_format'] }] }),
      }) as unknown as typeof fetch,
    });

    expect(sendRequest).toHaveBeenCalledWith(expect.objectContaining({ model, reasoningEffort }));
    expect(report.candidates[0].settings.reasoningEffort).toBe(reasoningEffort);
  });

  it('skips missing keys safely and records malformed structured output', async () => {
    const missingKeyReport = await runPromptEvaluation({
      candidates: [{ provider: 'gemini', model: 'candidate', structuredOutputMode: 'json-schema' }],
      cases: [evaluationCase],
      apiKeys: {},
      connectors: {},
      fetchImpl: jest.fn() as unknown as typeof fetch,
      now: () => 0,
    });
    expect(missingKeyReport.candidates[0]).toMatchObject({
      status: 'skipped',
      skipReason: 'GEMINI_API_KEY is not set',
      preflight: { status: 'missing-api-key' },
      cases: [],
    });

    const connector = {
      name: 'gemini',
      supportsStreaming: false,
      sendRequest: jest.fn().mockResolvedValue({
        text: '{"value":"wrong"}',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: 'candidate-revision',
        provider: 'gemini',
      }),
    } as LLMConnector;
    const malformedReport = await runPromptEvaluation({
      candidates: [{ provider: 'gemini', model: 'candidate', structuredOutputMode: 'json-schema' }],
      cases: [evaluationCase],
      apiKeys: { gemini: 'key' },
      connectors: { gemini: connector },
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ supportedGenerationMethods: ['generateContent'] }),
      }) as unknown as typeof fetch,
      now: () => 0,
    });

    expect(malformedReport.candidates[0].cases[0]).toMatchObject({
      rawResponse: '{"value":"wrong"}',
      output: null,
      tokenUsage: { totalTokens: 0 },
      modelRevision: 'candidate-revision',
      deterministicChecks: [{ check: 'valid-json-text-contract', passed: false }],
      error: 'LLM response does not match the output schema',
    });
  });

  it('propagates each role revision and fingerprint for no-options cases', async () => {
    const connector = {
      name: 'gemini',
      supportsStreaming: false,
      sendRequest: jest.fn().mockResolvedValue({
        text: '{"text":"ok"}',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        model: 'revision',
        provider: 'gemini',
      }),
    } as LLMConnector;
    const report = await runPromptEvaluation({
      candidates: [{ provider: 'gemini', model: 'candidate', structuredOutputMode: 'json-schema' }],
      cases: ROLES.map(role => ({
        id: role.id,
        roleId: role.id,
        language: 'en',
        userText: 'Source',
        options: {},
        checks: [],
      })),
      apiKeys: { gemini: 'key' },
      connectors: { gemini: connector },
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ supportedGenerationMethods: ['generateContent'] }),
      }) as unknown as typeof fetch,
    });

    expect(report.candidates[0].cases).toHaveLength(ROLES.length);
    report.candidates[0].cases.forEach((result, index) => {
      expect(result.promptRevision).toBe(`prompt-v3/${ROLES[index].id}@${ROLES[index].systemPromptVersion}`);
      expect(result.promptFingerprint).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
