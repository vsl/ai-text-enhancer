import { validateBatchRequest } from '../../../src/services/request-validator.ts';
import { InvalidRequestError } from '../../../src/errors/orchestration-errors.ts';
import type { UserProfile } from '../../../src/types/auth.types.ts';
import * as roleConfig from '../../../src/config/roles.config.ts';

const user: UserProfile = {
  userId: 'user',
  email: 'user@example.com',
  tier: 'free',
  isAdmin: false,
  isActive: true,
  tokensAvailable: 10000,
  tokensUsed: 0,
  authProvider: 'email',
};

function validRequest() {
  return {
    assistants: [{
      id: '1',
      model: 'open-router-free',
      aiRoleId: 'editor',
      userText: 'Please improve this text.',
      contextText: 'Reference only.',
      options: {
        improve: true,
        fixMistakes: true,
        format: false,
        shorten: false,
        lengthen: false,
        addEmojis: false,
        formality: 'Neutral',
        tone: 'Confident',
        languageLevel: 'default',
        translateTo: 'pt',
      },
    }],
  };
}

describe('validateBatchRequest', () => {
  it('accepts the complete UI payload', () => {
    expect(validateBatchRequest(validRequest(), user)).toEqual(validRequest());
  });

  it.each([
    null,
    [],
    {},
    { assistants: 'bad' },
    { assistants: [] },
    { assistants: [null] },
  ])('rejects malformed shapes %#', (value) => {
    expect(() => validateBatchRequest(value, user)).toThrow(InvalidRequestError);
  });

  it.each([
    ['blank id', (request: ReturnType<typeof validRequest>) => { request.assistants[0].id = '  '; }],
    ['blank text', (request: ReturnType<typeof validRequest>) => { request.assistants[0].userText = ''; }],
    ['unknown model', (request: ReturnType<typeof validRequest>) => { request.assistants[0].model = 'missing'; }],
    ['unknown role', (request: ReturnType<typeof validRequest>) => { request.assistants[0].aiRoleId = 'missing'; }],
    ['invalid formality', (request: ReturnType<typeof validRequest>) => { request.assistants[0].options.formality = 'Professional'; }],
    ['invalid tone', (request: ReturnType<typeof validRequest>) => { request.assistants[0].options.tone = 'Neutral'; }],
    ['invalid language level', (request: ReturnType<typeof validRequest>) => { request.assistants[0].options.languageLevel = 'expert'; }],
    ['invalid language', (request: ReturnType<typeof validRequest>) => { request.assistants[0].options.translateTo = 'xx'; }],
  ])('rejects %s', (_name, mutate) => {
    const request = validRequest();
    mutate(request);
    expect(() => validateBatchRequest(request, user)).toThrow(InvalidRequestError);
  });

  it('rejects duplicate IDs', () => {
    const request = validRequest();
    request.assistants.push({ ...request.assistants[0], options: { ...request.assistants[0].options } });
    expect(() => validateBatchRequest(request, user)).toThrow('Assistant IDs must be unique');
  });

  it('rejects a role/model pair not allowed by role metadata', () => {
    const roleSpy = jest.spyOn(roleConfig, 'getRoleById').mockReturnValue({
      id: 'editor',
      name: 'Editor',
      systemPrompt: 'Edit text',
      systemPromptVersion: 'v1',
      allowedModels: ['openai-gpt-5-nano'],
    });
    const request = validRequest();
    request.assistants[0].model = 'open-router-free';

    expect(() => validateBatchRequest(request, user)).toThrow('incompatible role and model');
    roleSpy.mockRestore();
  });

  it('rejects tier text and context limits', () => {
    const textRequest = validRequest();
    textRequest.assistants[0].userText = 'x'.repeat(1001);
    expect(() => validateBatchRequest(textRequest, user)).toThrow('userText exceeds');

    const contextRequest = validRequest();
    contextRequest.assistants[0].contextText = 'x'.repeat(2501);
    expect(() => validateBatchRequest(contextRequest, user)).toThrow('contextText exceeds');
  });

  it('rejects option type errors, unknown keys, and conflicting lengths', () => {
    const wrongType = validRequest();
    (wrongType.assistants[0].options as Record<string, unknown>).improve = 'yes';
    expect(() => validateBatchRequest(wrongType, user)).toThrow('must be a boolean');

    const unknown = validRequest();
    (unknown.assistants[0].options as Record<string, unknown>).surprise = true;
    expect(() => validateBatchRequest(unknown, user)).toThrow('unsupported field');

    const conflict = validRequest();
    conflict.assistants[0].options.shorten = true;
    conflict.assistants[0].options.lengthen = true;
    expect(() => validateBatchRequest(conflict, user)).toThrow('cannot enable shorten and lengthen');
  });
});
