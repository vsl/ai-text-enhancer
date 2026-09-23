import { PromptBuilder } from '../../../src/services/prompt-builder.ts';
import { ROLES } from '../../../src/config/roles.config.ts';
import type { AssistantConfiguration } from '../../../src/types/api.types.ts';

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

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
    expect(prompt.promptRevision).toBe(`prompt-v2/${role.id}@v1`);
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
    expect(prompt.userPrompt).not.toContain('Improve readability with appropriate paragraphs');
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
