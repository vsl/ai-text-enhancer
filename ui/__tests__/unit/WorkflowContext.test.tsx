// Mock AuthContext FIRST before any imports
// Create mocks that will be accessible in tests
const mockFunctions = {
  mockGetAuthToken: jest.fn().mockResolvedValue('anonymous'),
  mockUpdateTokenBalance: jest.fn(),
  mockResetSession: jest.fn(),
};

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: null,
    tierLimits: {
      maxTextLength: 500,
      maxContextLength: 800,
      maxBatchSize: 3,
      availableModels: ['open-router-free', 'open-router-free'],
    },
    getAuthToken: mockFunctions.mockGetAuthToken,
    resetSession: mockFunctions.mockResetSession,
    updateTokenBalance: mockFunctions.mockUpdateTokenBalance,
  }),
}));

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { WorkflowProvider, useWorkflow } from '@/context/WorkflowContext';
import { DEFAULT_WORKFLOWS, DEFAULT_OPTIONS, AVAILABLE_MODELS } from '@/lib/constants';
import { AiConfig } from '@/lib/types';

// Destructure mock functions for easier access
const { mockGetAuthToken, mockUpdateTokenBalance, mockResetSession } = mockFunctions;

// Wrapper component for testing
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkflowProvider>{children}</WorkflowProvider>
);

