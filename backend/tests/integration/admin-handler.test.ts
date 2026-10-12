import { handleRequest } from '../../supabase/functions/admin/handler.ts';
import { AuthorizationError } from '../../src/errors/auth-errors.ts';
import { BOOTSTRAP_USERS } from '../fixtures/bootstrap-users.ts';

describe('/admin HTTP boundary', () => {
  const bootstrapUsers = jest.fn();
  const authenticateAdmin = jest.fn();
  const service = { bootstrapUsers, authenticateAdmin } as unknown as Parameters<typeof handleRequest>[1]['adminService'];
  beforeEach(() => { bootstrapUsers.mockReset(); authenticateAdmin.mockReset(); });

  it('disables unconfigured bootstrap', async () => {
    const response = await handleRequest(new Request('https://example.test/admin/bootstrap', { method: 'POST' }),
      { adminService: service, bootstrapUsers: [] });
    expect(response.status).toBe(503);
    expect(bootstrapUsers).not.toHaveBeenCalled();
  });
  it('requires the bootstrap secret and passes only server-configured users', async () => {
    const services = { adminService: service, bootstrapSecretKey: 'test-secret', bootstrapUsers: BOOTSTRAP_USERS };
    const denied = await handleRequest(new Request('https://example.test/admin/bootstrap', { method: 'POST' }), services);
    expect(denied.status).toBe(401);
    expect(bootstrapUsers).not.toHaveBeenCalled();
    bootstrapUsers.mockResolvedValue({ success: true });
    const allowed = await handleRequest(new Request('https://example.test/admin/bootstrap', {
      method: 'POST', headers: { Authorization: 'test-secret' }, body: '{"users":[]}',
    }), services);
    expect(allowed.status).toBe(200);
    expect(bootstrapUsers).toHaveBeenCalledWith(BOOTSTRAP_USERS);
  });
  it.each(['2junk', 'NaN', '-1', '1.5'])('rejects invalid pagination %s before a database query', async (limit) => {
    authenticateAdmin.mockResolvedValue('admin-id');
    const response = await handleRequest(new Request(`https://example.test/admin/users?limit=${limit}`, {
      headers: { Authorization: 'Bearer test-token' },
    }), { adminService: service, bootstrapUsers: [] });
    expect(response.status).toBe(400);
  });

  it('maps insufficient admin privileges to 403', async () => {
    authenticateAdmin.mockRejectedValue(new AuthorizationError('Active admin privileges required'));
    const response = await handleRequest(new Request('https://example.test/admin/users', {
      headers: { Authorization: 'Bearer test-token' },
    }), { adminService: service, bootstrapUsers: [] });
    expect(response.status).toBe(403);
    expect(authenticateAdmin).toHaveBeenCalledWith('test-token');
  });
});
