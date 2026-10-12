/**
 * Unit Tests for PaymentRepository
 * Tests database operations for token quota management
 */

import { PaymentRepository } from '../../../src/payments/payment-repository.ts';
import {
  QuotaRepositoryError,
  InsufficientQuotaError,
} from '../../../src/repositories/quota.repository.ts';
import type { UserQuota, TokenPurchase } from '../../../src/repositories/quota.repository.ts';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

describe('PaymentRepository', () => {
  let quotaRepository: PaymentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockSupabaseClient methods
    mockSupabaseClient.from.mockReset();
    mockSupabaseClient.rpc.mockReset();
    quotaRepository = new PaymentRepository(mockSupabaseClient as any);
  });

  describe('isPurchaseProcessed', () => {
    it('should return true when purchase already processed', async () => {
      const mockPurchase = {
        id: 'purchase-123',
      };

      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({ data: mockPurchase, error: null });
      const mockLike = jest.fn().mockReturnValueOnce({
        maybeSingle: mockMaybeSingle,
      });
      const mockSelect = jest.fn().mockReturnValueOnce({
        like: mockLike,
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: mockSelect,
      });

      const result = await quotaRepository.isPurchaseProcessed('evt_test_123');

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('token_purchases');
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockLike).toHaveBeenCalledWith('description', '%Event: evt_test_123%');
    });

    it('should return false when purchase not processed', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          like: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await quotaRepository.isPurchaseProcessed('evt_test_new');

      expect(result).toBe(false);
    });

    it('should search for event ID in description', async () => {
      const mockLike = jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          like: mockLike,
        }),
      });

      await quotaRepository.isPurchaseProcessed('evt_abc123');

      expect(mockLike).toHaveBeenCalledWith('description', '%Event: evt_abc123%');
    });

    it('should throw QuotaRepositoryError on database error', async () => {
      const mockError = { message: 'Database error', code: 'DB_ERROR' };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          like: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      });

      await expect(
        quotaRepository.isPurchaseProcessed('evt_test_123')
      ).rejects.toThrow(QuotaRepositoryError);
      await expect(
        quotaRepository.isPurchaseProcessed('evt_test_123')
      ).rejects.toThrow('Failed to check if purchase processed');
    });
  });

  describe('getPurchaseByChargeId', () => {
    it('should return purchase record when found', async () => {
      const mockPurchase = {
        user_id: 'user-123',
        tokens_added: 500000,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          like: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockPurchase, error: null }),
          }),
        }),
      });

      const result = await quotaRepository.getPurchaseByChargeId('ch_test_123');

      expect(result).toEqual({
        user_id: 'user-123',
        tokens_added: 500000,
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('token_purchases');
    });

    it('should return null when purchase not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          like: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await quotaRepository.getPurchaseByChargeId('ch_unknown');

      expect(result).toBeNull();
    });

    it('should search for charge ID in description', async () => {
      const mockLike = jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          like: mockLike,
        }),
      });

      await quotaRepository.getPurchaseByChargeId('ch_abc123');

      expect(mockLike).toHaveBeenCalledWith('description', '%charge ch_abc123%');
    });

    it('should throw QuotaRepositoryError on database error', async () => {
      const mockError = { message: 'Database error', code: 'DB_ERROR' };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          like: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      });

      await expect(
        quotaRepository.getPurchaseByChargeId('ch_test_123')
      ).rejects.toThrow(QuotaRepositoryError);
      await expect(
        quotaRepository.getPurchaseByChargeId('ch_test_123')
      ).rejects.toThrow('Failed to get purchase by charge ID');
    });
  });

  describe('deductTokensForRefund', () => {
    it('should deduct tokens by calling addTokens with negative value', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      const result = await quotaRepository.deductTokensForRefund(
        'user-123',
        100000,
        'Refund for charge ch_123'
      );

      expect(result).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_tokens', {
        p_user_id: 'user-123',
        p_tokens_added: -100000,
        p_purchase_type: 'refund',
        p_description: 'Refund for charge ch_123',
        p_amount_paid: null,
        p_currency: 'USD',
      });
    });

    it('should handle different token amounts', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      await quotaRepository.deductTokensForRefund(
        'user-456',
        250000,
        'Partial refund'
      );

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_tokens', {
        p_user_id: 'user-456',
        p_tokens_added: -250000,
        p_purchase_type: 'refund',
        p_description: 'Partial refund',
        p_amount_paid: null,
        p_currency: 'USD',
      });
    });

    it('should work without description', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      await quotaRepository.deductTokensForRefund('user-789', 50000);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_tokens', {
        p_user_id: 'user-789',
        p_tokens_added: -50000,
        p_purchase_type: 'refund',
        p_description: null,
        p_amount_paid: null,
        p_currency: 'USD',
      });
    });

    it('should throw QuotaRepositoryError when user not found', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: false, error: null });

      await expect(
        quotaRepository.deductTokensForRefund('nonexistent', 100000)
      ).rejects.toThrow(QuotaRepositoryError);
    });
  });

  describe('recordRefund', () => {
    it('should record refund with negative tokens and amount', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      const result = await quotaRepository.recordRefund(
        'user-123',
        100000,
        10.0,
        'USD',
        'Refund for charge ch_123, Event: evt_refund_123'
      );

      expect(result).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_tokens', {
        p_user_id: 'user-123',
        p_tokens_added: -100000,
        p_purchase_type: 'refund',
        p_description: 'Refund for charge ch_123, Event: evt_refund_123',
        p_amount_paid: -10.0,
        p_currency: 'USD',
      });
    });

    it('should handle full refund', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      await quotaRepository.recordRefund(
        'user-456',
        500000,
        20.0,
        'USD',
        'Full refund'
      );

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_tokens', {
        p_user_id: 'user-456',
        p_tokens_added: -500000,
        p_purchase_type: 'refund',
        p_description: 'Full refund',
        p_amount_paid: -20.0,
        p_currency: 'USD',
      });
    });

    it('should handle partial refund', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      await quotaRepository.recordRefund(
        'user-789',
        125000,
        5.0,
        'USD',
        'Partial refund (25%)'
      );

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_tokens', {
        p_user_id: 'user-789',
        p_tokens_added: -125000,
        p_purchase_type: 'refund',
        p_description: 'Partial refund (25%)',
        p_amount_paid: -5.0,
        p_currency: 'USD',
      });
    });

    it('should support different currencies', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null });

      await quotaRepository.recordRefund(
        'user-euro',
        100000,
        15.5,
        'EUR',
        'Refund in EUR'
      );

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_tokens', {
        p_user_id: 'user-euro',
        p_tokens_added: -100000,
        p_purchase_type: 'refund',
        p_description: 'Refund in EUR',
        p_amount_paid: -15.5,
        p_currency: 'EUR',
      });
    });

    it('should throw QuotaRepositoryError when user not found', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: false, error: null });

      await expect(
        quotaRepository.recordRefund(
          'nonexistent',
          100000,
          10.0,
          'USD',
          'Refund'
        )
      ).rejects.toThrow(QuotaRepositoryError);
    });
  });
});