describe('WorkflowContext', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    // Reset mock implementations
    mockGetAuthToken.mockResolvedValue('anonymous');
    mockUpdateTokenBalance.mockClear();
    mockResetSession.mockClear();
  });

  describe('Provider initialization', () => {
    it('should initialize with default workflows', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(result.current.workflows).toEqual(DEFAULT_WORKFLOWS);
      expect(result.current.selectedWorkflow).toBe(DEFAULT_WORKFLOWS[0].name);
      expect(result.current.configs.length).toBeGreaterThan(0);
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useWorkflow());
      }).toThrow('useWorkflow must be used within a WorkflowProvider');

      consoleError.mockRestore();
    });

    it('should initialize with empty state for generation', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(result.current.results.size).toBe(0);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.inputText).toBe('');
      expect(result.current.contextText).toBe('');
    });
  });

  describe('Workflow CRUD operations', () => {
    describe('handleCreateWorkflow', () => {
      it('should create a new workflow', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const initialLength = result.current.workflows.length;

        act(() => {
          result.current.handleCreateWorkflow('Test Workflow');
        });

        expect(result.current.workflows).toHaveLength(initialLength + 1);
        expect(result.current.selectedWorkflow).toBe('Test Workflow');
        const newWorkflow = result.current.workflows.find(w => w.name === 'Test Workflow');
        expect(newWorkflow).toBeDefined();
        expect(newWorkflow?.configs).toHaveLength(1);
      });

      it('should initialize new workflow with default config', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });

        act(() => {
          result.current.handleCreateWorkflow('New Workflow');
        });

        const newWorkflow = result.current.workflows.find(w => w.name === 'New Workflow');
        expect(newWorkflow?.configs[0].model).toBe(AVAILABLE_MODELS[0]);
        expect(newWorkflow?.configs[0].aiRoleId).toBe('editor');
        expect(newWorkflow?.configs[0].enabled).toBe(true);
      });

      it('should automatically select newly created workflow', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });

        act(() => {
          result.current.handleCreateWorkflow('Auto Selected');
        });

        expect(result.current.selectedWorkflow).toBe('Auto Selected');
        expect(result.current.configs.length).toBeGreaterThan(0);
      });

      it('should clear results when creating new workflow', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });

        // Add a result
        act(() => {
          result.current.setInputText('test');
        });

        act(() => {
          result.current.handleCreateWorkflow('Clear Results Test');
        });

        expect(result.current.results.size).toBe(0);
      });
    });

    describe('handleLoadWorkflow', () => {
      it('should load an existing workflow', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const secondWorkflowName = DEFAULT_WORKFLOWS[1].name;

        act(() => {
          result.current.handleLoadWorkflow(secondWorkflowName);
        });

        expect(result.current.selectedWorkflow).toBe(secondWorkflowName);
        expect(result.current.configs).toEqual(DEFAULT_WORKFLOWS[1].configs);
      });

      it('should clear results when loading workflow', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });

        // Create a mock result
        act(() => {
          result.current.setInputText('test');
        });

        act(() => {
          result.current.handleLoadWorkflow(DEFAULT_WORKFLOWS[1].name);
        });

        expect(result.current.results.size).toBe(0);
      });

      it('should handle loading non-existent workflow gracefully', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });

        act(() => {
          result.current.handleLoadWorkflow('Non Existent Workflow');
        });

        // Should fall back to first workflow
        expect(result.current.selectedWorkflow).toBe(DEFAULT_WORKFLOWS[0].name);
      });
    });

    describe('handleDeleteWorkflow', () => {
      it('should delete a custom workflow', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });

        act(() => {
          result.current.handleCreateWorkflow('To Delete');
        });

        const workflowCount = result.current.workflows.length;

        act(() => {
          result.current.handleDeleteWorkflow('To Delete');
        });

        expect(result.current.workflows).toHaveLength(workflowCount - 1);
        expect(result.current.workflows.find(w => w.name === 'To Delete')).toBeUndefined();
      });

      it('should switch to first workflow when deleting active workflow', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });

        act(() => {
          result.current.handleCreateWorkflow('Active to Delete');
        });

        expect(result.current.selectedWorkflow).toBe('Active to Delete');

        act(() => {
          result.current.handleDeleteWorkflow('Active to Delete');
        });

        expect(result.current.selectedWorkflow).toBe(DEFAULT_WORKFLOWS[0].name);
      });

      it('should clear results when deleting workflow', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });

        act(() => {
          result.current.handleCreateWorkflow('Delete with Results');
        });

        act(() => {
          result.current.setInputText('test');
        });

        act(() => {
          result.current.handleDeleteWorkflow('Delete with Results');
        });

        expect(result.current.results.size).toBe(0);
      });
    });
  });

  describe('Config management', () => {
    describe('handleSaveConfig', () => {
      it('should add a new config', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const initialCount = result.current.configs.length;

        const newConfig: AiConfig = {
          id: Date.now(),
          model: 'open-router-free',
          aiRoleId: 'editor',
          options: { ...DEFAULT_OPTIONS },
          enabled: true,
        };

        act(() => {
          result.current.handleSaveConfig(newConfig);
        });

        expect(result.current.configs).toHaveLength(initialCount + 1);
      });

      it('should update an existing config', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const existingConfig = result.current.configs[0];
        const updatedConfig = {
          ...existingConfig,
          model: 'open-router-free',
        };

        act(() => {
          result.current.handleSaveConfig(updatedConfig);
        });

        const savedConfig = result.current.configs.find(c => c.id === existingConfig.id);
        expect(savedConfig?.model).toBe('open-router-free');
      });

      it('should persist config changes to workflow', async () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const currentWorkflowName = result.current.selectedWorkflow;
        const newConfig: AiConfig = {
          id: 999,
          model: 'open-router-free',
          aiRoleId: 'summarizer',
          options: { ...DEFAULT_OPTIONS },
          enabled: true,
        };

        act(() => {
          result.current.handleSaveConfig(newConfig);
        });

        // Wait for async updates
        await waitFor(() => {
          const workflow = result.current.workflows.find(w => w.name === currentWorkflowName);
          expect(workflow?.configs.find(c => c.id === 999)).toBeDefined();
          expect(result.current.configs.find(c => c.id === 999)).toBeDefined();
        });
      });

      it('keeps consecutive additions in the active workflow', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const first: AiConfig = { id: 999, model: 'open-router-free', aiRoleId: 'editor', options: { ...DEFAULT_OPTIONS }, enabled: true };
        const second: AiConfig = { ...first, id: 1000, aiRoleId: 'summarizer' };

        act(() => {
          result.current.handleSaveConfig(first);
          result.current.handleSaveConfig(second);
        });

        expect(result.current.configs.map(config => config.id)).toEqual([1, 2, 3, 999, 1000]);
        expect(result.current.workflows[0].configs.map(config => config.id)).toEqual([1, 2, 3, 999, 1000]);
      });
    });

    describe('handleRemoveConfig', () => {
      it('should remove a config', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const configToRemove = result.current.configs[0];
        const initialCount = result.current.configs.length;

        act(() => {
          result.current.handleRemoveConfig(configToRemove.id);
        });

        expect(result.current.configs).toHaveLength(initialCount - 1);
        expect(result.current.configs.find(c => c.id === configToRemove.id)).toBeUndefined();
      });

      it('should persist removal to workflow', async () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const configToRemove = result.current.configs[0];
        const currentWorkflowName = result.current.selectedWorkflow;

        act(() => {
          result.current.handleRemoveConfig(configToRemove.id);
        });

        await waitFor(() => {
          const workflow = result.current.workflows.find(w => w.name === currentWorkflowName);
          expect(workflow?.configs.find(c => c.id === configToRemove.id)).toBeUndefined();
        });
      });
    });

    describe('handleToggleAssistant', () => {
      it('should toggle assistant enabled state', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const config = result.current.configs[0];
        const initialEnabledState = config.enabled;

        act(() => {
          result.current.handleToggleAssistant(config.id);
        });

        const updatedConfig = result.current.configs.find(c => c.id === config.id);
        expect(updatedConfig?.enabled).toBe(!initialEnabledState);
      });

      it('should persist toggle to workflow', async () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const config = result.current.configs[0];
        const currentWorkflowName = result.current.selectedWorkflow;
        const initialState = config.enabled;

        act(() => {
          result.current.handleToggleAssistant(config.id);
        });

        await waitFor(() => {
          const workflow = result.current.workflows.find(w => w.name === currentWorkflowName);
          const savedConfig = workflow?.configs.find(c => c.id === config.id);
          expect(savedConfig?.enabled).toBe(!initialState);
        });
      });
    });

    describe('handleCopyConfig', () => {
      it('should create a copy of config', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });
        const originalConfig = result.current.configs[0];
        const initialCount = result.current.configs.length;

        act(() => {
          result.current.handleCopyConfig(originalConfig.id);
        });

        expect(result.current.configs).toHaveLength(initialCount + 1);

        // Find the copied config (should be right after the original)
        const originalIndex = result.current.configs.findIndex(c => c.id === originalConfig.id);
        const copiedConfig = result.current.configs[originalIndex + 1];

        expect(copiedConfig.model).toBe(originalConfig.model);
        expect(copiedConfig.aiRoleId).toBe(originalConfig.aiRoleId);
        expect(copiedConfig.id).not.toBe(originalConfig.id);
        expect(copiedConfig.enabled).toBe(true);
      });

      it('should place copied config after original', () => {
        const { result } = renderHook(() => useWorkflow(), { wrapper });

        // Add a second config to ensure we have multiple configs
        const newConfig: AiConfig = {
          id: 999,
          model: 'open-router-free',
          aiRoleId: 'summarizer',
          options: { ...DEFAULT_OPTIONS },
          enabled: true,
        };

        act(() => {
          result.current.handleSaveConfig(newConfig);
        });

        const originalConfig = result.current.configs.find(c => c.id === 999)!;
        const originalIndex = result.current.configs.findIndex(c => c.id === originalConfig.id);

        act(() => {
          result.current.handleCopyConfig(originalConfig.id);
        });

        const newIndex = result.current.configs.findIndex(c =>
          c.id !== originalConfig.id &&
          c.model === originalConfig.model &&
          c.aiRoleId === originalConfig.aiRoleId
        );

        expect(newIndex).toBe(originalIndex + 1);
      });
    });
  });

  describe('Text management', () => {
    it('should update input text', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      act(() => {
        result.current.setInputText('Hello World');
      });

      expect(result.current.inputText).toBe('Hello World');
    });

    it('should update context text', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      act(() => {
        result.current.setContextText('Context information');
      });

      expect(result.current.contextText).toBe('Context information');
    });
  });

  describe('Generation', () => {
    it('sends each assistant\'s AI-symbol setting in both states', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      act(() => result.current.setInputText('Test input'));
      await act(async () => result.current.handleGenerate());
      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).assistants[0].options.avoidCommonAiSymbols).toBe(true);

      act(() => result.current.handleSaveConfig({
        ...result.current.configs[0],
        options: { ...result.current.configs[0].options, avoidCommonAiSymbols: false },
      }));
      await act(async () => result.current.handleGenerate());
      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).assistants[0].options.avoidCommonAiSymbols).toBe(false);
    });

    it('should initialize generation state as false', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      expect(result.current.isGenerating).toBe(false);
    });

    it('should have generate and cancel handlers', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      expect(typeof result.current.handleGenerate).toBe('function');
      expect(typeof result.current.handleCancel).toBe('function');
    });

    it('stores Jev selection, clears it before the next run, and accepts older responses', async () => {
      let resolveSecond: ((value: unknown) => void) | undefined;
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ id: '1', status: 'success', enhancedText: 'First', total_tokens: 1 }],
            selection: {
              status: 'success', judge: 'jev', model: 'typesafe/jev-1.13',
              selectedResultId: '1', confidence: 1, probabilities: { '1': 1 },
            },
          }),
        })
        .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      act(() => result.current.setInputText('Test input'));

      await act(async () => result.current.handleGenerate());
      expect(result.current.selection?.status).toBe('success');

      let secondRun: Promise<void>;
      act(() => { secondRun = result.current.handleGenerate(); });
      expect(result.current.selection).toBeUndefined();
      await waitFor(() => expect(resolveSecond).toBeDefined());
      resolveSecond!({ ok: true, json: async () => ({ results: [] }) });
      await act(async () => secondRun!);
      expect(result.current.selection).toBeUndefined();
    });

    it('clears Jev selection when assistant configuration changes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ id: '1', status: 'success', enhancedText: 'First', total_tokens: 1 }],
          selection: {
            status: 'success', judge: 'jev', model: 'typesafe/jev-1.13',
            selectedResultId: '1', confidence: 1, probabilities: { '1': 1 },
          },
        }),
      });
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      act(() => result.current.setInputText('Test input'));
      await act(async () => result.current.handleGenerate());
      expect(result.current.selection?.status).toBe('success');

      act(() => result.current.handleToggleAssistant(1));
      expect(result.current.selection).toBeUndefined();
    });

    it('replaces the anonymous session after a 401', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      act(() => result.current.setInputText('Test input text'));
      await act(async () => result.current.handleGenerate());

      expect(mockResetSession).toHaveBeenCalledTimes(1);
      consoleError.mockRestore();
    });
  });

  describe('Token Balance Updates - Bug Fix #2', () => {
    beforeEach(() => {
      // Reset fetch mock
      (global.fetch as jest.Mock).mockClear();
      // Reset token balance mocks
      mockUpdateTokenBalance.mockClear();
      mockResetSession.mockClear();
    });

    it('should update the local token balance after successful enhancement', async () => {
      // Setup mock to dynamically respond with correct ID
      (global.fetch as jest.Mock).mockImplementation(async (_url: string, options: any) => {
        // Parse the request body to get the assistant IDs
        const body = JSON.parse(options.body);
        const assistantId = body.assistants[0].id;

        return {
          ok: true,
          json: async () => ({
            results: [
              {
                id: assistantId,
                status: 'success',
                enhancedText: 'Enhanced text 1',
                total_tokens: 100,
              },
            ],
          }),
        };
      });

      const { result } = renderHook(() => useWorkflow(), { wrapper });

      act(() => {
        result.current.setInputText('Test input text');
      });

      // Ensure there's at least one enabled config
      const enabledCount = result.current.configs.filter(c => c.enabled).length;
      expect(enabledCount).toBeGreaterThan(0);

      await act(async () => {
        await result.current.handleGenerate();
      });

      // Wait for generation to complete
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false);
      }, { timeout: 3000 });

      // Check if fetch was called
      expect(global.fetch).toHaveBeenCalled();

      // Verify updateTokenBalance was called with correct value
      expect(mockUpdateTokenBalance).toHaveBeenCalledWith(100);

      expect(mockResetSession).not.toHaveBeenCalled();
    });

    it('should calculate total tokens from multiple successful results', async () => {
      // Setup dynamic mock
      (global.fetch as jest.Mock).mockImplementation(async (_url: string, options: any) => {
        const body = JSON.parse(options.body);
        const results = body.assistants.map((assistant: any, index: number) => ({
          id: assistant.id,
          status: 'success',
          enhancedText: `Text ${index + 1}`,
          total_tokens: [100, 150, 200][index],
        }));

        return {
          ok: true,
          json: async () => ({ results }),
        };
      });

      const { result } = renderHook(() => useWorkflow(), { wrapper });

      act(() => {
        result.current.setInputText('Test input text');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false);
      }, { timeout: 3000 });

      expect(mockUpdateTokenBalance).toHaveBeenCalledWith(450); // 100 + 150 + 200
    });

    it('should exclude error results from token calculation', async () => {
      // Setup dynamic mock with mix of success and error
      (global.fetch as jest.Mock).mockImplementation(async (_url: string, options: any) => {
        const body = JSON.parse(options.body);
        const results = body.assistants.map((assistant: any, index: number) => {
          if (index === 2) {
            return {
              id: assistant.id,
              status: 'error',
              error: { code: 'INSUFFICIENT_QUOTA' },
            };
          }
          return {
            id: assistant.id,
            status: 'success',
            enhancedText: `Text ${index + 1}`,
            total_tokens: [100, 150][index],
          };
        });

        return {
          ok: true,
          json: async () => ({ results }),
        };
      });

      const { result } = renderHook(() => useWorkflow(), { wrapper });

      act(() => {
        result.current.setInputText('Test input text');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false);
      }, { timeout: 3000 });

      // Should only count successful results (100 + 150 = 250)
      expect(mockUpdateTokenBalance).toHaveBeenCalledWith(250);
    });

    it('should not call updateTokenBalance when all results are errors', async () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      // Add one more config
      const config2: AiConfig = {
        id: Date.now() + 1,
        model: 'open-router-free',
        aiRoleId: 'editor',
        options: { ...DEFAULT_OPTIONS },
        enabled: true,
      };

      act(() => {
        result.current.handleSaveConfig(config2);
        result.current.setInputText('Test input text');
      });

      // Get config IDs
      const configIds = result.current.configs.map(c => c.id.toString());

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { id: configIds[0], status: 'error', error: { code: 'INSUFFICIENT_QUOTA' } },
            { id: configIds[1], status: 'error', error: { code: 'VALIDATION_ERROR' } },
          ],
        }),
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false);
      });

      // Should not call updateTokenBalance when totalTokensUsed is 0
      expect(mockUpdateTokenBalance).not.toHaveBeenCalled();
    });

    it('should handle API response without total_tokens field', async () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      // Get the first config ID
      const firstConfigId = result.current.configs[0].id.toString();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { id: firstConfigId, status: 'success', enhancedText: 'Text 1' }, // Missing total_tokens
          ],
        }),
      });

      act(() => {
        result.current.setInputText('Test input text');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false);
      });

      // Should not call updateTokenBalance when total is 0
      expect(mockUpdateTokenBalance).not.toHaveBeenCalled();
    });
  });
});
