/**
 * Unit Tests for QuotaRepository
 * Tests database operations for token quota management
 */

import {
  QuotaRepository,
  QuotaRepositoryError,
  InsufficientQuotaError,
} from '../../../src/repositories/quota.repository.ts';
import type { UserQuota, TokenPurchase } from '../../../src/repositories/quota.repository.ts';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

describe('QuotaRepository', () => {
  let quotaRepository: QuotaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockSupabaseClient methods
    mockSupabaseClient.from.mockReset();
    mockSupabaseClient.rpc.mockReset();
    quotaRepository = new QuotaRepository(mockSupabaseClient as any);
  });

  describe('getQuota', () => {
    it('should fetch user quota successfully', async () => {
      const mockData = {
        user_id: 'user-123',
        tokens_available: 500_000,
        tokens_used: 100_000,
        last_used_at: '2025-01-25T10:00:00Z',
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await quotaRepository.getQuota('user-123');

      expect(result).toEqual({
        userId: 'user-123',
        tokensAvailable: 500_000,
        tokensUsed: 100_000,
        lastUsedAt: '2025-01-25T10:00:00Z',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_quotas');
    });

    it('should throw QuotaRepositoryError when quota not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(quotaRepository.getQuota('nonexistent')).rejects.toThrow(
        QuotaRepositoryError
      );
      await expect(quotaRepository.getQuota('nonexistent')).rejects.toThrow(
        'Quota not found for user'
      );
    });

    it('should throw QuotaRepositoryError on database error', async () => {
      const mockError = { message: 'Database connection failed', code: 'DB_ERROR' };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      });

      await expect(quotaRepository.getQuota('user-123')).rejects.toThrow(
        QuotaRepositoryError
      );
      await expect(quotaRepository.getQuota('user-123')).rejects.toThrow(
        'Failed to fetch quota'
      );
    });
  });

  describe('checkBalance', () => {
    it('should return true when user has sufficient balance', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      const result = await quotaRepository.checkBalance('user-123', 1000);

      expect(result).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('check_user_quota', {
        p_user_id: 'user-123',
        p_tokens_required: 1000,
      });
    });

    it('should return false when user has insufficient balance', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: false, error: null });

      const result = await quotaRepository.checkBalance('user-123', 1_000_000);

      expect(result).toBe(false);
    });

    it('should throw QuotaRepositoryError on database error', async () => {
      const mockError = { message: 'RPC function failed', code: 'RPC_ERROR' };

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: mockError });

      await expect(quotaRepository.checkBalance('user-123', 1000)).rejects.toThrow(
        QuotaRepositoryError
      );
      await expect(quotaRepository.checkBalance('user-123', 1000)).rejects.toThrow(
        'Failed to check quota'
      );
    });
  });

  describe('deductTokens', () => {
    it('should deduct tokens successfully', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      const result = await quotaRepository.deductTokens('user-123', 2000);

      expect(result).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('deduct_tokens', {
        p_user_id: 'user-123',
        p_tokens_used: 2000,
      });
    });

    it('should throw InsufficientQuotaError when balance insufficient', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: false, error: null });

      // Mock getQuota call for error details
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                user_id: 'user-123',
                tokens_available: 500,
                tokens_used: 100_000,
                last_used_at: null,
              },
              error: null,
            }),
          }),
        }),
      });

      await expect(quotaRepository.deductTokens('user-123', 1000)).rejects.toThrow(
        InsufficientQuotaError
      );

      try {
        await quotaRepository.deductTokens('user-123', 1000);
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientQuotaError);
        const quotaError = error as InsufficientQuotaError;
        expect(quotaError.tokensRequired).toBe(1000);
        expect(quotaError.tokensAvailable).toBe(500);
      }
    });

    it('should throw QuotaRepositoryError when user not found', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: false, error: null });

      // Mock getQuota to return null (user not found)
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(quotaRepository.deductTokens('nonexistent', 1000)).rejects.toThrow(
        QuotaRepositoryError
      );
      await expect(quotaRepository.deductTokens('nonexistent', 1000)).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw QuotaRepositoryError on RPC error', async () => {
      const mockError = { message: 'RPC function failed', code: 'RPC_ERROR' };

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: mockError });

      await expect(quotaRepository.deductTokens('user-123', 1000)).rejects.toThrow(
        QuotaRepositoryError
      );
      await expect(quotaRepository.deductTokens('user-123', 1000)).rejects.toThrow(
        'Failed to deduct tokens'
      );
    });
  });

  describe('addTokens', () => {
    it('should add tokens successfully with admin grant', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      const result = await quotaRepository.addTokens(
        'user-123',
        100_000,
        'admin_grant',
        'Bonus tokens from admin',
        undefined,
        'USD'
      );

      expect(result).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_tokens', {
        p_user_id: 'user-123',
        p_tokens_added: 100_000,
        p_purchase_type: 'admin_grant',
        p_description: 'Bonus tokens from admin',
        p_amount_paid: null,
        p_currency: 'USD',
      });
    });

    it('should add tokens with purchase type', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      const result = await quotaRepository.addTokens(
        'user-456',
        500_000,
        'purchase',
        'Purchased 500k tokens',
        9.99,
        'USD'
      );

      expect(result).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_tokens', {
        p_user_id: 'user-456',
        p_tokens_added: 500_000,
        p_purchase_type: 'purchase',
        p_description: 'Purchased 500k tokens',
        p_amount_paid: 9.99,
        p_currency: 'USD',
      });
    });

    it('should handle registration bonus', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      const result = await quotaRepository.addTokens(
        'user-new',
        50_000,
        'registration',
        'Welcome bonus',
        undefined,
        'USD'
      );

      expect(result).toBe(true);
    });

    it('should throw QuotaRepositoryError when user not found', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: false, error: null });

      await expect(
        quotaRepository.addTokens('nonexistent', 100_000, 'admin_grant')
      ).rejects.toThrow(QuotaRepositoryError);
      await expect(
        quotaRepository.addTokens('nonexistent', 100_000, 'admin_grant')
      ).rejects.toThrow('User not found');
    });

    it('should throw QuotaRepositoryError on RPC error', async () => {
      const mockError = { message: 'RPC function failed', code: 'RPC_ERROR' };

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: mockError });

      await expect(
        quotaRepository.addTokens('user-123', 100_000, 'admin_grant')
      ).rejects.toThrow(QuotaRepositoryError);
      await expect(
        quotaRepository.addTokens('user-123', 100_000, 'admin_grant')
      ).rejects.toThrow('Failed to add tokens');
    });
  });

  describe('getPurchaseHistory', () => {
    it('should fetch purchase history successfully', async () => {
      const mockPurchases = [
        {
          id: 'purchase-1',
          user_id: 'user-123',
          tokens_added: 50_000,
          purchase_type: 'registration',
          amount_paid: null,
          currency: 'USD',
          description: 'Welcome bonus',
          created_at: '2025-01-25T00:00:00Z',
        },
        {
          id: 'purchase-2',
          user_id: 'user-123',
          tokens_added: 500_000,
          purchase_type: 'purchase',
          amount_paid: 9.99,
          currency: 'USD',
          description: 'Purchased 500k tokens',
          created_at: '2025-01-25T10:00:00Z',
        },
      ];

      // Mock count query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
        }),
      });

      // Mock data query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: mockPurchases, error: null }),
            }),
          }),
        }),
      });

      const result = await quotaRepository.getPurchaseHistory('user-123', 10);

      expect(result.purchases).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.purchases[0].purchaseType).toBe('registration');
      expect(result.purchases[1].purchaseType).toBe('purchase');
      expect(result.purchases[1].amountPaid).toBe(9.99);
    });

    it('should handle empty purchase history', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const result = await quotaRepository.getPurchaseHistory('user-new', 50);

      expect(result.purchases).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should use default limit of 50', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      await quotaRepository.getPurchaseHistory('user-123');

      // The limit should be 50 by default
      const mockLimit = mockSupabaseClient.from.mock.results[1].value
        .select()
        .eq()
        .order()
        .limit;

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('should throw QuotaRepositoryError on count error', async () => {
      const mockError = { message: 'Database error', code: 'DB_ERROR' };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ count: null, error: mockError }),
      });

      await expect(
        quotaRepository.getPurchaseHistory('user-123', 50)
      ).rejects.toThrow(QuotaRepositoryError);
    });

    it('should throw QuotaRepositoryError on data fetch error', async () => {
      const mockError = { message: 'Database error', code: 'DB_ERROR' };

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 5, error: null }),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: null, error: mockError }),
            }),
          }),
        }),
      });

      await expect(
        quotaRepository.getPurchaseHistory('user-123', 50)
      ).rejects.toThrow(QuotaRepositoryError);
    });
  });

});
