import { loadBootstrapConfig } from '../../../src/config/admin.config.ts';

describe('admin bootstrap configuration', () => {
  const original = process.env;
  const user = { email: 'owner@example.com', password: 'test-password-16-characters', tier: 'premium',
    isAdmin: true, isActive: true, tokens: 10_000, description: 'Initial admin' };
  beforeEach(() => {
    process.env = { ...original };
    delete process.env.ADMIN_BOOTSTRAP_USERS_JSON;
    delete process.env.BOOTSTRAP_SECRET_KEY;
  });
  afterAll(() => { process.env = original; });

  it('disables bootstrap when no explicit users are supplied', () => {
    process.env.BOOTSTRAP_SECRET_KEY = 'x'.repeat(32);
    expect(loadBootstrapConfig()).toEqual({ users: [] });
  });
  it('requires a secret when users are supplied', () => {
    process.env.ADMIN_BOOTSTRAP_USERS_JSON = JSON.stringify([user]);
    expect(() => loadBootstrapConfig()).toThrow('BOOTSTRAP_SECRET_KEY');
  });
  it('loads explicitly configured users', () => {
    process.env.BOOTSTRAP_SECRET_KEY = 'x'.repeat(32);
    process.env.ADMIN_BOOTSTRAP_USERS_JSON = JSON.stringify([user]);
    expect(loadBootstrapConfig().users).toEqual([user]);
  });
  it.each(['[]', '{}', 'invalid', JSON.stringify([{ ...user, password: 'short' }]),
    JSON.stringify([user, { ...user, email: 'OWNER@example.com' }]),
    JSON.stringify([{ ...user, tokens: -1 }])])('rejects invalid bootstrap input %#', raw => {
    process.env.BOOTSTRAP_SECRET_KEY = 'x'.repeat(32);
    process.env.ADMIN_BOOTSTRAP_USERS_JSON = raw;
    expect(() => loadBootstrapConfig()).toThrow();
  });
});
