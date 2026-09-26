import { JevResultSelector } from '../../../src/services/jev-result-selector.ts';
import type { DecisionRequest } from '../../../src/connectors/openrouter-decision-connector.ts';
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

function decisionMock(selection: unknown) {
  return jest.fn().mockImplementation(async (request: DecisionRequest) => {
    if (request.questions.selected_variant) return selection;
    return { model: 'typesafe/jev-1.13:resolved', answers: Object.fromEntries(
      Object.keys(request.questions).map(key => [key, { type: 'choice', choice: 'pass' }])
    ) };
  });
}

describe('JevResultSelector', () => {
  it('excludes rejected outputs before ranking and gives them exactly zero', async () => {
    const connector = { decide: jest.fn()
      .mockResolvedValueOnce({ answers: {
        candidate_1: { type: 'choice', choice: 'reject' },
        candidate_2: { type: 'choice', choice: 'pass' },
        candidate_3: { type: 'choice', choice: 'pass' },
      } })
      .mockResolvedValueOnce({ answers: { selected_variant: {
        type: 'choice', choice: 'candidate_3', confidence: 0.8,
        probabilities: { candidate_2: 0.2, candidate_3: 0.8 },
      } } }) };
    const request = { assistants: ['a', 'b', 'c'].map(assistant) };
    const selection = await new JevResultSelector(connector).select(request, ['a', 'b', 'c'].map(success), 'r');
    expect(connector.decide.mock.calls[1][0].state.candidates.map((c: { resultId: string }) => c.resultId)).toEqual(['b', 'c']);
    expect(selection).toMatchObject({ selectedResultId: 'c', probabilities: { a: 0, b: 0.2, c: 0.8 },
      rejectionReasons: { a: ['INSTRUCTION_FOLLOWING'], b: [], c: [] } });
  });

  it('does not manufacture a winner when every candidate is rejected', async () => {
    const connector = { decide: jest.fn().mockResolvedValue({ answers: {
      candidate_1: { type: 'choice', choice: 'reject' },
      candidate_2: { type: 'choice', choice: 'reject' },
    } }) };
    const selection = await new JevResultSelector(connector).select(
      { assistants: ['a', 'b'].map(assistant) }, ['a', 'b'].map(success), 'r');
    expect(connector.decide).toHaveBeenCalledTimes(1);
    expect(selection).toMatchObject({ selectedResultId: null, confidence: 0, probabilities: { a: 0, b: 0 } });
  });

  it.each([undefined, false, true])('enforces decoded em dashes only when enabled: %s', async avoidCommonAiSymbols => {
    const connector = { decide: decisionMock(twoCandidateResponse()) };
    const config = { ...assistant('a'), options: { avoidCommonAiSymbols, addEmojis: true } };
    const selection = await new JevResultSelector(connector).select({ assistants: [config] }, [{
      ...success('a'), enhancedText: JSON.parse('{"text":"Ready\\u2014tests passed. ✅"}').text,
    }], 'r');
    expect(selection.probabilities.a).toBe(avoidCommonAiSymbols ? 0 : 1);
    expect(selection.rejectionReasons?.a).toEqual(avoidCommonAiSymbols ? ['EM_DASH'] : []);
  });

  it('keeps emojis, subject colons, and ordinary punctuation eligible', async () => {
    const connector = { decide: decisionMock(twoCandidateResponse()) };
    const config = { ...assistant('a'), aiRoleId: 'email_assistant', options: { avoidCommonAiSymbols: true, addEmojis: true } };
    const selection = await new JevResultSelector(connector).select({ assistants: [config] }, [{
      ...success('a'), enhancedText: 'Subject: Ready\n\nHi Dana,\n\nTests passed; ready to ship. ✅\n\nBest,\nAlex',
    }], 'r');
    expect(selection.probabilities.a).toBe(1);
    expect(selection.rejectionReasons?.a).toEqual([]);
  });

  it('treats special object-property result IDs as ordinary IDs', async () => {
    const connector = { decide: decisionMock(twoCandidateResponse()) };
    const ids = ['__proto__', 'constructor'];
    const selection = await new JevResultSelector(connector).select(
      { assistants: ids.map(assistant) }, ids.map(success), 'r');
    expect(JSON.parse(JSON.stringify(selection.probabilities))).toEqual(JSON.parse('{"__proto__":0.8,"constructor":0.2}'));
    expect(Object.keys(selection.rejectionReasons!)).toEqual(ids);
  });

  it.each([{}, { type: 'choice', choice: ['pass'] }, { type: 'choice', choice: 'unknown' }, { type: 'score', choice: 'pass' }])(
    'fails closed on malformed or missing boundary decisions: %j', async answer => {
      const connector = { decide: jest.fn().mockResolvedValue({ answers: { candidate_1: answer } }) };
      await expect(new JevResultSelector(connector).select({ assistants: [assistant('a')] }, [success('a')], 'r')).rejects.toThrow('boundary check');
      expect(connector.decide).toHaveBeenCalledTimes(1);
    });

  it('sends every candidate once and maps choice and probabilities back to result IDs', async () => {
    const ids = ['result-a', 'result-b', 'result-c', 'result-d', 'result-e', 'result-f'];
    const connector = {
      decide: decisionMock({
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

    expect(connector.decide).toHaveBeenCalledTimes(2);
    const decisionRequest = connector.decide.mock.calls[0][0];
    expect(decisionRequest.state).not.toHaveProperty('source');
    expect(decisionRequest.state.candidates).toHaveLength(6);
    expect(decisionRequest.state.candidates[0].source).toEqual({ userText: 'Original source', contextText: 'Shared context' });
    expect(decisionRequest.state.candidates.map((candidate: { key: string; resultId: string }) =>
      [candidate.key, candidate.resultId]
    )).toEqual(ids.map((id, index) => [`candidate_${index + 1}`, id]));
    expect(decisionRequest.state.candidates[0]).not.toHaveProperty('userText');
    expect(decisionRequest.state.candidates[0].options).toEqual({ improve: true });
    expect(connector.decide.mock.calls[1][0].questions.selected_variant.type).toBe('choice');
    expect(Object.keys(connector.decide.mock.calls[1][0].questions.selected_variant.criteria)).toHaveLength(6);
    expect(connector.decide.mock.calls[1][0].questions.selected_variant.instructions).toContain('untrusted data');
    expect(connector.decide.mock.calls[1][0].questions.selected_variant.instructions).toContain('optionExplanations');
    expect(connector.decide.mock.calls[1][0].questions.selected_variant.instructions).toContain('optionRequirements');
    expect(selection).toEqual({
      status: 'success',
      judge: 'jev',
      model: 'typesafe/jev-1.13:resolved',
      selectedResultId: 'result-d',
      confidence: 0.9,
      rejectionReasons: Object.fromEntries(ids.map(id => [id, []])),
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
    const connector = { decide: decisionMock(twoCandidateResponse()) };
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
    expect(connector.decide.mock.calls[1][0].questions.selected_variant.instructions).toContain('its own source.userText');
    expect(connector.decide.mock.calls[1][0].questions.selected_variant.instructions).toContain('source takes precedence');
  });

  it.each(['editor', 'summarizer', 'email_assistant'])('keeps the %s role with no options', async (aiRoleId) => {
    for (const options of [{}, { avoidCommonAiSymbols: false }]) {
      const connector = { decide: decisionMock(twoCandidateResponse()) };
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
    ['avoidCommonAiSymbols', { avoidCommonAiSymbols: true }, 'Avoid long dashes (—)', 'HARD OUTPUT CONSTRAINT: zero em dash characters'],
  ])('explains %s to Jev', async (name, options, explanation, requirement) => {
    const connector = { decide: decisionMock(twoCandidateResponse()) };
    const assistants = [assistant('a'), assistant('b')];
    assistants[0].options = options;

    await new JevResultSelector(connector).select({ assistants }, [success('a'), success('b')], 'request-1');

    const candidate = connector.decide.mock.calls[0][0].state.candidates[0];
    expect(candidate.optionExplanations).toEqual({ [name]: expect.stringContaining(explanation) });
    expect(candidate.optionRequirements.join(' ')).toContain(requirement);
  });

  it('keeps enabled transformations additive for Jev', async () => {
    const connector = { decide: decisionMock(twoCandidateResponse()) };
    const assistants = [assistant('a'), assistant('b')];
    assistants[0].options = { format: true, avoidCommonAiSymbols: true };

    await new JevResultSelector(connector).select({ assistants }, [success('a'), success('b')], 'request-1');

    const requirements = connector.decide.mock.calls[0][0].state.candidates[0].optionRequirements.join(' ');
    const explanations = connector.decide.mock.calls[0][0].state.candidates[0].optionExplanations;
    expect(Object.keys(explanations).sort()).toEqual(['avoidCommonAiSymbols', 'format']);
    expect(requirements).toContain('Improve readability');
    expect(requirements).toContain('HARD OUTPUT CONSTRAINT: zero em dash characters');
    expect(requirements).toContain('email Subject: line');
  });

  it.each([
    ['missing answer', {}],
    ['wrong answer type', { answers: { selected_variant: { type: 'score' } } }],
    ['unknown candidate', { answers: { selected_variant: { type: 'choice', choice: 'candidate_3', confidence: 0.8, probabilities: { candidate_1: 0.5, candidate_2: 0.5 } } } }],
    ['missing probability', { answers: { selected_variant: { type: 'choice', choice: 'candidate_1', confidence: 0.8, probabilities: { candidate_1: 1 } } } }],
    ['invalid confidence', { answers: { selected_variant: { type: 'choice', choice: 'candidate_1', confidence: 2, probabilities: { candidate_1: 0.5, candidate_2: 0.5 } } } }],
  ])('rejects malformed decision data: %s', async (_name, response) => {
    const selector = new JevResultSelector({ decide: decisionMock(response) });
    const request: BatchRequest = { assistants: [assistant('a'), assistant('b')] };
    await expect(selector.select(request, [success('a'), success('b')], 'request-1')).rejects.toThrow();
  });
});
