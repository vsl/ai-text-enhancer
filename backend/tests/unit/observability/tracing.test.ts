jest.mock('langsmith/traceable', () => ({
  traceable: jest.fn((operation: (...args: any[]) => any) => operation),
  getCurrentRunTree: jest.fn(() => { throw new Error('no active trace'); }),
}));

import { traceable } from 'langsmith/traceable';
import {
  flushTraces,
  isTracingEnabled,
  resetTracingForTests,
  sanitizeTraceValue,
  setTracingClientForTests,
  traceRun,
} from '../../../src/observability/tracing.ts';

describe('LangSmith tracing', () => {
  afterEach(() => {
    delete process.env.LANGSMITH_TRACING;
    delete process.env.LANGSMITH_API_KEY;
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

  it('keeps content while excluding credentials and Gemini URL keys', () => {
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

  it('isolates exporter failures', async () => {
    setTracingClientForTests({
      awaitPendingTraceBatches: jest.fn().mockRejectedValue(new Error('offline')),
    } as never);
    const warning = jest.spyOn(console, 'warn').mockImplementation();
    await expect(flushTraces()).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith('[TRACING] Failed to flush traces:', 'offline');
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
    expect(warning).toHaveBeenCalledWith('[TRACING] Trace export failed:', 'export failed');
  });
});
