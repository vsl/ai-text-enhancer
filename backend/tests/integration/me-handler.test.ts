import { handleRequest } from '../../supabase/functions/me/handler.ts';
import { InvalidTokenError, UserBlockedError } from '../../src/errors/auth-errors.ts';

describe('/me HTTP boundary', () => {
  const authenticate = jest.fn();
  const services = { authMiddleware: { authenticate }, supabase: {} } as unknown as Parameters<typeof handleRequest>[1];
  beforeEach(() => { authenticate.mockReset(); });

  it('serves health and preflight without authentication', async () => {
    expect((await handleRequest(new Request('https://example.test/me/health'), services)).status).toBe(200);
    expect((await handleRequest(new Request('https://example.test/me', { method: 'OPTIONS' }), services)).status).toBe(204);
    expect(authenticate).not.toHaveBeenCalled();
  });
  it('rejects unknown paths and unsupported methods', async () => {
    expect((await handleRequest(new Request('https://example.test/me/unknown'), services)).status).toBe(404);
    expect((await handleRequest(new Request('https://example.test/me', { method: 'POST' }), services)).status).toBe(405);
    expect(authenticate).not.toHaveBeenCalled();
  });
  it.each([[new InvalidTokenError(), 401], [new UserBlockedError('user'), 403]])('maps auth failures to their HTTP status %#', async (error, status) => {
    authenticate.mockRejectedValue(error);
    const response = await handleRequest(new Request('https://example.test/me'), services);
    expect(response.status).toBe(status);
  });
  it('does not expose unexpected internal errors', async () => {
    authenticate.mockRejectedValue(new Error('private database diagnostics'));
    const response = await handleRequest(new Request('https://example.test/me'), services);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private database');
  });
});
