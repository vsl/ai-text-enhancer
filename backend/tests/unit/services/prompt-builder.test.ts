import { PromptBuilder } from '../../../src/services/prompt-builder.ts';
import { ROLES } from '../../../src/config/roles.config.ts';
import type { AssistantConfiguration } from '../../../src/types/api.types.ts';
import {
  BOOLEAN_TRANSFORMATION_KEYS, FORMALITY_VALUES, TONE_VALUES,
  LANGUAGE_LEVEL_VALUES, LANGUAGE_VALUES,
} from '../../../src/config/transformation-options.config.ts';

const optionCases: AssistantConfiguration['options'][] = [
  {},
  Object.fromEntries(BOOLEAN_TRANSFORMATION_KEYS.map(key => [key, false])),
  ...BOOLEAN_TRANSFORMATION_KEYS.map(key => ({ [key]: true })),
  ...FORMALITY_VALUES.map(formality => ({ formality })),
  ...TONE_VALUES.map(tone => ({ tone })),
  ...LANGUAGE_LEVEL_VALUES.map(languageLevel => ({ languageLevel })),
  ...LANGUAGE_VALUES.map(translateTo => ({ translateTo })),
  { improve: true, fixMistakes: true, format: true, lengthen: true, formality: 'Formal', tone: 'Worried' },
];

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  describe.each(ROLES)('$id source/context boundary', role => {
    it.each(optionCases)('preserves source priority with options %j', async options => {
      const userText = 'Hi Morgan,\nwe do no have anothe ocnta.\nthnas\nAlex';
      const contextText = 'Dear Ms. Taylor and Mr. Alex, please provide another emergency contact. Regards, Morgan';
      const prompt = await builder.buildPrompt({
        id: 'reply', model: role.allowedModels[0], aiRoleId: role.id,
        userText, contextText, options,
      });

      expect(prompt.systemPrompt.startsWith(role.systemPrompt)).toBe(true);
      expect(prompt.systemPrompt).toContain('Context is supporting background, not the text to transform.');
      expect(prompt.systemPrompt).toContain('Use it to clarify references and add relevant, supported detail consistent with source.');
      expect(prompt.systemPrompt).toContain('source takes precedence for the message, facts, speaker, recipient, and point of view.');
      expect(prompt.systemPrompt).toContain('Style, tone, and length changes must not invent circumstances, reasons, or promises.');
      expect(JSON.parse(prompt.userPrompt.slice(prompt.userPrompt.indexOf('{')))).toEqual({
        context: contextText, source: userText,
      });
    });
  });

  it.each(ROLES)('keeps the $id primary task when options are empty', async (role) => {
    const prompt = await builder.buildPrompt({
      id: role.id,
      model: 'open-router-free',
      aiRoleId: role.id,
      userText: 'Source',
      options: {},
    });

    expect(prompt.systemPrompt.startsWith(role.systemPrompt)).toBe(true);
    expect(prompt.userPrompt).toContain("Perform the role's primary task without additional transformations.");
    expect(prompt.promptRevision).toBe(`prompt-v7/${role.id}@${role.systemPromptVersion}`);
    expect(prompt.promptFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps email completion inherent without the format option', async () => {
    const prompt = await builder.buildPrompt({
      id: 'email',
      model: 'open-router-free',
      aiRoleId: 'email_assistant',
      userText: 'Ask Dana for the report',
      options: { format: false },
    });

    expect(prompt.systemPrompt).toContain('complete, ready-to-send email');
    expect(prompt.systemPrompt).toContain('Always include a specific "Subject:" line');
    expect(prompt.systemPrompt).toContain('the source greeting identifies the recipient');
    expect(prompt.systemPrompt).toContain('its signature identifies the sender');
    expect(prompt.systemPrompt).toContain('a placeholder only when the sender is unknown');
    expect(prompt.systemPrompt).toContain('do not copy the prior email\'s greeting or reverse the conversation');
    expect(prompt.userPrompt).not.toContain('Improve readability with appropriate paragraphs');
  });

  it.each(ROLES)('applies AI-symbol preference without dropping $id role requirements', async (role) => {
    const prompt = await builder.buildPrompt({
      id: role.id, model: role.allowedModels[0], aiRoleId: role.id,
      userText: 'Source', options: { avoidCommonAiSymbols: true },
    });
    expect(prompt.systemPrompt).toContain(role.systemPrompt);
    expect(prompt.systemPrompt).toContain('DO NOT generate the em dash (—) in any output.');
    expect(prompt.userPrompt).toContain('Avoid common AI-writing symbols and patterns');
    if (role.id === 'email_assistant') expect(prompt.systemPrompt).toContain('"Subject:" line');
  });

  it('carries the reported source dash as data while instructing every role to rewrite it', async () => {
    for (const role of ROLES) {
      const prompt = await builder.buildPrompt({
        id: role.id, model: role.allowedModels[0], aiRoleId: role.id,
        userText: 'tests; to do По умолчанию — true', options: { avoidCommonAiSymbols: true },
      });
      expect(prompt.userPrompt).toContain('По умолчанию — true');
      expect(prompt.systemPrompt).toContain('rewrite it when it appears in the source');
      expect(prompt.systemPrompt).toContain(role.systemPrompt);
    }
  });

  it('keeps summarization inherent without shorten', async () => {
    const prompt = await builder.buildPrompt({
      id: 'summary',
      model: 'open-router-free',
      aiRoleId: 'summarizer',
      userText: 'Long source',
      options: { shorten: false },
    });

    expect(prompt.systemPrompt).toContain('expert summarizer and analyst');
    expect(prompt.userPrompt).not.toContain('Make the result meaningfully shorter');
  });

  it('builds all requested option deltas', async () => {
    const config: AssistantConfiguration = {
      id: 'all',
      model: 'open-router-free',
      aiRoleId: 'editor',
      userText: 'Source',
      contextText: 'Reference',
      options: {
        improve: true,
        fixMistakes: true,
        format: true,
        lengthen: true,
        addEmojis: true,
        formality: 'Formal',
        tone: 'Polite',
        languageLevel: 'intermediate',
        translateTo: 'pt',
      },
    };

    const prompt = (await builder.buildPrompt(config)).userPrompt;
    expect(prompt).toContain('Improve clarity, coherence');
    expect(prompt).toContain('Correct grammar, spelling');
    expect(prompt).toContain('Improve readability with appropriate paragraphs');
    expect(prompt).toContain('Develop the result with relevant explanation');
    expect(prompt).toContain('Add a small number of relevant emojis');
    expect(prompt).toContain('polished, professional wording');
    expect(prompt).toContain('polite, courteous');
    expect(prompt).toContain('standard vocabulary and moderately varied sentences');
    expect(prompt).toContain('Translate the result into natural, idiomatic Portuguese');
  });

  it('rejects unknown and incompatible roles', async () => {
    await expect(builder.buildPrompt({
      id: 'bad-role', model: 'open-router-free', aiRoleId: 'missing', userText: 'Text', options: {},
    })).rejects.toThrow('Unknown AI role');
    await expect(builder.buildPrompt({
      id: 'bad-model', model: 'missing', aiRoleId: 'editor', userText: 'Text', options: {},
    })).rejects.toThrow('is not allowed');
  });
});
