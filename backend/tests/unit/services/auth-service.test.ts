/**
 * AuthService Unit Tests
 * Tests JWT token validation and user profile fetching
 */

import { AuthService } from '../../../src/services/auth-service.ts';
import { UserNotFoundError, UserBlockedError } from '../../../src/errors/auth-errors.ts';
import { TestEnv } from '../helpers/test-env.ts';

// Mock jose module for ESM compatibility in Jest
jest.mock('npm:jose@5', () => ({
  jwtVerify: jest.fn(),
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    sign: jest.fn(),
  })),
}));

// Import after mocking
const { jwtVerify } = require('npm:jose@5');

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
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
  const TEST_JWT_SECRET = 'test-jwt-secret-with-at-least-32-chars-long';

  beforeAll(() => {
    TestEnv.setup();
  });

  afterAll(() => {
    TestEnv.teardown();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    authService = new AuthService(mockSupabaseClient as any, TEST_JWT_SECRET);
    mockUserRepository = (authService as any).userRepository;
  });

  describe('validateToken', () => {
    it('should validate token and return user profile for free tier user', async () => {
      // Mock jwtVerify to return valid payload
      (jwtVerify as jest.Mock).mockResolvedValue({
        payload: { sub: 'user-123' },
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
      (jwtVerify as jest.Mock).mockResolvedValue({
        payload: { sub: 'user-456' },
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
      (jwtVerify as jest.Mock).mockResolvedValue({
        payload: { sub: 'user-789' },
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
      (jwtVerify as jest.Mock).mockRejectedValue(new Error('Invalid JWT'));

      const result = await authService.validateToken('invalid-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty token', async () => {
      (jwtVerify as jest.Mock).mockRejectedValue(new Error('Empty token'));

      const result = await authService.validateToken('');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle token with wrong signature', async () => {
      (jwtVerify as jest.Mock).mockRejectedValue(new Error('signature verification failed'));

      const result = await authService.validateToken('mock-jwt-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle token without sub claim', async () => {
      (jwtVerify as jest.Mock).mockResolvedValue({
        payload: { userId: 'user-123' }, // Wrong claim (userId instead of sub)
      });

      const result = await authService.validateToken('mock-jwt-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('missing sub claim');
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      (jwtVerify as jest.Mock).mockResolvedValue({
        payload: { sub: 'nonexistent-user' },
      });

      mockUserRepository.getUserById.mockRejectedValue(
        new Error('User not found')
      );

      await expect(authService.validateToken('mock-jwt-token')).rejects.toThrow(UserNotFoundError);
    });

    it('should throw UserBlockedError when user is blocked', async () => {
      (jwtVerify as jest.Mock).mockResolvedValue({
        payload: { sub: 'blocked-user' },
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
      (jwtVerify as jest.Mock).mockResolvedValue({
        payload: { sub: 'user-complete' },
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
