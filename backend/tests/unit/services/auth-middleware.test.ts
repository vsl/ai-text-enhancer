/**
 * AuthMiddleware Unit Tests
 * Tests Supabase JWT validation and database lookups
 */

import { AuthMiddleware } from '../../../src/services/auth-middleware.ts';
import { InvalidTokenError, UserBlockedError, UserNotFoundError } from '../../../src/errors/auth-errors.ts';
import type { UserProfile } from '../../../src/types/auth.types.ts';
import { TestEnv } from '../helpers/test-env.ts';

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

// Mock AuthService
jest.mock('../../../src/services/auth-service.ts', () => {
  return {
    AuthService: jest.fn().mockImplementation((supabase) => {
      const mockService = {
        validateToken: jest.fn(),
        supabase,
      };
      (mockService as any).__mockInstance = mockService;
      return mockService;
    }),
  };
});

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockAuthService: any;

  beforeAll(() => {
    TestEnv.setup();
  });

  afterAll(() => {
    TestEnv.teardown();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    authMiddleware = new AuthMiddleware(mockSupabaseClient as any);
    mockAuthService = (authMiddleware as any).authService;
  });

  describe('authenticate', () => {
    it('should authenticate user with valid token (lowercase header)', async () => {
      const mockUser: UserProfile = {
        userId: 'user-123',
        email: 'test@example.com',
        tier: 'plus',
        isAdmin: false,
        isActive: true,
        tokensAvailable: 500000,
        tokensUsed: 0,
        authProvider: 'email',
      };

      mockAuthService.validateToken.mockResolvedValue({
        authenticated: true,
        user: mockUser,
      });

      const headers = {
        authorization: 'Bearer valid-jwt-token',
      };

      const user = await authMiddleware.authenticate(headers);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith('valid-jwt-token');
      expect(user).toEqual(mockUser);
    });

    it('should authenticate user with valid token (uppercase header)', async () => {
      const mockUser: UserProfile = {
        userId: 'user-456',
        email: 'premium@example.com',
        tier: 'premium',
        isAdmin: false,
        isActive: true,
        tokensAvailable: 5000000,
        tokensUsed: 100000,
        authProvider: 'email',
      };

      mockAuthService.validateToken.mockResolvedValue({
        authenticated: true,
        user: mockUser,
      });

      const headers = {
        Authorization: 'Bearer valid-jwt-token-uppercase',
      };

      const user = await authMiddleware.authenticate(headers);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(
        'valid-jwt-token-uppercase'
      );
      expect(user).toEqual(mockUser);
    });

    it('should throw InvalidTokenError when Authorization header is missing', async () => {
      const headers = {};

      await expect(authMiddleware.authenticate(headers)).rejects.toThrow(
        InvalidTokenError
      );

      expect(mockAuthService.validateToken).not.toHaveBeenCalled();
    });

    it('should throw InvalidTokenError when Authorization header is malformed (no Bearer)', async () => {
      const headers = {
        authorization: 'invalid-format-token',
      };

      await expect(authMiddleware.authenticate(headers)).rejects.toThrow(
        InvalidTokenError
      );

      expect(mockAuthService.validateToken).not.toHaveBeenCalled();
    });

    it('should throw InvalidTokenError when Authorization header is malformed (only Bearer)', async () => {
      const headers = {
        authorization: 'Bearer',
      };

      await expect(authMiddleware.authenticate(headers)).rejects.toThrow(
        InvalidTokenError
      );

      expect(mockAuthService.validateToken).not.toHaveBeenCalled();
    });

    it('should throw InvalidTokenError when JWT is invalid', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        authenticated: false,
        error: 'Invalid or expired token',
      });

      const headers = {
        authorization: 'Bearer invalid-jwt-token',
      };

      await expect(authMiddleware.authenticate(headers)).rejects.toThrow(
        InvalidTokenError
      );
    });

    it('should throw UserBlockedError when user is blocked', async () => {
      mockAuthService.validateToken.mockRejectedValue(
        new UserBlockedError('blocked-user-id')
      );

      const headers = {
        authorization: 'Bearer valid-token-blocked-user',
      };

      await expect(authMiddleware.authenticate(headers)).rejects.toThrow(
        UserBlockedError
      );
    });

    it('should throw UserNotFoundError when user not found in database', async () => {
      mockAuthService.validateToken.mockRejectedValue(
        new UserNotFoundError('nonexistent-user-id')
      );

      const headers = {
        authorization: 'Bearer valid-token-missing-profile',
      };

      await expect(authMiddleware.authenticate(headers)).rejects.toThrow(
        UserNotFoundError
      );
    });

    it('should handle case-insensitive header lookup', async () => {
      const mockUser: UserProfile = {
        userId: 'user-789',
        email: 'free@example.com',
        tier: 'free',
        isAdmin: false,
        isActive: true,
        tokensAvailable: 50000,
        tokensUsed: 0,
        authProvider: 'email',
      };

      mockAuthService.validateToken.mockResolvedValue({
        authenticated: true,
        user: mockUser,
      });

      // Test lowercase
      let headers: Record<string, string> = { authorization: 'Bearer token-lower' };
      let user = await authMiddleware.authenticate(headers);
      expect(user).toEqual(mockUser);

      // Test uppercase
      headers = { Authorization: 'Bearer token-upper' };
      user = await authMiddleware.authenticate(headers);
      expect(user).toEqual(mockUser);
    });

    it('should authenticate admin user correctly', async () => {
      const mockUser: UserProfile = {
        userId: 'admin-user-123',
        email: 'admin@example.com',
        tier: 'premium',
        isAdmin: true,
        isActive: true,
        tokensAvailable: 10000000,
        tokensUsed: 0,
        authProvider: 'email',
      };

      mockAuthService.validateToken.mockResolvedValue({
        authenticated: true,
        user: mockUser,
      });

      const headers = {
        authorization: 'Bearer admin-jwt-token',
      };

      const user = await authMiddleware.authenticate(headers);

      expect(user.isAdmin).toBe(true);
      expect(user.tier).toBe('premium');
    });
  });
});
