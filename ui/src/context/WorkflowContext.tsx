'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AiConfig, Workflow, Result } from '@/lib/types';
import { DEFAULT_WORKFLOWS, DEFAULT_OPTIONS, AVAILABLE_MODELS, AUTH_ERROR_MESSAGES, normalizeAiConfig } from '@/lib/constants';
import { API_BASE_URL } from '@/lib/runtime-config';
import { getErrorMessage } from '@/lib/utils';
import { useAuth } from './AuthContext';
import type { BatchRequest, BatchResponse, BatchSelection } from '../../../backend/src/types/api.types';

/**
 * WorkflowContext interface defining the shape of the context
 */
interface WorkflowContextType {
  // State
  workflows: Workflow[];
  selectedWorkflow: string;
  configs: AiConfig[];
  results: Map<number, Result>;
  selection?: BatchSelection;
  isGenerating: boolean;
  inputText: string;
  contextText: string;

  // Workflow management
  handleCreateWorkflow: (name: string) => void;
  handleLoadWorkflow: (name: string) => void;
  handleDeleteWorkflow: (name: string) => void;

  // Config management
  handleSaveConfig: (config: AiConfig) => void;
  handleRemoveConfig: (id: number) => void;
  handleToggleAssistant: (id: number) => void;
  handleCopyConfig: (id: number) => void;

  // Text management
  setInputText: (text: string) => void;
  setContextText: (text: string) => void;

  // Generation
  handleGenerate: () => Promise<void>;
  handleCancel: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

/**
 * WorkflowProvider component
 */
export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const { getAuthToken, updateTokenBalance, resetSession } = useAuth();

  // Persistent state using localStorage
  const [workflows, setWorkflows] = useLocalStorage<Workflow[]>(
    'aiTextEnhancerWorkflows',
    DEFAULT_WORKFLOWS
  );
  const [selectedWorkflow, setSelectedWorkflow] = useLocalStorage<string>(
    'aiTextEnhancerLastSelectedWorkflow',
    DEFAULT_WORKFLOWS[0].name
  );

