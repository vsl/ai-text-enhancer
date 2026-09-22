/**
 * Unit Tests for QuotaService
 * Tests token quota validation and database operations via QuotaRepository
 */

import { QuotaService } from '../../../src/services/quota-service.ts';
import { InsufficientQuotaError } from '../../../src/errors/quota-errors.ts';
import type { UserProfile } from '../../../src/types/auth.types.ts';
import { TestEnv } from '../helpers/test-env.ts';
import { InsufficientQuotaError as RepoInsufficientQuotaError } from '../../../src/repositories/quota.repository.ts';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

// Mock QuotaRepository
const mockQuotaRepository = {
  getQuota: jest.fn(),
  checkBalance: jest.fn(),
  deductTokens: jest.fn(),
  addTokens: jest.fn(),
  getPurchaseHistory: jest.fn(),
};

jest.mock('../../../src/repositories/quota.repository.ts', () => {
  return {
    QuotaRepository: jest.fn().mockImplementation(() => mockQuotaRepository),
    InsufficientQuotaError: class InsufficientQuotaError extends Error {
      constructor(public tokensRequired: number, public tokensAvailable: number) {
        super(`Insufficient quota. Required: ${tokensRequired}, Available: ${tokensAvailable}`);
        this.name = 'InsufficientQuotaError';
      }
    },
  };
});

describe('QuotaService', () => {
  let quotaService: QuotaService;
  let user: UserProfile;

  beforeAll(() => {
    TestEnv.setup();
  });

  afterAll(() => {
    TestEnv.teardown();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    quotaService = new QuotaService(mockSupabaseClient as any);

    user = {
      userId: 'user-123',
      email: 'test@example.com',
      tier: 'plus',
      isAdmin: false,
      isActive: true,
      tokensAvailable: 500_000,
      tokensUsed: 500_000,
      authProvider: 'email',
    };
  });

  describe('checkQuota', () => {
    it('should allow when sufficient quota', () => {
      const result = quotaService.checkQuota(user, 1000);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny when quota exhausted (zero balance)', () => {
      user.tokensAvailable = 0;

      const result = quotaService.checkQuota(user, 1000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exhausted');
    });

    it('should deny when insufficient quota', () => {
      const result = quotaService.checkQuota(user, 600_000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient');
      expect(result.reason).toContain('600000');
      expect(result.reason).toContain('500000');
    });

    it('should handle edge case with exactly matching quota', () => {
      user.tokensAvailable = 1000;

      const result = quotaService.checkQuota(user, 1000);

      expect(result.allowed).toBe(true);
    });

    it('should deny when requesting one token more than available', () => {
      user.tokensAvailable = 1000;

      const result = quotaService.checkQuota(user, 1001);

      expect(result.allowed).toBe(false);
    });
  });

  describe('requireQuota', () => {
    it('should not throw when sufficient quota', () => {
      expect(() => {
        quotaService.requireQuota(user, 1000);
      }).not.toThrow();
    });

    it('should throw InsufficientQuotaError when quota exhausted', () => {
      user.tokensAvailable = 0;

      expect(() => {
        quotaService.requireQuota(user, 1000);
      }).toThrow(InsufficientQuotaError);

      try {
        quotaService.requireQuota(user, 1000);
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientQuotaError);
        const quotaError = error as InsufficientQuotaError;
        expect(quotaError.required).toBe(1000);
        expect(quotaError.available).toBe(0);
        expect(quotaError.statusCode).toBe(429);
      }
    });

    it('should throw InsufficientQuotaError when not enough tokens', () => {
      expect(() => {
        quotaService.requireQuota(user, 600_000);
      }).toThrow(InsufficientQuotaError);

      try {
        quotaService.requireQuota(user, 600_000);
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientQuotaError);
        const quotaError = error as InsufficientQuotaError;
        expect(quotaError.required).toBe(600_000);
        expect(quotaError.available).toBe(500_000);
        expect(quotaError.statusCode).toBe(429);
      }
    });

    it('should use default value of 1 when no tokens specified', () => {
      expect(() => {
        quotaService.requireQuota(user);
      }).not.toThrow();
    });
  });

  describe('reportUsage', () => {
    it('should deduct tokens successfully via repository', async () => {
      mockQuotaRepository.deductTokens.mockResolvedValue(true);

      const result = await quotaService.reportUsage('user-123', 2000, 'open-router-free');

      expect(result).toBe(true);
      expect(mockQuotaRepository.deductTokens).toHaveBeenCalledWith('user-123', 2000);
    });

    it('should handle different token amounts', async () => {
      mockQuotaRepository.deductTokens.mockResolvedValue(true);

      const result1 = await quotaService.reportUsage('user-123', 5000, 'gpt-4');
      const result2 = await quotaService.reportUsage('user-456', 100, 'open-router-free');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockQuotaRepository.deductTokens).toHaveBeenCalledWith('user-123', 5000);
      expect(mockQuotaRepository.deductTokens).toHaveBeenCalledWith('user-456', 100);
    });

    it('should throw InsufficientQuotaError when repository throws InsufficientQuotaError', async () => {
      mockQuotaRepository.deductTokens.mockRejectedValue(
        new RepoInsufficientQuotaError(1000, 500)
      );

      await expect(
        quotaService.reportUsage('user-123', 1000, 'open-router-free')
      ).rejects.toThrow(InsufficientQuotaError);
    });

    it('should return false on other errors and log them', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockQuotaRepository.deductTokens.mockRejectedValue(new Error('Database error'));

      const result = await quotaService.reportUsage('user-123', 1000, 'open-router-free');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a test message'; // 22 chars
      const tokens = quotaService.estimateTokens(text);
      
      // 22 / 4 = 5.5, ceil to 6
      expect(tokens).toBe(6);
    });

    it('should handle empty text', () => {
      const tokens = quotaService.estimateTokens('');
      expect(tokens).toBe(0);
    });

    it('should handle longer text', () => {
      const text = 'a'.repeat(1000); // 1000 chars
      const tokens = quotaService.estimateTokens(text);
      
      // 1000 / 4 = 250
      expect(tokens).toBe(250);
    });

    it('should round up partial tokens', () => {
      const text = 'abc'; // 3 chars
      const tokens = quotaService.estimateTokens(text);
      
      // 3 / 4 = 0.75, ceil to 1
      expect(tokens).toBe(1);
    });
  });

  describe('estimateBatchTokens', () => {
    it('should estimate batch tokens correctly', () => {
      const texts = ['First text', 'Second text', 'Third text'];
      // Total: 10 + 11 + 10 = 31 chars
      const tokens = quotaService.estimateBatchTokens(texts);
      
      // 31 / 4 = 7.75, ceil to 8
      expect(tokens).toBe(8);
    });

    it('should handle empty array', () => {
      const tokens = quotaService.estimateBatchTokens([]);
      expect(tokens).toBe(0);
    });

    it('should handle array with empty strings', () => {
      const texts = ['', '', ''];
      const tokens = quotaService.estimateBatchTokens(texts);
      expect(tokens).toBe(0);
    });

    it('should handle mixed length texts', () => {
      const texts = ['a', 'ab', 'abc', 'abcd'];
      // Total: 1 + 2 + 3 + 4 = 10 chars
      const tokens = quotaService.estimateBatchTokens(texts);
      
      // 10 / 4 = 2.5, ceil to 3
      expect(tokens).toBe(3);
    });
  });
});
