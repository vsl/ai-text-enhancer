import { getEnvVar, requiredEnv } from './environment.ts';
import type { BootstrapUser } from '../types/admin.types.ts';

export const ADMIN_POLICY = {
  minimumSecretLength: 32,
  minimumPasswordLength: 16,
  userPageSize: 1_000,
  defaultListLimit: 50,
  maximumListLimit: 100,
  defaultListOffset: 0,
  recentPurchaseLimit: 10,
};

/** Bootstrap is disabled unless both a secret and an explicit user list exist. */
export function loadBootstrapConfig(): { secretKey?: string; users: BootstrapUser[] } {
  const raw = getEnvVar('ADMIN_BOOTSTRAP_USERS_JSON');
  if (!raw) return { users: [] };
  const secretKey = requiredEnv('BOOTSTRAP_SECRET_KEY');
  if (secretKey.length < ADMIN_POLICY.minimumSecretLength) throw new Error('BOOTSTRAP_SECRET_KEY must contain at least 32 characters');
  let users: unknown;
  try { users = JSON.parse(raw); }
  catch { throw new Error('ADMIN_BOOTSTRAP_USERS_JSON must be valid JSON'); }
  if (!Array.isArray(users) || users.length === 0) throw new Error('Bootstrap requires a nonempty user array');
  const emails = new Set<string>();
  for (const user of users) {
    if (!user || typeof user !== 'object' || Array.isArray(user)
      || typeof user.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
      || typeof user.password !== 'string' || user.password.length < ADMIN_POLICY.minimumPasswordLength
      || !['free', 'plus', 'premium'].includes(user.tier)
      || typeof user.isAdmin !== 'boolean' || typeof user.isActive !== 'boolean'
      || !Number.isSafeInteger(user.tokens) || user.tokens < 0
      || typeof user.description !== 'string' || !user.description.trim()
      || emails.has(user.email.toLowerCase())) {
      throw new Error('Invalid bootstrap user: require unique email, 16+ character password, tier, flags, tokens and description');
    }
    emails.add(user.email.toLowerCase());
  }
  return { secretKey, users: users as BootstrapUser[] };
}
