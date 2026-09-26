jest.mock('langsmith/traceable', () => ({
  traceable: jest.fn((operation: (...args: any[]) => any) => jest.fn(operation)),
  getCurrentRunTree: jest.fn(() => { throw new Error('no active trace'); }),
}));

import { traceable } from 'langsmith/traceable';
import { JevResultSelector } from '../../../src/services/jev-result-selector.ts';
import {
  flushTraces,
  isTracingEnabled,
  isContentCaptureEnabled,
  resetTracingForTests,
  sanitizeTraceValue,
  setTracingClientForTests,
  traceRun,
} from '../../../src/observability/tracing.ts';

describe('LangSmith tracing', () => {
  afterEach(() => {
    delete process.env.LANGSMITH_TRACING;
    delete process.env.LANGSMITH_API_KEY;
    delete process.env.LANGSMITH_CAPTURE_CONTENT;
    delete process.env.OPENROUTER_API_KEY;
    resetTracingForTests();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('is a no-op unless explicitly enabled with a key', async () => {
    const operation = jest.fn().mockResolvedValue({ text: 'full response' });
    expect(isTracingEnabled()).toBe(false);
    await expect(traceRun({
      name: 'enhance.batch',
      runType: 'chain',
      inputs: { source: 'full source', context: 'full context' },
      operation,
    })).resolves.toEqual({ text: 'full response' });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('keeps content while excluding credentials and URL keys in diagnostic mode', () => {
    process.env.LANGSMITH_CAPTURE_CONTENT = 'true';
    expect(sanitizeTraceValue({
      source: 'full source',
      context: 'full context',
      authorization: 'Bearer secret',
      headers: { cookie: 'session=secret', 'Content-Type': 'application/json' },
      apiKey: 'secret',
      serviceRoleKey: 'secret',
      url: 'https://example.test/model?key=secret&alt=json',
      usage: { prompt_tokens: 12 },
    })).toEqual({
      source: 'full source',
      context: 'full context',
      authorization: '[REDACTED]',
      headers: { cookie: '[REDACTED]', 'Content-Type': 'application/json' },
      apiKey: '[REDACTED]',
      serviceRoleKey: '[REDACTED]',
      url: 'https://example.test/model?key=%5BREDACTED%5D&alt=json',
      usage: { prompt_tokens: 12 },
    });
  });

  it('redacts embedded server secrets even in content-capture mode', () => {
    process.env.OPENROUTER_API_KEY = 'sk-private-123456';
    expect(sanitizeTraceValue({ text: 'echo sk-private-123456' }, true)).toEqual({ text: 'echo [REDACTED]' });
  });

  it('isolates exporter failures', async () => {
    setTracingClientForTests({
      awaitPendingTraceBatches: jest.fn().mockRejectedValue(new Error('offline')),
    } as never);
    const warning = jest.spyOn(console, 'warn').mockImplementation();
    await expect(flushTraces()).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith('[TRACING] Failed to flush traces');
  });

  it('defaults to metadata-only traces and omits raw content at every run boundary', async () => {
    setTracingClientForTests({ awaitPendingTraceBatches: jest.fn() } as never);
    expect(isContentCaptureEnabled()).toBe(false);
    await traceRun({
      name: 'enhance.batch', runType: 'chain',
      inputs: { userText: 'PRIVATE USER', contextText: 'PRIVATE CONTEXT', requestId: 'request-1', authorization: 'Bearer SECRET' },
      metadata: { requestId: 'request-1', assistantId: 7 },
      operation: async () => ({ enhancedText: 'PRIVATE OUTPUT', state: { candidates: [{ text: 'PRIVATE CANDIDATE' }] }, selectedResultId: '7' }),
    });
    const config = jest.mocked(traceable).mock.calls[0][1]!;
    const input = config.processInputs!({ userText: 'PRIVATE USER', contextText: 'PRIVATE CONTEXT', requestId: 'request-1', authorization: 'Bearer SECRET' } as never);
    const output = config.processOutputs!({ enhancedText: 'PRIVATE OUTPUT', state: { candidates: [{ text: 'PRIVATE CANDIDATE' }] }, selectedResultId: '7' } as never);
    expect(JSON.stringify({ input, output, metadata: config.metadata })).not.toMatch(/PRIVATE|SECRET/);
    expect(input).toMatchObject({ requestId: 'request-1', authorization: '[REDACTED]' });
    expect(output).toMatchObject({ selectedResultId: '7' });
  });

  it('omits raw failure messages from trace export', async () => {
    setTracingClientForTests({ awaitPendingTraceBatches: jest.fn() } as never);
    await traceRun({ name: 'enhance.batch', runType: 'chain', inputs: {}, operation: async () => 'ok' });
    const config = jest.mocked(traceable).mock.calls[0][1]!;
    const run = { error: 'PRIVATE USER TEXT in provider error' };
    config.on_end!(run as never);
    expect(run.error).toBe('[ERROR DETAILS OMITTED]');
  });

  it('allows explicit diagnostic content while still redacting credentials', async () => {
    process.env.LANGSMITH_CAPTURE_CONTENT = 'true';
    setTracingClientForTests({ awaitPendingTraceBatches: jest.fn() } as never);
    expect(isContentCaptureEnabled()).toBe(true);
    await traceRun({
      name: 'enhance.batch', runType: 'chain', inputs: { userText: 'PRIVATE USER' },
      operation: async () => ({ text: 'PRIVATE OUTPUT' }),
    });
    const config = jest.mocked(traceable).mock.calls[0][1]!;
    expect(config.processInputs!({ userText: 'PRIVATE USER', apiKey: 'SECRET' } as never)).toEqual({ userText: 'PRIVATE USER', apiKey: '[REDACTED]' });
    expect(config.processOutputs!({ text: 'PRIVATE OUTPUT' } as never)).toEqual({ text: 'PRIVATE OUTPUT' });
  });

  it.each([true, false])('captures the Jev request with content capture %s', async (captureContent) => {
    process.env.LANGSMITH_CAPTURE_CONTENT = String(captureContent);
    setTracingClientForTests({ awaitPendingTraceBatches: jest.fn() } as never);
    const connector = { decide: jest.fn().mockResolvedValue({
      answers: { selected_variant: { type: 'choice', choice: 'candidate_1', confidence: 0.8,
        probabilities: { candidate_1: 0.8, candidate_2: 0.2 } } },
    }) };
    const assistants = ['a', 'b'].map(id => ({
      id, model: 'model', aiRoleId: 'editor', userText: 'PRIVATE SOURCE', contextText: 'PRIVATE CONTEXT', options: { improve: true },
    }));
    const results = ['a', 'b'].map(id => ({ id, status: 'success' as const, enhancedText: `PRIVATE OUTPUT ${id}`, total_tokens: 1 }));

    await new JevResultSelector(connector).select({ assistants }, results, 'request-1');

    const wrapped = jest.mocked(traceable).mock.results[0].value as jest.Mock;
    const inputs = wrapped.mock.calls[0][0];
    expect(inputs.request).toEqual(connector.decide.mock.calls[0][0]);
    const exported = jest.mocked(traceable).mock.calls[0][1]!.processInputs!(inputs);
    const serialized = JSON.stringify(exported);
    if (captureContent) {
      expect(serialized).toContain('PRIVATE SOURCE');
      expect(serialized).toContain('PRIVATE CONTEXT');
      expect(serialized).toContain('PRIVATE OUTPUT a');
      expect(serialized).toContain('Select exactly one candidate');
    } else {
      expect(serialized).not.toContain('PRIVATE');
      expect(serialized).not.toContain('Select exactly one candidate');
    }
  });

  it('builds nested batch, assistant, provider, and parser runs with full content', async () => {
    setTracingClientForTests({ awaitPendingTraceBatches: jest.fn() } as never);
    await traceRun({
      name: 'enhance.batch',
      runType: 'chain',
      inputs: { source: 'full source' },
      operation: () => traceRun({
        name: 'enhance.assistant',
        runType: 'chain',
        inputs: { systemPrompt: 'full system prompt' },
        operation: () => traceRun({
          name: 'llm.openrouter',
          runType: 'llm',
          inputs: { rawRequest: 'full request' },
          operation: () => traceRun({
            name: 'output.parse',
            runType: 'parser',
            inputs: { rawModelOutput: 'full response' },
            operation: async () => ({ text: 'final output' }),
          }),
        }),
      }),
    });

    expect(jest.mocked(traceable).mock.calls.map(([, config]) => config?.name)).toEqual([
      'enhance.batch', 'enhance.assistant', 'llm.openrouter', 'output.parse',
    ]);
  });

  it('returns the enhancement result when trace export fails after execution', async () => {
    setTracingClientForTests({ awaitPendingTraceBatches: jest.fn() } as never);
    jest.mocked(traceable).mockImplementationOnce(((operation: (...args: any[]) => any) => async (...args: any[]) => {
      await operation(...args);
      throw new Error('export failed');
    }) as never);
    const warning = jest.spyOn(console, 'warn').mockImplementation();
    const operation = jest.fn().mockResolvedValue({ text: 'still returned' });

    await expect(traceRun({
      name: 'enhance.batch', runType: 'chain', inputs: { source: 'full source' }, operation,
    })).resolves.toEqual({ text: 'still returned' });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith('[TRACING] Trace export failed');
  });
});