  // Local state
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [results, setResults] = useState<Map<number, Result>>(new Map());
  const [selection, setSelection] = useState<BatchSelection>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputText, setInputText] = useState('');
  const [contextText, setContextText] = useState('');

  // Ref for AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Auto-save workflow when configs change
   */
  const autoSaveWorkflow = useCallback((updatedConfigs: AiConfig[]) => {
    if (!selectedWorkflow) return;
    
    setWorkflows(prevWorkflows => {
      const newWorkflows = [...prevWorkflows];
      const workflowIndex = newWorkflows.findIndex(w => w.name === selectedWorkflow);
      if (workflowIndex > -1) {
        newWorkflows[workflowIndex] = {
          ...newWorkflows[workflowIndex],
          configs: updatedConfigs
        };
      }
      return newWorkflows;
    });
  }, [selectedWorkflow, setWorkflows]);

  /**
   * Load workflow on mount and when selectedWorkflow changes.
   * This logic is robustly separated to first validate the selection,
   * then load the corresponding configuration. This avoids race conditions
   * on initial hydration.
   */
  useEffect(() => {
    const workflowToLoad = workflows.find(w => w.name === selectedWorkflow);

    if (workflowToLoad) {
      const migratedConfigs = workflowToLoad.configs.map(normalizeAiConfig);
      setConfigs(migratedConfigs);
      if (JSON.stringify(migratedConfigs) !== JSON.stringify(workflowToLoad.configs)) {
        setWorkflows(current => current.map(workflow =>
          workflow.name === workflowToLoad.name
            ? { ...workflow, configs: migratedConfigs }
            : workflow
        ));
      }
    } else if (workflows.length > 0) {
      // The selected workflow doesn't exist in the list (e.g., stale data).
      // Reset the selection to the first available workflow.
      // This will trigger a re-render, and this effect will run again.
      // The configs will be loaded correctly in the subsequent run.
      setSelectedWorkflow(workflows[0].name);
    } else {
      // Handle the case where there are no workflows at all.
      setConfigs([]);
    }
  }, [selectedWorkflow, workflows, setSelectedWorkflow, setWorkflows]);

  /**
   * Create a new workflow
   */
  const handleCreateWorkflow = useCallback((newWorkflowName: string) => {
    const newConfig: AiConfig = {
      id: Date.now(),
      model: AVAILABLE_MODELS[0],
      aiRoleId: 'editor',
      options: { ...DEFAULT_OPTIONS },
      enabled: true,
    };
    const newWorkflow: Workflow = { name: newWorkflowName, configs: [newConfig] };

    const updatedWorkflows = [...workflows, newWorkflow];
    setWorkflows(updatedWorkflows);
    setSelectedWorkflow(newWorkflow.name);
    // No need for deep clone - configs are already new objects
    setConfigs([{ ...newConfig, options: { ...newConfig.options } }]);
    setResults(new Map());
    setSelection(undefined);
  }, [workflows, setWorkflows, setSelectedWorkflow]);

  /**
   * Load a workflow by name
   */
  const handleLoadWorkflow = useCallback((name: string) => {
    setResults(new Map());
    setSelection(undefined);
    const workflowToLoad = workflows.find(w => w.name === name) || workflows[0];
    if (workflowToLoad) {
      const migratedConfigs = workflowToLoad.configs.map(normalizeAiConfig);
      setConfigs(migratedConfigs);
      setSelectedWorkflow(workflowToLoad.name);
    }
  }, [workflows, setSelectedWorkflow]);

  /**
   * Delete a workflow
   */
  const handleDeleteWorkflow = useCallback((name: string) => {
    const updatedWorkflows = workflows.filter(w => w.name !== name);
    setWorkflows(updatedWorkflows);

    if (selectedWorkflow === name) {
      if (updatedWorkflows.length > 0) {
        // Load the first workflow
        const firstWorkflow = updatedWorkflows[0];
        setSelectedWorkflow(firstWorkflow.name);
        setConfigs(firstWorkflow.configs.map(normalizeAiConfig));
      } else {
        setConfigs([]);
        setSelectedWorkflow('');
      }
    }
    setResults(new Map());
    setSelection(undefined);
  }, [workflows, selectedWorkflow, setWorkflows, setSelectedWorkflow]);

  /**
   * Save or update a config
   */
  const handleSaveConfig = useCallback((updatedConfig: AiConfig) => {
    setSelection(undefined);
    setConfigs(prevConfigs => {
      const existingIndex = prevConfigs.findIndex(c => c.id === updatedConfig.id);
      const newConfigs = [...prevConfigs];
      
      if (existingIndex > -1) {
        // Update existing config
        newConfigs[existingIndex] = updatedConfig;
      } else {
        // Add new config
        newConfigs.push(updatedConfig);
      }
      
      autoSaveWorkflow(newConfigs);
      return newConfigs;
    });
  }, [autoSaveWorkflow]);

  /**
   * Remove a config
   */
  const handleRemoveConfig = useCallback((id: number) => {
    setSelection(undefined);
    const newConfigs = configs.filter(c => c.id !== id);
    setConfigs(newConfigs);
    autoSaveWorkflow(newConfigs);
  }, [configs, autoSaveWorkflow]);

  /**
   * Toggle assistant enabled/disabled
   */
  const handleToggleAssistant = useCallback((id: number) => {
    setSelection(undefined);
    const newConfigs = configs.map(c => {
      if (c.id === id) {
        return { ...c, enabled: !c.enabled };
      }
      return c;
    });
    setConfigs(newConfigs);
    autoSaveWorkflow(newConfigs);
  }, [configs, autoSaveWorkflow]);

  /**
   * Copy a config
   */
  const handleCopyConfig = useCallback((id: number) => {
    setSelection(undefined);
    const configToCopy = configs.find(c => c.id === id);
    if (!configToCopy) return;

    // Clone config with nested options properly
    const newConfig = {
      ...configToCopy,
      id: Date.now(),
      enabled: true,
      options: { ...configToCopy.options }
    };
    
    const originalIndex = configs.findIndex(c => c.id === id);
    const newConfigs = [...configs];
    newConfigs.splice(originalIndex + 1, 0, newConfig);
    
    setConfigs(newConfigs);
    autoSaveWorkflow(newConfigs);
  }, [configs, autoSaveWorkflow]);

  /**
   * Generate enhanced text with API integration
   */
  const handleGenerate = useCallback(async () => {
    // Filter to only enabled configs
    const enabledConfigs = configs.filter(c => c.enabled);
    
    // Validate inputs
    if (!inputText.trim() || enabledConfigs.length === 0) return;

    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setSelection(undefined);

    // Set loading state for all enabled assistants
    setResults(prevResults => {
      const newResults = new Map(prevResults);
      enabledConfigs.forEach(config => {
        newResults.set(config.id, {
          configId: config.id,
          text: '',
          isLoading: true,
          error: false,
        });
      });
      return newResults;
    });

    // Build request payload
    const assistants: BatchRequest['assistants'] = enabledConfigs.map(config => {
      const { languageLevel, translateTo, ...options } = config.options;
      return {
        id: config.id.toString(),
        model: config.model,
        aiRoleId: config.aiRoleId,
        userText: inputText,
        contextText,
        options: {
          ...options,
          languageLevel: languageLevel || 'default',
          ...(translateTo && { translateTo }),
        },
      };
    });
    const request: BatchRequest = { assistants };

    try {
      // Get auth token
      const token = await getAuthToken();

      // Make API request
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const response = await fetch(`${API_BASE_URL}/enhance`, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify(request),
      });

      // Check if request was aborted
      if (controller.signal.aborted) return;

      // Check if response is ok
      if (!response.ok) {
        // Replace an expired anonymous session and reload.
        if (response.status === 401) {
          await resetSession();
          window.location.reload();
          return; // Exit early since page will reload
        }

        const errorBody = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
      }

      // Parse response
      const responseData = await response.json() as BatchResponse;
      setSelection(responseData.selection);

      // Calculate total tokens used from all successful results BEFORE updating state
      const totalTokensUsed = responseData.results.reduce((total, res) => {
        if (res.status === 'success') {
          return total + (res.total_tokens || 0);
        }
        return total;
      }, 0);

      // Update results based on API response
      setResults(prevResults => {
        const newResults = new Map(prevResults);
        responseData.results.forEach((res) => {
          const configId = parseInt(res.id, 10);
          if (res.status === 'success') {
            newResults.set(configId, {
              configId,
              text: res.enhancedText,
              isLoading: false,
              error: false,
            });
          } else {
            // Try to get auth-specific error message first
            const errorMessage = AUTH_ERROR_MESSAGES[res.error?.code] || getErrorMessage(res.error?.code);
            newResults.set(configId, {
              configId,
              text: errorMessage,
              isLoading: false,
              error: true,
            });
          }
        });
        return newResults;
      });

      // Update token balance locally using tokens from response
      if (totalTokensUsed > 0) {
        updateTokenBalance(totalTokensUsed);
      }

    } catch (error: unknown) {
      const caughtError = error instanceof Error ? error : new Error('Unknown error');
      if (caughtError.name === 'AbortError') {
        console.log('Request cancelled by user.');
        // Update UI for cancelled requests
        setResults(prevResults => {
          const newResults = new Map(prevResults);
          enabledConfigs.forEach(config => {
            newResults.set(config.id, {
              configId: config.id,
              text: 'Generation was cancelled.',
              isLoading: false,
              error: true,
            });
          });
          return newResults;
        });
      } else {
        console.error("API error:", caughtError);
        // Update UI for general fetch/network errors
        setResults(prevResults => {
          const newResults = new Map(prevResults);
          enabledConfigs.forEach(config => {
            newResults.set(config.id, {
              configId: config.id,
              text: `An unexpected error occurred: ${caughtError.message}`,
              isLoading: false,
              error: true,
            });
          });
          return newResults;
        });
      }
    } finally {
      // Clear abort controller and reset generating state
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
    }
  }, [configs, inputText, contextText, getAuthToken, updateTokenBalance, resetSession]);

  /**
   * Cancel generation
   */
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const value: WorkflowContextType = {
    workflows,
    selectedWorkflow,
    configs,
    results,
    selection,
    isGenerating,
    inputText,
    contextText,
    handleCreateWorkflow,
    handleLoadWorkflow,
    handleDeleteWorkflow,
    handleSaveConfig,
    handleRemoveConfig,
    handleToggleAssistant,
    handleCopyConfig,
    setInputText,
    setContextText,
    handleGenerate,
    handleCancel,
  };

  // Cleanup on unmount - abort any pending requests
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

/**
 * Hook to use the WorkflowContext
 */
export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}
