/**
 * AuthService Unit Tests
 * Tests JWT token validation and user profile fetching
 */

import { AuthService } from '../../../src/services/auth-service.ts';
import { UserNotFoundError, UserBlockedError } from '../../../src/errors/auth-errors.ts';
import { TestEnv } from '../helpers/test-env.ts';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getClaims: jest.fn(),
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

// Mock UserRepository
jest.mock('../../../src/repositories/user.repository.ts', () => {
  return {
    UserRepository: jest.fn().mockImplementation(() => ({
      getUserById: jest.fn(),
    })),
  };
});

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: any;

  beforeAll(() => {
    TestEnv.setup();
  });

  afterAll(() => {
    TestEnv.teardown();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    authService = new AuthService(mockSupabaseClient as any);
    mockUserRepository = (authService as any).userRepository;
  });

  describe('validateToken', () => {
    it('should validate token and return user profile for free tier user', async () => {
      mockSupabaseClient.auth.getClaims.mockResolvedValue({
        data: { claims: { sub: 'user-123' } }, error: null,
      });

      // Mock user repository response
      mockUserRepository.getUserById.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        tier: 'free',
        isAdmin: false,
        isActive: true,
        tokensAvailable: 50000,
        tokensUsed: 0,
        authProvider: 'email',
      });

      const result = await authService.validateToken('mock-jwt-token');

      expect(result.authenticated).toBe(true);
      expect(result.user?.userId).toBe('user-123');
      expect(result.user?.email).toBe('test@example.com');
      expect(result.user?.tier).toBe('free');
      expect(result.user?.tokensAvailable).toBe(50000);
      expect(result.user?.tokensUsed).toBe(0);
      expect(result.user?.isAdmin).toBe(false);
      expect(result.user?.isActive).toBe(true);
      expect(result.user?.authProvider).toBe('email');
    });

    it('should validate token for plus tier user', async () => {
      mockSupabaseClient.auth.getClaims.mockResolvedValue({
        data: { claims: { sub: 'user-456' } }, error: null,
      });

      mockUserRepository.getUserById.mockResolvedValue({
        userId: 'user-456',
        email: 'plus@example.com',
        tier: 'plus',
        isAdmin: false,
        isActive: true,
        tokensAvailable: 500000,
        tokensUsed: 50000,
        authProvider: 'google',
      });

      const result = await authService.validateToken('mock-jwt-token');

      expect(result.authenticated).toBe(true);
      expect(result.user?.tier).toBe('plus');
      expect(result.user?.tokensAvailable).toBe(500000);
      expect(result.user?.tokensUsed).toBe(50000);
      expect(result.user?.authProvider).toBe('google');
    });

    it('should validate token for premium tier user', async () => {
      mockSupabaseClient.auth.getClaims.mockResolvedValue({
        data: { claims: { sub: 'user-789' } }, error: null,
      });

      mockUserRepository.getUserById.mockResolvedValue({
        userId: 'user-789',
        email: 'premium@example.com',
        tier: 'premium',
        isAdmin: true,
        isActive: true,
        tokensAvailable: 5000000,
        tokensUsed: 100000,
        authProvider: 'email',
      });

      const result = await authService.validateToken('mock-jwt-token');

      expect(result.authenticated).toBe(true);
      expect(result.user?.tier).toBe('premium');
      expect(result.user?.tokensAvailable).toBe(5000000);
      expect(result.user?.isAdmin).toBe(true);
    });

    it('should handle invalid token (malformed JWT)', async () => {
      mockSupabaseClient.auth.getClaims.mockRejectedValue(new Error('Invalid JWT'));

      const result = await authService.validateToken('invalid-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty token', async () => {
      mockSupabaseClient.auth.getClaims.mockRejectedValue(new Error('Empty token'));

      const result = await authService.validateToken('');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle token with wrong signature', async () => {
      mockSupabaseClient.auth.getClaims.mockRejectedValue(new Error('signature verification failed'));

      const result = await authService.validateToken('mock-jwt-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle token without sub claim', async () => {
      mockSupabaseClient.auth.getClaims.mockResolvedValue({
        data: { claims: { userId: 'user-123' } }, error: null,
      });

      const result = await authService.validateToken('mock-jwt-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('missing sub claim');
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      mockSupabaseClient.auth.getClaims.mockResolvedValue({
        data: { claims: { sub: 'nonexistent-user' } }, error: null,
      });

      mockUserRepository.getUserById.mockRejectedValue(
        new Error('User not found')
      );

      await expect(authService.validateToken('mock-jwt-token')).rejects.toThrow(UserNotFoundError);
    });

    it('should throw UserBlockedError when user is blocked', async () => {
      mockSupabaseClient.auth.getClaims.mockResolvedValue({
        data: { claims: { sub: 'blocked-user' } }, error: null,
      });

      mockUserRepository.getUserById.mockResolvedValue({
        userId: 'blocked-user',
        email: 'blocked@example.com',
        tier: 'free',
        isAdmin: false,
        isActive: false, // User is blocked
        tokensAvailable: 10000,
        tokensUsed: 0,
        authProvider: 'email',
      });

      await expect(authService.validateToken('mock-jwt-token')).rejects.toThrow(UserBlockedError);
    });

    it('should provide complete user data structure', async () => {
      mockSupabaseClient.auth.getClaims.mockResolvedValue({
        data: { claims: { sub: 'user-complete' } }, error: null,
      });

      mockUserRepository.getUserById.mockResolvedValue({
        userId: 'user-complete',
        email: 'complete@example.com',
        tier: 'free',
        isAdmin: false,
        isActive: true,
        tokensAvailable: 50000,
        tokensUsed: 5000,
        authProvider: 'anonymous',
      });

      const result = await authService.validateToken('mock-jwt-token');

      expect(result.authenticated).toBe(true);
      expect(result.user).toHaveProperty('userId');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('tier');
      expect(result.user).toHaveProperty('isAdmin');
      expect(result.user).toHaveProperty('isActive');
      expect(result.user).toHaveProperty('tokensAvailable');
      expect(result.user).toHaveProperty('tokensUsed');
      expect(result.user).toHaveProperty('authProvider');
    });
  });
});
