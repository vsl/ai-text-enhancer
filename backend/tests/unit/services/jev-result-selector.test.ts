import { JevResultSelector } from '../../../src/services/jev-result-selector.ts';
import type { DecisionRequest } from '../../../src/connectors/openrouter-decision-connector.ts';
import { getRoleById } from '../../../src/config/roles.config.ts';
import type { AssistantConfiguration, TransformationOptions } from '../../../src/types/api.types.ts';

function assistant(id: string): AssistantConfiguration {
  return { id, model: 'open-router-free', aiRoleId: 'editor', userText: 'Original source',
    contextText: 'Shared context', options: { improve: true, shorten: false, languageLevel: 'default' } };
}
function success(id: string, enhancedText = `Output ${id}`) {
  return { id, status: 'success' as const, enhancedText, total_tokens: 10 };
}
function response(scores: number[], confidences = scores.map(() => 0.8)) {
  return { model: 'typesafe/jev-1.13:resolved', answers: Object.fromEntries(scores.map((score, index) => [
    `candidate_${index + 1}`, { type: 'score', score, confidence: confidences[index] },
  ])) };
}
function connector(scores: number[]) {
  return { decide: jest.fn().mockResolvedValue(response(scores)) };
}

describe('JevResultSelector', () => {
  it('scores each candidate in one request, independently, then selects the highest', async () => {
    const judge = connector([0.45, 7.2, 5.4]);
    const selection = await new JevResultSelector(judge).select(
      { assistants: ['a', 'b', 'c'].map(assistant) }, ['a', 'b', 'c'].map(id => success(id)), 'r');
    expect(judge.decide).toHaveBeenCalledTimes(1);
    expect(selection).toMatchObject({ status: 'success', judge: 'jev', model: 'typesafe/jev-1.13:resolved',
      selectedResultId: 'b', confidence: 0.8 });
    expect(selection.scores.a).toBeCloseTo(0.05);
    expect(selection.scores.b).toBeCloseTo(0.8);
    expect(selection.scores.c).toBeCloseTo(0.6);
    const request: DecisionRequest = judge.decide.mock.calls[0][0];
    expect(Object.keys(request.questions)).toEqual(['candidate_1', 'candidate_2', 'candidate_3']);
    expect(request.questions.candidate_1.type).toBe('score');
    expect(request.questions.candidate_1.criteria).toHaveLength(10);
    expect(request.questions.candidate_1.instructions).toContain('untrusted data');
    expect(request.questions.candidate_1.instructions).toContain('optionRequirements');
  });

  it('keeps a low score for a sole result instead of inventing 100% or rejecting it', async () => {
    const judge = connector([0.9]);
    const selection = await new JevResultSelector(judge).select(
      { assistants: [assistant('a')] }, [success('a', 'Sure, here is 17')], 'r');
    expect(selection.scores.a).toBeCloseTo(0.1);
    expect(selection.selectedResultId).toBe('a');
    expect(judge.decide).toHaveBeenCalledTimes(1);
  });

  it('does not enforce punctuation in code and only tells Jev about enabled options', async () => {
    const enabled = { ...assistant('a'), options: { avoidCommonAiSymbols: true } };
    const disabled = { ...assistant('b'), options: { avoidCommonAiSymbols: false } };
    const judge = connector([0.9, 8.1]);
    const selection = await new JevResultSelector(judge).select(
      { assistants: [enabled, disabled] }, [success('a', 'Ready—tests passed.'), success('b', 'Ready—tests passed.')], 'r');
    expect(selection.scores.a).toBeCloseTo(0.1);
    expect(selection.scores.b).toBeCloseTo(0.9);
    const [first, second] = judge.decide.mock.calls[0][0].state.candidates;
    expect(first.optionRequirements.join(' ')).toContain('HARD OUTPUT CONSTRAINT: never put the character');
    expect(second.optionRequirements.join(' ')).not.toContain('HARD OUTPUT CONSTRAINT');
  });

  it('keeps each result with its own source, context, role, and enabled options', async () => {
    const judge = connector([7.2, 8.1]);
    const assistants = [
      { ...assistant('a'), userText: 'Edit this', contextText: 'Editor background' },
      { ...assistant('b'), aiRoleId: 'email_assistant', userText: 'Write this email', contextText: undefined },
    ];
    await new JevResultSelector(judge).select({ assistants }, [success('b'), success('a')], 'r');
    const request: DecisionRequest = judge.decide.mock.calls[0][0];
    expect(request.state).not.toHaveProperty('source');
    expect((request.state.candidates as Array<{ source: unknown; role: { id: string } }>).map(item =>
      ({ source: item.source, role: item.role.id }))).toEqual([
      { source: { userText: 'Write this email', contextText: '' }, role: 'email_assistant' },
      { source: { userText: 'Edit this', contextText: 'Editor background' }, role: 'editor' },
    ]);
    expect(request.questions.candidate_1.instructions).toContain('source takes precedence');
  });

  it('treats special result IDs as data', async () => {
    const ids = ['__proto__', 'constructor'];
    const selection = await new JevResultSelector(connector([7.2, 8.1])).select(
      { assistants: ids.map(assistant) }, ids.map(id => success(id)), 'r');
    expect(Object.keys(selection.scores)).toEqual(ids);
    expect(selection.scores.__proto__).toBeCloseTo(0.8);
    expect(selection.scores.constructor).toBeCloseTo(0.9);
  });

  it.each(['editor', 'email_assistant'])('keeps the %s role with no options', async aiRoleId => {
    const judge = connector([7.2]);
    await new JevResultSelector(judge).select({ assistants: [{ ...assistant('a'), aiRoleId, options: {} }] }, [success('a')], 'r');
    const candidate = judge.decide.mock.calls[0][0].state.candidates[0];
    expect(candidate.role.requirements).toBe(getRoleById(aiRoleId)?.systemPrompt);
    expect(candidate.optionExplanations).toEqual({});
    expect(candidate.optionRequirements).toEqual(["- Perform the role's primary task without additional transformations."]);
  });

  it.each<[string, TransformationOptions, string]>([
    ['improve', { improve: true }, 'Improve clarity'],
    ['fixMistakes', { fixMistakes: true }, 'Correct grammar'],
    ['format', { format: true }, 'Improve readability'],
    ['shorten', { shorten: true }, 'meaningfully shorter'],
    ['lengthen', { lengthen: true }, 'Develop the result'],
    ['formality', { formality: 'Formal' }, 'polished, professional'],
    ['tone', { tone: 'Polite' }, 'polite, courteous'],
    ['languageLevel', { languageLevel: 'simple' }, 'common words and short'],
    ['translateTo', { translateTo: 'es' }, 'natural, idiomatic Spanish'],
    ['addEmojis', { addEmojis: true }, 'relevant emojis'],
    ['avoidCommonAiSymbols', { avoidCommonAiSymbols: true }, 'HARD OUTPUT CONSTRAINT'],
  ])('includes only enabled %s requirements', async (name, options, requirement) => {
    const judge = connector([7.2]);
    await new JevResultSelector(judge).select({ assistants: [{ ...assistant('a'), options }] }, [success('a')], 'r');
    const candidate = judge.decide.mock.calls[0][0].state.candidates[0];
    expect(candidate.optionExplanations).toHaveProperty(name);
    expect(candidate.optionRequirements.join(' ')).toContain(requirement);
  });

  it.each([
    ['missing response', {}],
    ['missing answer', { answers: {} }],
    ['wrong type', { answers: { candidate_1: { type: 'choice', score: 7, confidence: 0.8 } } }],
    ['score outside rubric', response([10])],
    ['invalid confidence', response([7], [2])],
  ])('rejects malformed Jev scores: %s', async (_name, value) => {
    const judge = { decide: jest.fn().mockResolvedValue(value) };
    await expect(new JevResultSelector(judge).select({ assistants: [assistant('a')] }, [success('a')], 'r'))
      .rejects.toThrow();
  });
});
