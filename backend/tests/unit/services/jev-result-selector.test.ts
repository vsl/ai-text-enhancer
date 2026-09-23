import { JevResultSelector } from '../../../src/services/jev-result-selector.ts';
import type { AssistantConfiguration, BatchRequest, SuccessResult } from '../../../src/types/api.types.ts';

function assistant(id: string): AssistantConfiguration {
  return {
    id,
    model: 'open-router-free',
    aiRoleId: 'editor',
    userText: 'Original source',
    contextText: 'Shared context',
    options: { improve: true, shorten: false, languageLevel: 'default' },
  };
}

function success(id: string): SuccessResult {
  return { id, status: 'success', enhancedText: `Output ${id}`, total_tokens: 10 };
}

describe('JevResultSelector', () => {
  it('sends every candidate once and maps choice and probabilities back to result IDs', async () => {
    const ids = ['result-a', 'result-b', 'result-c', 'result-d', 'result-e', 'result-f'];
    const connector = {
      decide: jest.fn().mockResolvedValue({
        model: 'typesafe/jev-1.13:resolved',
        answers: {
          selected_variant: {
            type: 'choice',
            choice: 'candidate_4',
            confidence: 0.9,
            probabilities: {
              candidate_1: 0.05,
              candidate_2: 0.1,
              candidate_3: 0.1,
              candidate_4: 0.6,
              candidate_5: 0.1,
              candidate_6: 0.05,
            },
          },
        },
      }),
    };
    const request: BatchRequest = { assistants: ids.map(assistant) };

    const selection = await new JevResultSelector(connector).select(
      request,
      ids.map(success),
      'request-1',
    );

    expect(connector.decide).toHaveBeenCalledTimes(1);
    const decisionRequest = connector.decide.mock.calls[0][0];
    expect(decisionRequest.state.source).toEqual({ userText: 'Original source', contextText: 'Shared context' });
    expect(decisionRequest.state.candidates).toHaveLength(6);
    expect(decisionRequest.state.candidates.map((candidate: { key: string; resultId: string }) =>
      [candidate.key, candidate.resultId]
    )).toEqual(ids.map((id, index) => [`candidate_${index + 1}`, id]));
    expect(decisionRequest.state.candidates[0]).not.toHaveProperty('userText');
    expect(decisionRequest.state.candidates[0].options).toEqual({ improve: true });
    expect(decisionRequest.questions.selected_variant.type).toBe('choice');
    expect(Object.keys(decisionRequest.questions.selected_variant.criteria)).toHaveLength(6);
    expect(decisionRequest.questions.selected_variant.instructions).toContain('untrusted data');
    expect(selection).toEqual({
      status: 'success',
      judge: 'jev',
      model: 'typesafe/jev-1.13:resolved',
      selectedResultId: 'result-d',
      confidence: 0.9,
      probabilities: {
        'result-a': 0.05,
        'result-b': 0.1,
        'result-c': 0.1,
        'result-d': 0.6,
        'result-e': 0.1,
        'result-f': 0.05,
      },
    });
  });

  it.each([
    ['missing answer', {}],
    ['wrong answer type', { answers: { selected_variant: { type: 'score' } } }],
    ['unknown candidate', { answers: { selected_variant: { type: 'choice', choice: 'candidate_3', confidence: 0.8, probabilities: { candidate_1: 0.5, candidate_2: 0.5 } } } }],
    ['missing probability', { answers: { selected_variant: { type: 'choice', choice: 'candidate_1', confidence: 0.8, probabilities: { candidate_1: 1 } } } }],
    ['invalid confidence', { answers: { selected_variant: { type: 'choice', choice: 'candidate_1', confidence: 2, probabilities: { candidate_1: 0.5, candidate_2: 0.5 } } } }],
  ])('rejects malformed decision data: %s', async (_name, response) => {
    const selector = new JevResultSelector({ decide: jest.fn().mockResolvedValue(response) });
    const request: BatchRequest = { assistants: [assistant('a'), assistant('b')] };
    await expect(selector.select(request, [success('a'), success('b')], 'request-1')).rejects.toThrow();
  });
});
