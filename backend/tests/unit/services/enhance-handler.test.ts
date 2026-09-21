import { handleRequest } from '../../../supabase/functions/enhance/handler.ts';
import { InvalidRequestError } from '../../../src/errors/orchestration-errors.ts';

const user = {
  userId: 'user',
  email: 'user@example.com',
  tier: 'free' as const,
  isAdmin: false,
  isActive: true,
  tokensAvailable: 1000,
  tokensUsed: 0,
  authProvider: 'email' as const,
};

function services(processBatch: jest.Mock) {
  return {
    authMiddleware: { authenticate: jest.fn().mockResolvedValue(user) },
    orchestrator: { processBatch },
    config: { exposeErrorDetails: false },
  } as never;
}

describe('enhance handler validation errors', () => {
  it('returns a safe typed 400 for invalid configuration', async () => {
    const processBatch = jest.fn().mockRejectedValue(new InvalidRequestError('assistants[0].tone is not supported'));
    const response = await handleRequest(
      new Request('http://localhost/enhance', { method: 'POST', body: JSON.stringify({ assistants: [{}] }) }),
      services(processBatch)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'assistants[0].tone is not supported' },
    });
    expect(processBatch).toHaveBeenCalledTimes(1);
  });

  it('returns INVALID_REQUEST for malformed JSON before authentication or provider work', async () => {
    const processBatch = jest.fn();
    const configuredServices = services(processBatch) as any;
    const response = await handleRequest(
      new Request('http://localhost/enhance', { method: 'POST', body: '{' }),
      configuredServices
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Request body is not valid JSON' },
    });
    expect(configuredServices.authMiddleware.authenticate).not.toHaveBeenCalled();
    expect(processBatch).not.toHaveBeenCalled();
  });
});
