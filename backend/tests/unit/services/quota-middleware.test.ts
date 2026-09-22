/**
 * Unit Tests for QuotaMiddleware
 * Tests high-level quota validation wrapper
 */

import { QuotaMiddleware } from '../../../src/services/quota-middleware.ts';
import { QuotaService } from '../../../src/services/quota-service.ts';
import { QuotaExceededError, InsufficientQuotaError } from '../../../src/errors/quota-errors.ts';
import type { UserProfile } from '../../../src/types/auth.types.ts';
import { TestEnv } from '../helpers/test-env.ts';

// Mock global fetch
global.fetch = jest.fn();

describe('QuotaMiddleware', () => {
  let quotaMiddleware: QuotaMiddleware;
  let mockRequireQuota: jest.SpyInstance;
  let mockReportUsage: jest.SpyInstance;
  let user: UserProfile;

  beforeAll(() => {
    TestEnv.setup();
  });

  afterAll(() => {
    TestEnv.teardown();
  });

  beforeEach(() => {
    // Mock Supabase client
    const mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

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

    // Create middleware and spy on its service methods
    quotaMiddleware = new QuotaMiddleware(mockSupabaseClient as any);
    const quotaService = quotaMiddleware.getService();

    mockRequireQuota = jest.spyOn(quotaService, 'requireQuota');
    mockReportUsage = jest.spyOn(quotaService, 'reportUsage');

    jest.clearAllMocks();
  });

  describe('preValidate', () => {
    it('should call requireQuota on service', async () => {
      mockRequireQuota.mockImplementation(() => {});

      await quotaMiddleware.preValidate(user, 1000);

      expect(mockRequireQuota).toHaveBeenCalledWith(user, 1000);
    });

    it('should propagate quota exceeded errors', async () => {
      mockRequireQuota.mockImplementation(() => {
        throw new QuotaExceededError(1_000_000, 1_000_000, '2024-01-16T00:00:00Z');
      });

      await expect(quotaMiddleware.preValidate(user, 1000))
        .rejects
        .toThrow(QuotaExceededError);
    });

    it('should propagate insufficient quota errors', async () => {
      mockRequireQuota.mockImplementation(() => {
        throw new InsufficientQuotaError(600_000, 500_000);
      });

      await expect(quotaMiddleware.preValidate(user, 600_000))
        .rejects
        .toThrow(InsufficientQuotaError);
    });
  });

  describe('postUpdate', () => {
    it('should call reportUsage on service', async () => {
      mockReportUsage.mockResolvedValue({
        success: true,
        remainingTokens: 498_000,
        dailyLimit: 1_000_000
      });

      await quotaMiddleware.postUpdate(user, 2000, 'open-router-free');

      expect(mockReportUsage).toHaveBeenCalledWith(
        'user-123',
        2000,
        'open-router-free'
      );
    });

    it('should handle reporting failures gracefully', async () => {
      mockReportUsage.mockResolvedValue({
        success: false,
        remainingTokens: 0,
        dailyLimit: 0
      });

      // Should not throw
      await expect(quotaMiddleware.postUpdate(user, 2000, 'open-router-free'))
        .resolves
        .toBeUndefined();
    });
  });

  describe('getService', () => {
    it('should return quota service instance', () => {
      const service = quotaMiddleware.getService();
      
      expect(service).toBeInstanceOf(QuotaService);
    });
  });
});
