import type { UserTier } from './auth.types.ts';

/** Explicit server-side input for creating initial accounts. No runtime fixtures. */
export interface BootstrapUser {
  email: string;
  password: string;
  tier: UserTier;
  isAdmin: boolean;
  tokens: number;
  isActive: boolean;
  description: string;
}
