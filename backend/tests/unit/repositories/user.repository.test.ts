/**
 * Unit Tests for UserRepository
 * Tests database operations for user profiles and quotas
 */

import { UserRepository, UserRepositoryError } from '../../../src/repositories/user.repository.ts';
import type { UserWithQuota } from '../../../src/repositories/user.repository.ts';
import type { UserTier } from '../../../src/types/auth.types.ts';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
};

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = new UserRepository(mockSupabaseClient as any);
  });

  describe('getUserById', () => {
    it('should fetch user with quota by ID successfully', async () => {
      const mockData = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'plus' as UserTier,
        is_admin: false,
        is_active: true,
        created_at: '2025-01-25T00:00:00Z',
        updated_at: '2025-01-25T00:00:00Z',
        user_quotas: [{
          tokens_available: 500_000,
          tokens_used: 100_000,
        }],
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await userRepository.getUserById('user-123');

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        tier: 'plus',
        isAdmin: false,
        isActive: true,
        tokensAvailable: 500_000,
        tokensUsed: 100_000,
        createdAt: '2025-01-25T00:00:00Z',
        updatedAt: '2025-01-25T00:00:00Z',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_profiles');
    });

    it('should handle quota as object instead of array', async () => {
      const mockData = {
        id: 'user-456',
        email: 'another@example.com',
        tier: 'free' as UserTier,
        is_admin: false,
        is_active: true,
        created_at: '2025-01-25T00:00:00Z',
        updated_at: '2025-01-25T00:00:00Z',
        user_quotas: {
          tokens_available: 50_000,
          tokens_used: 0,
        },
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await userRepository.getUserById('user-456');

      expect(result.tokensAvailable).toBe(50_000);
      expect(result.tokensUsed).toBe(0);
    });

    it('should throw UserRepositoryError when user not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(userRepository.getUserById('nonexistent')).rejects.toThrow(
        UserRepositoryError
      );
      await expect(userRepository.getUserById('nonexistent')).rejects.toThrow(
        'User not found: nonexistent'
      );
    });

    it('should throw UserRepositoryError when quota not found', async () => {
      const mockData = {
        id: 'user-789',
        email: 'noquota@example.com',
        tier: 'free' as UserTier,
        is_admin: false,
        is_active: true,
        created_at: '2025-01-25T00:00:00Z',
        updated_at: '2025-01-25T00:00:00Z',
        user_quotas: null,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      await expect(userRepository.getUserById('user-789')).rejects.toThrow(
        UserRepositoryError
      );
      await expect(userRepository.getUserById('user-789')).rejects.toThrow(
        'User quota not found'
      );
    });

    it('should throw UserRepositoryError on database error', async () => {
      const mockError = { message: 'Database connection failed', code: 'DB_ERROR' };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      });

      await expect(userRepository.getUserById('user-123')).rejects.toThrow(
        UserRepositoryError
      );
      await expect(userRepository.getUserById('user-123')).rejects.toThrow(
        'Failed to fetch user by ID'
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should fetch user with quota by email successfully', async () => {
      const mockData = {
        id: 'user-email-123',
        email: 'email@example.com',
        tier: 'premium' as UserTier,
        is_admin: true,
        is_active: true,
        created_at: '2025-01-25T00:00:00Z',
        updated_at: '2025-01-25T00:00:00Z',
        user_quotas: [{
          tokens_available: 10_000_000,
          tokens_used: 0,
        }],
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await userRepository.getUserByEmail('email@example.com');

      expect(result.email).toBe('email@example.com');
      expect(result.tier).toBe('premium');
      expect(result.isAdmin).toBe(true);
    });

    it('should throw UserRepositoryError when email not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(
        userRepository.getUserByEmail('nonexistent@example.com')
      ).rejects.toThrow(UserRepositoryError);
      await expect(
        userRepository.getUserByEmail('nonexistent@example.com')
      ).rejects.toThrow('User not found with email');
    });
  });

  describe('updateUserTier', () => {
    it('should update user tier successfully', async () => {
      const mockUpdateData = {
        id: 'user-123',
        tier: 'premium' as UserTier,
        updated_at: '2025-01-25T01:00:00Z',
      };

      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'premium' as UserTier,
        is_admin: false,
        is_active: true,
        created_at: '2025-01-25T00:00:00Z',
        updated_at: '2025-01-25T01:00:00Z',
        user_quotas: [{
          tokens_available: 500_000,
          tokens_used: 100_000,
        }],
      };

      // Mock update call
      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockUpdateData, error: null }),
            }),
          }),
        }),
      });

      // Mock getUserById call
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null }),
          }),
        }),
      });

      const result = await userRepository.updateUserTier('user-123', 'premium');

      expect(result.tier).toBe('premium');
    });

    it('should throw UserRepositoryError when user not found during update', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      await expect(
        userRepository.updateUserTier('nonexistent', 'premium')
      ).rejects.toThrow(UserRepositoryError);
      await expect(
        userRepository.updateUserTier('nonexistent', 'premium')
      ).rejects.toThrow('User not found');
    });
  });

  describe('updateUserStatus', () => {
    it('should block user successfully', async () => {
      const mockUpdateData = {
        id: 'user-123',
        is_active: false,
        updated_at: '2025-01-25T01:00:00Z',
      };

      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'free' as UserTier,
        is_admin: false,
        is_active: false,
        created_at: '2025-01-25T00:00:00Z',
        updated_at: '2025-01-25T01:00:00Z',
        user_quotas: [{
          tokens_available: 50_000,
          tokens_used: 0,
        }],
      };

      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockUpdateData, error: null }),
            }),
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null }),
          }),
        }),
      });

      const result = await userRepository.updateUserStatus('user-123', false);

      expect(result.isActive).toBe(false);
    });

    it('should unblock user successfully', async () => {
      const mockUpdateData = {
        id: 'user-456',
        is_active: true,
        updated_at: '2025-01-25T01:00:00Z',
      };

      const mockUserData = {
        id: 'user-456',
        email: 'blocked@example.com',
        tier: 'free' as UserTier,
        is_admin: false,
        is_active: true,
        created_at: '2025-01-25T00:00:00Z',
        updated_at: '2025-01-25T01:00:00Z',
        user_quotas: [{
          tokens_available: 10_000,
          tokens_used: 0,
        }],
      };

      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockUpdateData, error: null }),
            }),
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null }),
          }),
        }),
      });

      const result = await userRepository.updateUserStatus('user-456', true);

      expect(result.isActive).toBe(true);
    });
  });

  describe('listUsers', () => {
    it('should list users with pagination', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          tier: 'free' as UserTier,
          is_admin: false,
          is_active: true,
          created_at: '2025-01-25T00:00:00Z',
          updated_at: '2025-01-25T00:00:00Z',
          user_quotas: [{ tokens_available: 50_000, tokens_used: 0 }],
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          tier: 'plus' as UserTier,
          is_admin: false,
          is_active: true,
          created_at: '2025-01-25T00:00:00Z',
          updated_at: '2025-01-25T00:00:00Z',
          user_quotas: [{ tokens_available: 500_000, tokens_used: 100_000 }],
        },
      ];

      // Mock count query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 10, error: null }),
      });

      // Mock data query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            range: jest.fn().mockResolvedValue({ data: mockUsers, error: null }),
          }),
        }),
      });

      const result = await userRepository.listUsers(2, 0);

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
      expect(result.users[0].email).toBe('user1@example.com');
      expect(result.users[1].email).toBe('user2@example.com');
    });

    it('should handle empty user list', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 0, error: null }),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            range: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const result = await userRepository.listUsers(50, 0);

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle users with missing quota gracefully', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          tier: 'free' as UserTier,
          is_admin: false,
          is_active: true,
          created_at: '2025-01-25T00:00:00Z',
          updated_at: '2025-01-25T00:00:00Z',
          user_quotas: null,
        },
      ];

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 1, error: null }),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            range: jest.fn().mockResolvedValue({ data: mockUsers, error: null }),
          }),
        }),
      });

      const result = await userRepository.listUsers(50, 0);

      expect(result.users).toHaveLength(1);
      expect(result.users[0].tokensAvailable).toBe(0);
      expect(result.users[0].tokensUsed).toBe(0);
    });

    it('should throw UserRepositoryError on count error', async () => {
      const mockError = { message: 'Database error', code: 'DB_ERROR' };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ count: null, error: mockError }),
      });

      await expect(userRepository.listUsers(50, 0)).rejects.toThrow(
        UserRepositoryError
      );
      await expect(userRepository.listUsers(50, 0)).rejects.toThrow(
        'Failed to count users'
      );
    });
  });
});
