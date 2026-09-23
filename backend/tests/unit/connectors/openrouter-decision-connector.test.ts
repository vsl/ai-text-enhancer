import { OpenRouterDecisionConnector, type DecisionRequest } from '../../../src/connectors/openrouter-decision-connector.ts';

const request: DecisionRequest = {
  model: 'typesafe/jev-1.13',
  state: { candidates: [{ key: 'candidate_1' }, { key: 'candidate_2' }] },
  questions: {
    selected_variant: {
      type: 'choice',
      instructions: 'Choose one.',
      criteria: { candidate_1: 'First', candidate_2: 'Second' },
    },
  },
};

describe('OpenRouterDecisionConnector', () => {
  it('posts one Choice question and structured state to the Decisions API', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response(JSON.stringify({ answers: {} }), { status: 200 }));
    const connector = new OpenRouterDecisionConnector('secret', 5000, fetchFn);

    await connector.decide(request);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret' });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('typesafe/jev-1.13');
    expect(body.state).toEqual(request.state);
    expect(typeof body.state).toBe('object');
    expect(Object.keys(body.questions)).toEqual(['selected_variant']);
    expect(body.questions.selected_variant.type).toBe('choice');
  });

  it('cancels a timed-out request', async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    const result = new OpenRouterDecisionConnector('secret', 10, fetchFn).decide(request);
    const expectation = expect(result).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(10);
    await expectation;
    jest.useRealTimers();
  });

  it('rejects non-successful HTTP responses without exposing their body', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response('provider secret', { status: 500 }));
    await expect(new OpenRouterDecisionConnector('secret', 5000, fetchFn).decide(request))
      .rejects.toThrow('HTTP 500');
  });

  it('rejects malformed JSON', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response('{', { status: 200 }));
    await expect(new OpenRouterDecisionConnector('secret', 5000, fetchFn).decide(request))
      .rejects.toThrow('invalid JSON');
  });
});
