/**
 * Unit Tests for AdminService
 * Tests admin operations for user and quota management
 */

import { AdminService, AdminServiceError } from '../../../src/services/admin.service.ts';
import { UserRepository } from '../../../src/repositories/user.repository.ts';
import { QuotaRepository } from '../../../src/repositories/quota.repository.ts';
import type { UserWithQuota } from '../../../src/repositories/user.repository.ts';
import type { UserTier } from '../../../src/types/auth.types.ts';

// Mock repositories
jest.mock('../../../src/repositories/user.repository.ts');
jest.mock('../../../src/repositories/quota.repository.ts');

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  auth: {
    admin: {
      listUsers: jest.fn(),
      createUser: jest.fn(),
    },
  },
};

describe('AdminService', () => {
  let adminService: AdminService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockQuotaRepo: jest.Mocked<QuotaRepository>;

  const mockUser: UserWithQuota = {
    userId: 'user-123',
    email: 'test@example.com',
    tier: 'plus',
    isAdmin: false,
    isActive: true,
    tokensAvailable: 500_000,
    tokensUsed: 100_000,
    authProvider: 'email',
    createdAt: '2025-01-25T00:00:00Z',
    updatedAt: '2025-01-25T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    adminService = new AdminService(mockSupabaseClient as any);
    mockUserRepo = (adminService as any).userRepo as jest.Mocked<UserRepository>;
    mockQuotaRepo = (adminService as any).quotaRepo as jest.Mocked<QuotaRepository>;
  });

  describe('adjustTokens', () => {
    it('should add tokens successfully', async () => {
      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockQuotaRepo.addTokens.mockResolvedValue(true);
      mockQuotaRepo.getPurchaseHistory.mockResolvedValue({
        purchases: [],
        total: 0,
      });

      const updatedUser = { ...mockUser, tokensAvailable: 600_000 };
      mockUserRepo.getUserById.mockResolvedValueOnce(mockUser);
      mockUserRepo.getUserById.mockResolvedValueOnce(updatedUser);

      const result = await adminService.adjustTokens('user-123', 100_000, 'Bonus tokens');

      expect(result.profile.tokensAvailable).toBe(600_000);
      expect(mockQuotaRepo.addTokens).toHaveBeenCalledWith(
        'user-123',
        100_000,
        'admin_grant',
        'Bonus tokens'
      );
    });

    it('should subtract tokens successfully', async () => {
      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockQuotaRepo.deductTokens.mockResolvedValue(true);
      mockQuotaRepo.getPurchaseHistory.mockResolvedValue({
        purchases: [],
        total: 0,
      });

      const updatedUser = { ...mockUser, tokensAvailable: 400_000 };
      mockUserRepo.getUserById.mockResolvedValueOnce(mockUser);
      mockUserRepo.getUserById.mockResolvedValueOnce(updatedUser);

      const result = await adminService.adjustTokens('user-123', -100_000);

      expect(result.profile.tokensAvailable).toBe(400_000);
      expect(mockQuotaRepo.deductTokens).toHaveBeenCalledWith('user-123', 100_000);
    });

    it('should throw AdminServiceError when subtracting more tokens than available', async () => {
      const lowBalanceUser = { ...mockUser, tokensAvailable: 50_000 };
      mockUserRepo.getUserById.mockResolvedValue(lowBalanceUser);

      await expect(
        adminService.adjustTokens('user-123', -100_000)
      ).rejects.toThrow(AdminServiceError);
      await expect(
        adminService.adjustTokens('user-123', -100_000)
      ).rejects.toThrow('Cannot subtract 100000 tokens');

      expect(mockQuotaRepo.deductTokens).not.toHaveBeenCalled();
    });

    it('should throw AdminServiceError when adjustment amount is zero', async () => {
      await expect(adminService.adjustTokens('user-123', 0)).rejects.toThrow(
        AdminServiceError
      );
      await expect(adminService.adjustTokens('user-123', 0)).rejects.toThrow(
        'Token adjustment amount cannot be zero'
      );
    });

    it('should use default description for token grants', async () => {
      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockQuotaRepo.addTokens.mockResolvedValue(true);
      mockQuotaRepo.getPurchaseHistory.mockResolvedValue({
        purchases: [],
        total: 0,
      });

      const updatedUser = { ...mockUser, tokensAvailable: 550_000 };
      mockUserRepo.getUserById.mockResolvedValueOnce(mockUser);
      mockUserRepo.getUserById.mockResolvedValueOnce(updatedUser);

      await adminService.adjustTokens('user-123', 50_000);

      expect(mockQuotaRepo.addTokens).toHaveBeenCalledWith(
        'user-123',
        50_000,
        'admin_grant',
        'Admin granted 50000 tokens'
      );
    });
  });

  describe('changeTier', () => {
    it('should change user tier successfully', async () => {
      const updatedUser = { ...mockUser, tier: 'premium' as UserTier };
      mockUserRepo.updateUserTier.mockResolvedValue(updatedUser);
      mockQuotaRepo.getPurchaseHistory.mockResolvedValue({
        purchases: [],
        total: 0,
      });
      mockUserRepo.getUserById.mockResolvedValue(updatedUser);

      const result = await adminService.changeTier('user-123', 'premium');

      expect(result.profile.tier).toBe('premium');
      expect(mockUserRepo.updateUserTier).toHaveBeenCalledWith('user-123', 'premium');
    });

    it('should throw AdminServiceError for invalid tier', async () => {
      await expect(
        adminService.changeTier('user-123', 'invalid' as UserTier)
      ).rejects.toThrow(AdminServiceError);
      await expect(
        adminService.changeTier('user-123', 'invalid' as UserTier)
      ).rejects.toThrow('Invalid tier: invalid');

      expect(mockUserRepo.updateUserTier).not.toHaveBeenCalled();
    });

    it('should accept all valid tiers', async () => {
      const tiers: UserTier[] = ['free', 'plus', 'premium'];

      for (const tier of tiers) {
        const updatedUser = { ...mockUser, tier };
        mockUserRepo.updateUserTier.mockResolvedValue(updatedUser);
        mockQuotaRepo.getPurchaseHistory.mockResolvedValue({
          purchases: [],
          total: 0,
        });
        mockUserRepo.getUserById.mockResolvedValue(updatedUser);

        const result = await adminService.changeTier('user-123', tier);
        expect(result.profile.tier).toBe(tier);
      }
    });
  });

  describe('getUserDetails', () => {
    it('should return user details with purchase history', async () => {
      const mockPurchases = [
        {
          id: 'purchase-1',
          userId: 'user-123',
          tokensAdded: 50_000,
          purchaseType: 'registration' as const,
          amountPaid: null,
          currency: 'USD',
          description: 'Welcome bonus',
          createdAt: '2025-01-25T00:00:00Z',
        },
      ];

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockQuotaRepo.getPurchaseHistory.mockResolvedValue({
        purchases: mockPurchases,
        total: 1,
      });

      const result = await adminService.getUserDetails('user-123');

      expect(result.profile).toEqual(mockUser);
      expect(result.recentPurchases).toEqual(mockPurchases);
      expect(mockQuotaRepo.getPurchaseHistory).toHaveBeenCalledWith('user-123', 10);
    });

    it('should throw AdminServiceError when user not found', async () => {
      mockUserRepo.getUserById.mockRejectedValue(
        new Error('User not found')
      );

      await expect(adminService.getUserDetails('nonexistent')).rejects.toThrow(
        AdminServiceError
      );
      await expect(adminService.getUserDetails('nonexistent')).rejects.toThrow(
        'Failed to get user details'
      );
    });
  });

  describe('blockUser', () => {
    it('should block user successfully', async () => {
      const blockedUser = { ...mockUser, isActive: false };
      mockUserRepo.updateUserStatus.mockResolvedValue(blockedUser);
      mockQuotaRepo.getPurchaseHistory.mockResolvedValue({
        purchases: [],
        total: 0,
      });
      mockUserRepo.getUserById.mockResolvedValue(blockedUser);

      const result = await adminService.blockUser('user-123');

      expect(result.profile.isActive).toBe(false);
      expect(mockUserRepo.updateUserStatus).toHaveBeenCalledWith('user-123', false);
    });

    it('should throw AdminServiceError on database error', async () => {
      mockUserRepo.updateUserStatus.mockRejectedValue(
        new Error('Database error')
      );

      await expect(adminService.blockUser('user-123')).rejects.toThrow(
        AdminServiceError
      );
      await expect(adminService.blockUser('user-123')).rejects.toThrow(
        'Failed to block user'
      );
    });
  });

  describe('unblockUser', () => {
    it('should unblock user successfully', async () => {
      const unblockedUser = { ...mockUser, isActive: true };
      mockUserRepo.updateUserStatus.mockResolvedValue(unblockedUser);
      mockQuotaRepo.getPurchaseHistory.mockResolvedValue({
        purchases: [],
        total: 0,
      });
      mockUserRepo.getUserById.mockResolvedValue(unblockedUser);

      const result = await adminService.unblockUser('user-123');

      expect(result.profile.isActive).toBe(true);
      expect(mockUserRepo.updateUserStatus).toHaveBeenCalledWith('user-123', true);
    });

    it('should throw AdminServiceError on database error', async () => {
      mockUserRepo.updateUserStatus.mockRejectedValue(
        new Error('Database error')
      );

      await expect(adminService.unblockUser('user-123')).rejects.toThrow(
        AdminServiceError
      );
      await expect(adminService.unblockUser('user-123')).rejects.toThrow(
        'Failed to unblock user'
      );
    });
  });

  describe('listUsers', () => {
    it('should list users with default pagination', async () => {
      const mockUsers = {
        users: [mockUser],
        total: 1,
        limit: 50,
        offset: 0,
      };

      mockUserRepo.listUsers.mockResolvedValue(mockUsers);

      const result = await adminService.listUsers();

      expect(result).toEqual(mockUsers);
      expect(mockUserRepo.listUsers).toHaveBeenCalledWith(50, 0);
    });

    it('should list users with custom pagination', async () => {
      const mockUsers = {
        users: [mockUser],
        total: 100,
        limit: 20,
        offset: 40,
      };

      mockUserRepo.listUsers.mockResolvedValue(mockUsers);

      const result = await adminService.listUsers(20, 40);

      expect(result).toEqual(mockUsers);
      expect(mockUserRepo.listUsers).toHaveBeenCalledWith(20, 40);
    });

    it('should throw AdminServiceError when limit is too small', async () => {
      await expect(adminService.listUsers(0, 0)).rejects.toThrow(
        AdminServiceError
      );
      await expect(adminService.listUsers(0, 0)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should throw AdminServiceError when limit is too large', async () => {
      await expect(adminService.listUsers(101, 0)).rejects.toThrow(
        AdminServiceError
      );
      await expect(adminService.listUsers(101, 0)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should throw AdminServiceError when offset is negative', async () => {
      await expect(adminService.listUsers(50, -1)).rejects.toThrow(
        AdminServiceError
      );
      await expect(adminService.listUsers(50, -1)).rejects.toThrow(
        'Offset must be non-negative'
      );
    });
  });

  describe('bootstrapUsers', () => {
    it('should create all bootstrap users successfully', async () => {
      // Mock: No existing users
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      // Mock: createUser calls (6 users)
      for (let i = 0; i < 6; i++) {
        mockSupabaseClient.auth.admin.createUser.mockResolvedValueOnce({
          data: { user: { id: `user-${i}`, email: `user${i}@example.com` } },
          error: null,
        });
      }

      // Mock: database updates (chained eq() calls)
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      });

      const result = await adminService.bootstrapUsers();

      expect(result.success).toBe(true);
      expect(result.usersCreated).toBe(6);
      expect(result.usersSkipped).toBe(0);
      expect(result.users).toHaveLength(6);
      expect(result.users).toContain('admin@textenhancer.dev');
      expect(result.users).toContain('free@textenhancer.dev');
      expect(result.users).toContain('plus@textenhancer.dev');
      expect(result.users).toContain('premium@textenhancer.dev');
      expect(result.users).toContain('zero@textenhancer.dev');
      expect(result.users).toContain('blocked@textenhancer.dev');
    });

    it('should skip existing users (idempotent)', async () => {
      // Mock: All users already exist
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [
            { email: 'admin@textenhancer.dev' },
            { email: 'free@textenhancer.dev' },
            { email: 'plus@textenhancer.dev' },
            { email: 'premium@textenhancer.dev' },
            { email: 'zero@textenhancer.dev' },
            { email: 'blocked@textenhancer.dev' },
          ],
        },
        error: null,
      });

      const result = await adminService.bootstrapUsers();

      expect(result.success).toBe(true);
      expect(result.usersCreated).toBe(0);
      expect(result.usersSkipped).toBe(6);
      expect(result.users).toHaveLength(0);
      expect(mockSupabaseClient.auth.admin.createUser).not.toHaveBeenCalled();
    });

    it('should partially skip users and create new ones', async () => {
      // Mock: 3 users already exist
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [
            { email: 'admin@textenhancer.dev' },
            { email: 'free@textenhancer.dev' },
            { email: 'plus@textenhancer.dev' },
          ],
        },
        error: null,
      });

      // Mock: createUser calls for remaining 3 users
      for (let i = 0; i < 3; i++) {
        mockSupabaseClient.auth.admin.createUser.mockResolvedValueOnce({
          data: { user: { id: `user-${i}`, email: `newuser${i}@example.com` } },
          error: null,
        });
      }

      // Mock: database updates (chained eq() calls)
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      });

      const result = await adminService.bootstrapUsers();

      expect(result.success).toBe(true);
      expect(result.usersCreated).toBe(3);
      expect(result.usersSkipped).toBe(3);
      expect(result.users).toHaveLength(3);
      expect(mockSupabaseClient.auth.admin.createUser).toHaveBeenCalledTimes(3);
    });

    it('should throw AdminServiceError when user creation fails', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Email already exists' },
      });

      await expect(adminService.bootstrapUsers()).rejects.toThrow(
        AdminServiceError
      );
      await expect(adminService.bootstrapUsers()).rejects.toThrow(
        'Failed to bootstrap users'
      );
    });

    it('should continue on purchase update error but not fail', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Mock successful profile/quota updates but failed purchase update
      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount <= 12) {
          // First 12 calls (2 per user x 6 users) succeed
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
              }),
            }),
          };
        } else {
          // Purchase updates fail
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Update failed' },
                }),
              }),
            }),
          };
        }
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await adminService.bootstrapUsers();

      expect(result.success).toBe(true);
      expect(result.usersCreated).toBe(6);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});
