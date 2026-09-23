/**
 * Unit tests for BatchOrchestrator
 * 
 * Tests batch request orchestration including:
 * - Validation (empty, size limits, duplicate IDs)
 * - Parallel processing
 * - Timeout enforcement
 * - Partial failures
 * - Token management
 */

import { BatchOrchestrator } from '../../../src/services/batch-orchestrator.ts';
import { QuotaService } from '../../../src/services/quota-service.ts';
import { AuthorizationService } from '../../../src/services/authorization-service.ts';
import { InvalidRequestError } from '../../../src/errors/orchestration-errors.ts';
import { LLMTimeoutError } from '../../../src/errors/llm-errors.ts';
import type { UserProfile } from '../../../src/types/auth.types.ts';
import type { BatchRequest, AssistantConfiguration } from '../../../src/types/api.types.ts';
import type { LLMProviderConfig } from '../../../src/types/config.types.ts';

// Mock dependencies
jest.mock('../../../src/services/quota-service.ts');
jest.mock('../../../src/services/authorization-service.ts');
jest.mock('../../../src/connectors/llm-connectors/factory.ts');
jest.mock('../../../src/config/models.config.ts');
jest.mock('../../../src/config/roles.config.ts');

describe('BatchOrchestrator', () => {
  let orchestrator: BatchOrchestrator;
  let quotaService: jest.Mocked<QuotaService>;
  let authzService: jest.Mocked<AuthorizationService>;
  let user: UserProfile;
  let providers: LLMProviderConfig[];
  let sendRequest: jest.Mock;

  beforeEach(() => {
    // Create mock services
    quotaService = new QuotaService({} as any) as jest.Mocked<QuotaService>;
    authzService = new AuthorizationService() as jest.Mocked<AuthorizationService>;

    // Mock quota service methods
    quotaService.requireQuota = jest.fn();
    quotaService.reportUsage = jest.fn().mockResolvedValue({
      success: true,
      remainingTokens: 5000,
      dailyLimit: 10000
    });

    // Mock authorization service methods
    authzService.requireModelAccess = jest.fn();

    // Setup test user
    user = {
      userId: 'user-123',
      email: 'test@example.com',
      tier: 'premium',
      isAdmin: false,
      isActive: true,
      tokensAvailable: 8000,
      tokensUsed: 2000,
      authProvider: 'email',
    };

    // Setup mock providers
    providers = [
      {
        name: 'gemini',
        apiKey: 'test-key',
        models: []
      }
    ];

    // Mock config getters
    const { getModelById } = require('../../../src/config/models.config.ts');
    const { getRoleById } = require('../../../src/config/roles.config.ts');

    getModelById.mockImplementation((id: string) => {
      if (id === 'open-router-free') {
        return {
          id: 'open-router-free',
          provider: 'gemini',
          providerModelId: 'gemini-2.5-flash',
          tier: 'plus',
          displayName: 'Gemini 2.5 Flash',
          contextWindow: 1000000,
          costPer1kTokens: { input: 0, output: 0 }
        };
      }
      return null;
    });

    getRoleById.mockImplementation((id: string) => {
      if (id === 'grammar-corrector') {
        return {
          id: 'grammar-corrector',
          name: 'Grammar Corrector',
          systemPrompt: 'You are a grammar correction expert.',
          allowedModels: ['open-router-free']
        };
      }
      return null;
    });

    // Mock LLM connector factory
    const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');
    
    sendRequest = jest.fn().mockResolvedValue({
      text: '{"text": "Enhanced text"}',
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30
      },
      model: 'open-router-free',
      provider: 'gemini'
    });
    const mockConnector = {
      name: 'gemini',
      supportsStreaming: false,
      sendRequest,
    };

    LLMConnectorFactory.createAll = jest.fn().mockReturnValue(
      new Map([['gemini', mockConnector]])
    );

    LLMConnectorFactory.getConnector = jest.fn().mockReturnValue(mockConnector);

    // Create orchestrator with short timeout for tests (exposeErrorDetails = false by default)
    orchestrator = new BatchOrchestrator(
      providers,
      quotaService,
      authzService,
      30000, // 30 second timeout
      false  // exposeErrorDetails
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    it('forwards GPT-5 Nano flex tier to its connector', async () => {
      const { getModelById } = require('../../../src/config/models.config.ts');
      const { getRoleById } = require('../../../src/config/roles.config.ts');
      getModelById.mockReturnValue({
        id: 'openai-gpt-5-nano',
        provider: 'openrouter',
        providerModelId: 'openai/gpt-5-nano',
        structuredOutputMode: 'json-schema',
        serviceTier: 'flex',
        displayName: 'GPT-5 Nano',
        contextWindow: 400000,
        costPer1kTokens: { input: 0, output: 0 },
      });
      getRoleById.mockReturnValue({
        id: 'grammar-corrector',
        name: 'Grammar Corrector',
        systemPrompt: 'You are a grammar correction expert.',
        allowedModels: ['openai-gpt-5-nano'],
      });

      await orchestrator.processBatch(user, {
        assistants: [{
          id: 'gpt',
          model: 'openai-gpt-5-nano',
          aiRoleId: 'grammar-corrector',
          userText: 'test',
          options: { improve: true },
        }],
      });

      expect(sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        model: 'openai/gpt-5-nano',
        serviceTier: 'flex',
      }));
    });

    it('should reject empty batch', async () => {
      const request: BatchRequest = {
        assistants: []
      };

      await expect(
        orchestrator.processBatch(user, request)
      ).rejects.toThrow(InvalidRequestError);
    });

    it('should return partial success when batch size exceeds tier limit', async () => {
      const request: BatchRequest = {
        assistants: Array(11).fill(null).map((_, i) => ({
          id: `test-${i}`,
          model: 'open-router-free',
          aiRoleId: 'grammar-corrector',
          userText: 'test',
          options: { improve: true }
        }))
      };

      // Premium tier has max 10 assistants
      const response = await orchestrator.processBatch(user, request);
      
      // Should return 11 results total
      expect(response.results).toHaveLength(11);
      
      // First 10 should be processed successfully
      for (let i = 0; i < 10; i++) {
        expect(response.results[i].id).toBe(`test-${i}`);
        expect(response.results[i].status).toBe('success');
      }
      
      // 11th should have error
      const lastResult = response.results[10];
      expect(lastResult.id).toBe('test-10');
      expect(lastResult.status).toBe('error');
      if (lastResult.status === 'error') {
        expect(lastResult.error.code).toBe('TIER_BATCH_SIZE_EXCEEDED');
      }
    });

    it('should reject duplicate task IDs', async () => {
      const request: BatchRequest = {
        assistants: [
          {
            id: 'duplicate',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test 1',
            options: { improve: true }
          },
          {
            id: 'duplicate',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test 2',
            options: { improve: true }
          }
        ]
      };

      await expect(
        orchestrator.processBatch(user, request)
      ).rejects.toThrow(InvalidRequestError);
    });

    it('should accept valid batch (1-10 assistants)', async () => {
      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test text',
            options: { improve: true }
          }
        ]
      };

      const response = await orchestrator.processBatch(user, request);
      
      expect(response.results).toHaveLength(1);
      expect(response.results[0].id).toBe('test-1');
      expect(response.results[0].status).toBe('success');
    });

    it('should handle free tier batch limit with partial success (max 6)', async () => {
      const freeUser: UserProfile = {
        ...user,
        tier: 'free'
      };

      const request: BatchRequest = {
        assistants: Array(8).fill(null).map((_, i) => ({
          id: `task-${i}`,
          model: 'open-router-free',
          aiRoleId: 'grammar-corrector',
          userText: 'test',
          options: { improve: true }
        }))
      };

      // Free tier has max 6 assistants
      const response = await orchestrator.processBatch(freeUser, request);
      
      // Should return 8 results total
      expect(response.results).toHaveLength(8);
      
      // First 6 should be processed successfully
      for (let i = 0; i < 6; i++) {
        expect(response.results[i].id).toBe(`task-${i}`);
        expect(response.results[i].status).toBe('success');
      }
      
      // Last 2 should have TIER_BATCH_SIZE_EXCEEDED error
      for (let i = 6; i < 8; i++) {
        const result = response.results[i];
        expect(result.id).toBe(`task-${i}`);
        expect(result.status).toBe('error');
        if (result.status === 'error') {
          expect(result.error.code).toBe('TIER_BATCH_SIZE_EXCEEDED');
        }
      }
    });

    it('should process all assistants when within tier limit', async () => {
      const freeUser: UserProfile = {
        ...user,
        tier: 'free'
      };

      const request: BatchRequest = {
        assistants: [
          { id: 'a', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 'test 1', options: { improve: true } },
          { id: 'b', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 'test 2', options: { improve: true } },
          { id: 'c', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 'test 3', options: { improve: true } },
          { id: 'd', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 'test 4', options: { improve: true } },
          { id: 'e', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 'test 5', options: { improve: true } },
          { id: 'f', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 'test 6', options: { improve: true } }
        ]
      };

      // Free tier allows exactly 6 assistants
      const response = await orchestrator.processBatch(freeUser, request);
      
      expect(response.results).toHaveLength(6);
      expect(response.results.every(r => r.status === 'success')).toBe(true);
    });
  });

  describe('Model Access Validation', () => {
    it('should validate model access for all assistants', async () => {
      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test',
            options: { improve: true }
          }
        ]
      };

      await orchestrator.processBatch(user, request);

      expect(authzService.requireModelAccess).toHaveBeenCalledWith(
        user,
        'open-router-free'
      );
    });

    it('should reject unknown model', async () => {
      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'unknown-model',
            aiRoleId: 'grammar-corrector',
            userText: 'test',
            options: { improve: true }
          }
        ]
      };

      await expect(
        orchestrator.processBatch(user, request)
      ).rejects.toThrow('model is not supported');
    });
  });

  describe('Parallel Processing', () => {
    it('should process all assistants concurrently', async () => {
      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'text 1',
            options: { improve: true }
          },
          {
            id: 'test-2',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'text 2',
            options: { improve: true }
          },
          {
            id: 'test-3',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'text 3',
            options: { improve: true }
          }
        ]
      };

      const response = await orchestrator.processBatch(user, request);

      expect(response.results).toHaveLength(3);
      expect(response.results[0].id).toBe('test-1');
      expect(response.results[1].id).toBe('test-2');
      expect(response.results[2].id).toBe('test-3');
    });

    it('should maintain result order matching input order', async () => {
      const request: BatchRequest = {
        assistants: [
          { id: 'a', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't1', options: {} },
          { id: 'b', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't2', options: {} },
          { id: 'c', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't3', options: {} }
        ]
      };

      const response = await orchestrator.processBatch(user, request);

      expect(response.results.map(r => r.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Partial Failures', () => {
    it('should handle partial failures gracefully', async () => {
      // Mock connector to fail on second call
      const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');
      
      let callCount = 0;
      const mockConnector = {
        name: 'gemini',
        supportsStreaming: false,
        sendRequest: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.reject(new Error('API Error'));
          }
          return Promise.resolve({
            text: '{"text": "Enhanced"}',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            model: 'open-router-free',
            provider: 'gemini'
          });
        })
      };

      LLMConnectorFactory.getConnector = jest.fn().mockReturnValue(mockConnector);

      const request: BatchRequest = {
        assistants: [
          { id: 'test-1', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't1', options: {} },
          { id: 'test-2', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't2', options: {} },
          { id: 'test-3', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't3', options: {} }
        ]
      };

      const response = await orchestrator.processBatch(user, request);

      expect(response.results).toHaveLength(3);
      expect(response.results[0].status).toBe('success');
      expect(response.results[1].status).toBe('error');
      expect(response.results[2].status).toBe('success');
    });

    it('should return all results even if some fail', async () => {
      // Mock to fail all requests
      const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');
      
      const mockConnector = {
        name: 'gemini',
        supportsStreaming: false,
        sendRequest: jest.fn().mockRejectedValue(new Error('All failed'))
      };

      LLMConnectorFactory.getConnector = jest.fn().mockReturnValue(mockConnector);

      const request: BatchRequest = {
        assistants: [
          { id: 'test-1', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't', options: {} },
          { id: 'test-2', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't', options: {} }
        ]
      };

      const response = await orchestrator.processBatch(user, request);

      expect(response.results).toHaveLength(2);
      expect(response.results[0].status).toBe('error');
      expect(response.results[1].status).toBe('error');
    });
  });

  describe('Token Management', () => {
    it('should check quota before processing', async () => {
      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test text',
            options: { improve: true }
          }
        ]
      };

      await orchestrator.processBatch(user, request);

      expect(quotaService.requireQuota).toHaveBeenCalledWith(
        user,
        expect.any(Number)
      );
    });

    it('should report token usage after processing', async () => {
      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test',
            options: { improve: true }
          }
        ]
      };

      await orchestrator.processBatch(user, request);

      expect(quotaService.reportUsage).toHaveBeenCalledWith(
        user.userId,
        expect.any(Number),
        'batch',
        expect.any(String),
      );
    });

    it('should not fail if token reporting fails', async () => {
      quotaService.reportUsage = jest.fn().mockRejectedValue(
        new Error('Reporting failed')
      );

      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test',
            options: { improve: true }
          }
        ]
      };

      const response = await orchestrator.processBatch(user, request);

      // Should still return results
      expect(response.results).toHaveLength(1);
      expect(response.results[0].status).toBe('success');
    });

    it('should only report tokens for successful tasks', async () => {
      // Mock to fail first request, succeed second
      const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');
      
      let callCount = 0;
      const mockConnector = {
        name: 'gemini',
        supportsStreaming: false,
        sendRequest: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Failed'));
          }
          return Promise.resolve({
            text: '{"text": "Success"}',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            model: 'open-router-free',
            provider: 'gemini'
          });
        })
      };

      LLMConnectorFactory.getConnector = jest.fn().mockReturnValue(mockConnector);

      const request: BatchRequest = {
        assistants: [
          { id: 'fail', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't', options: {} },
          { id: 'success', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 't', options: {} }
        ]
      };

      await orchestrator.processBatch(user, request);

      // Should only report 30 tokens (from successful task)
      expect(quotaService.reportUsage).toHaveBeenCalledWith(
        user.userId,
        30,
        'batch',
        expect.any(String),
      );
    });
  });

  describe('Result Format', () => {
    it('should return success result with correct format', async () => {
      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test',
            options: { improve: true }
          }
        ]
      };

      const response = await orchestrator.processBatch(user, request);

      expect(response.results[0]).toMatchObject({
        id: 'test-1',
        status: 'success',
        enhancedText: expect.any(String),
        total_tokens: expect.any(Number)
      });
    });

    it('should return error result with correct format', async () => {
      const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');
      
      const mockConnector = {
        name: 'gemini',
        supportsStreaming: false,
        sendRequest: jest.fn().mockRejectedValue(new Error('Test error'))
      };

      LLMConnectorFactory.getConnector = jest.fn().mockReturnValue(mockConnector);

      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test',
            options: {}
          }
        ]
      };

      const response = await orchestrator.processBatch(user, request);

      expect(response.results[0]).toMatchObject({
        id: 'test-1',
        status: 'error',
        error: {
          code: expect.any(String)
        }
      });
    });

    it.each(['not json', '{"value":"missing text"}', '{"text":""}', '{"text":"ok","extra":true}'])('rejects malformed structured output', async (text) => {
      const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');
      LLMConnectorFactory.getConnector = jest.fn().mockReturnValue({
        sendRequest: jest.fn().mockResolvedValue({
          text,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          model: 'gemini-2.5-flash',
          provider: 'gemini',
        }),
      });

      const response = await orchestrator.processBatch(user, {
        assistants: [{ id: 'bad-json', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 'test', options: {} }],
      });

      expect(response.results[0]).toMatchObject({ status: 'error', error: { code: 'LLM_ERROR' } });
    });

    it('maps connector cancellation to TASK_TIMEOUT', async () => {
      const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');
      LLMConnectorFactory.getConnector = jest.fn().mockReturnValue({
        sendRequest: jest.fn().mockRejectedValue(new LLMTimeoutError('gemini', 30)),
      });

      const response = await orchestrator.processBatch(user, {
        assistants: [{ id: 'timeout', model: 'open-router-free', aiRoleId: 'grammar-corrector', userText: 'test', options: {} }],
      });

      expect(response.results[0]).toMatchObject({ status: 'error', error: { code: 'TASK_TIMEOUT' } });
    });
  });

  describe('Error Message Sanitization', () => {
    it('should NOT include error messages when exposeErrorDetails=false', async () => {
      const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');

      const mockConnector = {
        name: 'gemini',
        supportsStreaming: false,
        sendRequest: jest.fn().mockRejectedValue(new Error('Sensitive API error details'))
      };

      LLMConnectorFactory.getConnector = jest.fn().mockReturnValue(mockConnector);

      // Orchestrator created with exposeErrorDetails=false (default in beforeEach)
      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test',
            options: {}
          }
        ]
      };

      const response = await orchestrator.processBatch(user, request);

      expect(response.results[0].status).toBe('error');
      expect(response.results[0]).toHaveProperty('error');
      expect((response.results[0] as any).error).toHaveProperty('code');
      expect((response.results[0] as any).error.code).toBe('LLM_ERROR');
      // Should NOT have message field
      expect((response.results[0] as any).error).not.toHaveProperty('message');
    });

    it('should include error messages when exposeErrorDetails=true', async () => {
      const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');

      const mockConnector = {
        name: 'gemini',
        supportsStreaming: false,
        sendRequest: jest.fn().mockRejectedValue(new Error('Detailed API error'))
      };

      LLMConnectorFactory.getConnector = jest.fn().mockReturnValue(mockConnector);

      // Create new orchestrator with exposeErrorDetails=true
      const orchestratorWithDetails = new BatchOrchestrator(
        providers,
        quotaService,
        authzService,
        30000,
        true  // exposeErrorDetails = true
      );

      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test',
            options: {}
          }
        ]
      };

      const response = await orchestratorWithDetails.processBatch(user, request);

      expect(response.results[0].status).toBe('error');
      expect((response.results[0] as any).error).toHaveProperty('code', 'LLM_ERROR');
      // Should HAVE message field
      expect((response.results[0] as any).error).toHaveProperty('message');
      expect((response.results[0] as any).error.message).toBe('Detailed API error');
    });

    it('should log errors regardless of exposeErrorDetails setting', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { LLMConnectorFactory } = require('../../../src/connectors/llm-connectors/factory.ts');

      const mockConnector = {
        name: 'gemini',
        supportsStreaming: false,
        sendRequest: jest.fn().mockRejectedValue(new Error('Test error for logging'))
      };

      LLMConnectorFactory.getConnector = jest.fn().mockReturnValue(mockConnector);

      const request: BatchRequest = {
        assistants: [
          {
            id: 'test-1',
            model: 'open-router-free',
            aiRoleId: 'grammar-corrector',
            userText: 'test',
            options: {}
          }
        ]
      };

      await orchestrator.processBatch(user, request);

      // Should have logged error details
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
