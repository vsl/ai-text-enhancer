import { JevResultSelector } from '../../../src/services/jev-result-selector.ts';
import { getRoleById } from '../../../src/config/roles.config.ts';
import type { AssistantConfiguration, BatchRequest, SuccessResult, TransformationOptions } from '../../../src/types/api.types.ts';

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

function twoCandidateResponse() {
  return { answers: { selected_variant: {
    type: 'choice', choice: 'candidate_1', confidence: 0.8,
    probabilities: { candidate_1: 0.8, candidate_2: 0.2 },
  } } };
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
    expect(decisionRequest.state).not.toHaveProperty('source');
    expect(decisionRequest.state.candidates).toHaveLength(6);
    expect(decisionRequest.state.candidates[0].source).toEqual({ userText: 'Original source', contextText: 'Shared context' });
    expect(decisionRequest.state.candidates.map((candidate: { key: string; resultId: string }) =>
      [candidate.key, candidate.resultId]
    )).toEqual(ids.map((id, index) => [`candidate_${index + 1}`, id]));
    expect(decisionRequest.state.candidates[0]).not.toHaveProperty('userText');
    expect(decisionRequest.state.candidates[0].options).toEqual({ improve: true });
    expect(decisionRequest.questions.selected_variant.type).toBe('choice');
    expect(Object.keys(decisionRequest.questions.selected_variant.criteria)).toHaveLength(6);
    expect(decisionRequest.questions.selected_variant.instructions).toContain('untrusted data');
    expect(decisionRequest.questions.selected_variant.instructions).toContain('optionExplanations');
    expect(decisionRequest.questions.selected_variant.instructions).toContain('optionRequirements');
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

  it('uses each successful result’s own source and context even when results are reordered', async () => {
    const connector = { decide: jest.fn().mockResolvedValue(twoCandidateResponse()) };
    const assistants = [
      { ...assistant('a'), userText: 'Edit this', contextText: 'Editor background' },
      { ...assistant('b'), aiRoleId: 'email_assistant', userText: 'Write this email', contextText: undefined },
    ];

    await new JevResultSelector(connector).select({ assistants }, [success('b'), success('a')], 'request-1');

    const decisionRequest = connector.decide.mock.calls[0][0];
    expect(decisionRequest.state).not.toHaveProperty('source');
    expect(decisionRequest.state.candidates.map((candidate: { source: unknown; role: { id: string } }) => ({
      source: candidate.source, role: candidate.role.id,
    }))).toEqual([
      { source: { userText: 'Write this email', contextText: '' }, role: 'email_assistant' },
      { source: { userText: 'Edit this', contextText: 'Editor background' }, role: 'editor' },
    ]);
    expect(decisionRequest.questions.selected_variant.instructions).toContain('its own source.userText');
    expect(decisionRequest.questions.selected_variant.instructions).toContain('source takes precedence');
  });

  it.each(['editor', 'summarizer', 'email_assistant'])('keeps the %s role with no options', async (aiRoleId) => {
    for (const options of [{}, { avoidCommonAiSymbols: false }]) {
      const connector = { decide: jest.fn().mockResolvedValue(twoCandidateResponse()) };
      const assistants = [assistant('a'), assistant('b')].map(item => ({ ...item, aiRoleId, options }));

      await new JevResultSelector(connector).select({ assistants }, [success('a'), success('b')], 'request-1');

      const candidate = connector.decide.mock.calls[0][0].state.candidates[0];
      expect(candidate.role.requirements).toBe(getRoleById(aiRoleId)?.systemPrompt);
      expect(candidate.optionExplanations).toEqual({});
      expect(candidate.optionRequirements).toEqual(["- Perform the role's primary task without additional transformations."]);
    }
  });

  it.each<[string, TransformationOptions, string, string]>([
    ['improve', { improve: true }, 'Make the writing clearer', 'Improve clarity, coherence'],
    ['fixMistakes', { fixMistakes: true }, 'Fix spelling, grammar', 'Correct grammar, spelling'],
    ['format', { format: true }, 'Use paragraphs or lists', 'Improve readability'],
    ['shorten', { shorten: true }, 'fewer words', 'meaningfully shorter'],
    ['lengthen', { lengthen: true }, 'Add useful detail', 'Develop the result'],
    ['formality', { formality: 'Formal' }, 'Selected: Formal', 'polished, professional wording'],
    ['tone', { tone: 'Polite' }, 'Selected: Polite', 'polite, courteous tone'],
    ['languageLevel', { languageLevel: 'simple' }, 'Selected: simple', 'common words and short'],
    ['translateTo', { translateTo: 'es' }, 'Selected: Spanish', 'natural, idiomatic Spanish'],
    ['addEmojis', { addEmojis: true }, 'Add a few fitting emojis', 'relevant emojis'],
    ['avoidCommonAiSymbols', { avoidCommonAiSymbols: true }, 'Avoid long dashes (—)', 'DO NOT generate the em dash (—)'],
  ])('explains %s to Jev', async (name, options, explanation, requirement) => {
    const connector = { decide: jest.fn().mockResolvedValue(twoCandidateResponse()) };
    const assistants = [assistant('a'), assistant('b')];
    assistants[0].options = options;

    await new JevResultSelector(connector).select({ assistants }, [success('a'), success('b')], 'request-1');

    const candidate = connector.decide.mock.calls[0][0].state.candidates[0];
    expect(candidate.optionExplanations).toEqual({ [name]: expect.stringContaining(explanation) });
    expect(candidate.optionRequirements.join(' ')).toContain(requirement);
  });

  it('keeps enabled transformations additive for Jev', async () => {
    const connector = { decide: jest.fn().mockResolvedValue(twoCandidateResponse()) };
    const assistants = [assistant('a'), assistant('b')];
    assistants[0].options = { format: true, avoidCommonAiSymbols: true };

    await new JevResultSelector(connector).select({ assistants }, [success('a'), success('b')], 'request-1');

    const requirements = connector.decide.mock.calls[0][0].state.candidates[0].optionRequirements.join(' ');
    const explanations = connector.decide.mock.calls[0][0].state.candidates[0].optionExplanations;
    expect(Object.keys(explanations).sort()).toEqual(['avoidCommonAiSymbols', 'format']);
    expect(requirements).toContain('Improve readability');
    expect(requirements).toContain('DO NOT generate the em dash (—)');
    expect(requirements).toContain('email Subject: line');
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
