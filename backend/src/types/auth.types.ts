/**
 * Authentication and Authorization Type Definitions
 * Platform-agnostic types for user authentication and tier-based access control
 */

export type UserTier = 'free' | 'plus' | 'premium';

export type AuthProvider = 'email' | 'google' | 'github' | 'apple' | 'facebook' | 'twitter' | 'azure' | 'anonymous' | 'other';

export interface UserProfile {
  userId: string;
  email: string;
  tier: UserTier;
  isAdmin: boolean;
  isActive: boolean;
  tokensAvailable: number;
  tokensUsed: number;
  authProvider: AuthProvider;
}

export interface AuthResult {
  authenticated: boolean;
  user?: UserProfile;
  error?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}
