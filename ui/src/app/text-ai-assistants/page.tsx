'use client';

import React, { useState, useEffect } from 'react';
import { WorkflowProvider, useWorkflow } from '@/context/WorkflowContext';
import { InfoTooltip } from '@/components/features/InfoTooltip';
import { ConfirmationModal } from '@/components/features/ConfirmationModal';
import { CreateWorkflowModal } from '@/components/features/CreateWorkflowModal';
import { ConfigEditorModal } from '@/components/features/ConfigEditorModal';
import { CharacterCounter } from '@/components/features/CharacterCounter';
import { AssistantCard } from '@/components/features/AssistantCard';
import { AiConfig } from '@/lib/types';
import { TOOLTIP_TEXTS, DEFAULT_OPTIONS, DEFAULT_WORKFLOW_NAMES, AVAILABLE_MODELS } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';

/**
 * Main application page component
 * Implements the two-column layout with input section and workflow management
 */
function TextAIAssistantsContent() {
  // Access workflow context using the provided hook
  const {
    workflows,
    selectedWorkflow,
    configs,
    results,
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
  } = useWorkflow();

  const { tierLimits, profile } = useAuth();

  // Local UI state
  const [isInputHighlighted, setIsInputHighlighted] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [configToEdit, setConfigToEdit] = useState<AiConfig | null>(null);
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [isCreateWorkflowModalOpen, setIsCreateWorkflowModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Modal handlers
  const handleOpenAddModal = () => {
    // Check batch limit before opening modal
    if (configs.length >= tierLimits.maxBatchSize) {
      return; // Button should be disabled, but extra safety check
    }

    const newConfiguration: AiConfig = {
      id: Date.now(),
      model: AVAILABLE_MODELS[0],
      aiRoleId: 'editor',
      options: { ...DEFAULT_OPTIONS },
      enabled: true,
    };
    setEditorMode('add');
    setConfigToEdit(newConfiguration);
    setIsEditorModalOpen(true);
  };

  // Check if batch limit reached
  const isBatchLimitReached = configs.length >= tierLimits.maxBatchSize;

  const handleOpenEditModal = (id: number) => {
    const config = configs.find((c) => c.id === id);
    if (config) {
      setEditorMode('edit');
      setConfigToEdit(config);
      setIsEditorModalOpen(true);
    }
  };

  const handleCloseEditorModal = () => {
    setIsEditorModalOpen(false);
    setConfigToEdit(null);
  };

  const handleConfirmDeleteWorkflow = () => {
    if (workflowToDelete) {
      handleDeleteWorkflow(workflowToDelete);
      setIsDeleteModalOpen(false);
      setWorkflowToDelete(null);
    }
  };

  // Copy to clipboard with visual feedback
  const copyToClipboard = (text: string, configId: number) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedId(configId);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch((err) => console.error('Failed to copy: ', err));
  };

  // Improve this version feature
  const handleImproveThisVersion = (text: string) => {
    setInputText(text);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsInputHighlighted(true);
    setTimeout(() => {
      setIsInputHighlighted(false);
    }, 1500);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter or Ctrl+Enter to enhance text
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (
          inputText.trim() &&
          configs.some((c) => c.enabled) &&
          inputText.length <= tierLimits.maxTextLength &&
          contextText.length <= tierLimits.maxContextLength
        ) {
          handleGenerate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputText, contextText, configs, tierLimits, handleGenerate]);

  return (
    <main className="flex flex-col flex-grow">
      {/* Modals */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteWorkflow}
        workflowName={workflowToDelete || ''}
      />
      {configToEdit && (
        <ConfigEditorModal
          isOpen={isEditorModalOpen}
          onClose={handleCloseEditorModal}
          onSave={handleSaveConfig}
          configData={configToEdit}
          mode={editorMode}
        />
      )}
      <CreateWorkflowModal
        isOpen={isCreateWorkflowModalOpen}
        onClose={() => setIsCreateWorkflowModalOpen(false)}
        onCreate={handleCreateWorkflow}
        existingWorkflowNames={workflows.map((w) => w.name)}
      />
      {profile && (
        <div className="mx-auto w-full max-w-7xl px-4 mb-6">
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">Weekly usage</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {profile.tokens_available.toLocaleString()} tokens remaining. Allowance resets Monday at 00:00 UTC.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main heading */}
      <h1 className="text-center mb-8 text-secondary text-4xl font-semibold flex-shrink-0">
        AI Text Enhancer({selectedWorkflow})
      </h1>

      {/* Two-column container */}
      <div className="flex flex-col md:flex-row gap-8 w-full mx-auto flex-grow items-start px-4">
        {/* Left Column - Input & Configuration */}
        <aside
          className="bg-card p-8 rounded-lg flex flex-col justify-between gap-6 w-full md:w-1/2 lg:w-1/3 xl:w-1/4 flex-shrink-0 static md:sticky top-8 h-auto md:max-h-[calc(100vh-4rem)] overflow-visible md:overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-card [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) var(--card)' }}
          aria-labelledby="input-heading"
        >
          <h2 id="input-heading" className="sr-only">
            Input and Controls
          </h2>

          <div id="setup-panel" className="flex flex-col gap-6">
            {/* Your Text Input */}
            <div className="flex flex-col">
              <label htmlFor="inputText" className="flex items-center gap-2 mb-2 font-medium text-foreground">
                Your Text <InfoTooltip text={TOOLTIP_TEXTS.yourText} />
              </label>
              <textarea
                id="inputText"
                data-testid="input-text"
                className={`w-full p-3 bg-background border rounded-lg text-foreground font-inherit text-base transition-all duration-300 resize-vertical min-h-[150px] focus:outline-none focus:border-primary ${
                  isInputHighlighted
                    ? 'border-secondary shadow-[0_0_8px_var(--secondary)] animate-pulse'
                    : 'border-border'
                }`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Write or paste your text here..."
                aria-required="true"
              />
              <CharacterCounter
                currentLength={inputText.length}
                maxLength={tierLimits.maxTextLength}
                label="Your Text"
              />
            </div>

            {/* Context Input */}
            <div className="flex flex-col">
              <label htmlFor="contextText" className="flex items-center gap-2 mb-2 font-medium text-foreground">
                Context (e.g., email thread, optional) <InfoTooltip text={TOOLTIP_TEXTS.context} />
              </label>
              <textarea
                id="contextText"
                data-testid="context-text"
                className="w-full p-3 bg-background border border-border rounded-lg text-foreground font-inherit text-base transition-all duration-300 resize-vertical min-h-[150px] focus:outline-none focus:border-primary"
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                placeholder="Provide any relevant context here..."
              />
              <CharacterCounter
                currentLength={contextText.length}
                maxLength={tierLimits.maxContextLength}
                label="Context"
              />
            </div>
          </div>

          {/* Primary Action Button */}
          {isGenerating ? (
            <button
              data-testid="cancel-button"
              onClick={handleCancel}
              className="w-full p-4 text-xl bg-destructive text-destructive-foreground font-semibold rounded-lg hover:bg-destructive/90 cursor-pointer transition-colors"
              title="Stop generation"
            >
              Cancel Generation
            </button>
          ) : (
            <>
              {(inputText.length > tierLimits.maxTextLength || contextText.length > tierLimits.maxContextLength) && (
                <p className="text-destructive text-sm text-center mb-2">
                  {inputText.length > tierLimits.maxTextLength
                    ? `Text exceeds maximum length (${tierLimits.maxTextLength} characters)`
                    : `Context exceeds maximum length (${tierLimits.maxContextLength} characters)`}
                </p>
              )}
              <button
                data-testid="enhance-button"
                onClick={handleGenerate}
                disabled={
                  !inputText.trim() ||
                  !configs.some((c) => c.enabled) ||
                  inputText.length > tierLimits.maxTextLength ||
                  contextText.length > tierLimits.maxContextLength
                }
                className="w-full p-4 text-xl bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:hover:bg-muted cursor-pointer transition-colors"
                title="Process text with the current assistants"
              >
                Enhance Text
              </button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> to enhance
              </p>
            </>
          )}
        </aside>

        {/* Right Column - Workflows & Results */}
        <section
          className="flex-grow min-w-0 bg-card p-8 rounded-lg w-full h-auto overflow-visible md:overflow-y-auto md:max-h-[calc(100vh-4rem)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-card [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) var(--card)' }}
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Workflow Tabs */}
          <ul
            className="list-none flex items-center gap-1 border-b border-border mb-6 overflow-x-auto pb-[1px] flex-shrink-0"
            role="tablist"
            aria-label="AI Workflows"
          >
            {workflows.map((workflow) => (
              <li key={workflow.name} role="presentation">
                <div
                  id={`tab-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
                  data-testid={`workflow-tab-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-md border border-border border-b-0 whitespace-nowrap -mb-[1px] relative transition-colors cursor-pointer ${
                    selectedWorkflow === workflow.name
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-muted text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                  }`}
                  onClick={() => handleLoadWorkflow(workflow.name)}
                  role="tab"
                  aria-selected={selectedWorkflow === workflow.name}
                  aria-controls={`panel-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
                  tabIndex={selectedWorkflow === workflow.name ? 0 : -1}
                >
                  <span className="workflow-name">{workflow.name}</span>
                  {!DEFAULT_WORKFLOW_NAMES.includes(workflow.name) && (
                    <button
                      data-testid={`delete-workflow-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setWorkflowToDelete(workflow.name);
                        setIsDeleteModalOpen(true);
                      }}
                      className={`bg-transparent border-none p-0 text-lg leading-none rounded-full h-[18px] w-[18px] inline-flex items-center justify-center transition-colors cursor-pointer ${
                        selectedWorkflow === workflow.name ? 'text-primary-foreground' : 'text-muted-foreground'
                      } hover:bg-destructive hover:text-destructive-foreground disabled:bg-transparent disabled:text-muted disabled:cursor-not-allowed`}
                      aria-label={`Delete workflow ${workflow.name}`}
                      title="Delete workflow"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </li>
            ))}
            <li role="presentation">
              <button
                data-testid="create-workflow-button"
                className="flex items-center gap-2 px-3 py-1 rounded-t-md border border-border border-b-0 bg-muted text-muted-foreground hover:bg-surface-hover hover:text-foreground text-2xl font-bold leading-none cursor-pointer"
                onClick={() => setIsCreateWorkflowModalOpen(true)}
                title="Create a new workflow"
              >
                +
              </button>
            </li>
          </ul>

          {/* Tab Content - Assistant Cards */}
          <div
            className="tab-content"
            role="tabpanel"
            aria-labelledby={`tab-${selectedWorkflow.toLowerCase().replace(/\s+/g, '-')}`}
            id={`panel-${selectedWorkflow.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <ul className="list-none grid gap-6 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3" aria-label="Current AI Assistants">
              {configs.map((config) => (
                <AssistantCard
                  key={config.id}
                  config={config}
                  result={results.get(config.id)}
                  onToggle={handleToggleAssistant}
                  onEdit={handleOpenEditModal}
                  onCopy={handleCopyConfig}
                  onRemove={handleRemoveConfig}
                  onCopyResult={copyToClipboard}
                  onImproveVersion={handleImproveThisVersion}
                  copiedId={copiedId}
                />
              ))}

              {/* Add Assistant Card */}
              <li>
                <div className="relative">
                  <button
                    data-testid="add-assistant-button"
                    className={`w-full bg-transparent border-2 border-dashed text-muted-foreground p-8 flex flex-col items-center justify-center gap-4 rounded-lg transition-all min-h-[320px] ${
                      isBatchLimitReached
                        ? 'border-muted cursor-not-allowed opacity-50'
                        : 'border-border hover:border-primary hover:text-secondary hover:bg-surface-hover focus-visible:border-primary focus-visible:text-secondary focus-visible:bg-surface-hover cursor-pointer'
                    }`}
                    onClick={handleOpenAddModal}
                    disabled={isBatchLimitReached}
                    title={
                      isBatchLimitReached
                        ? `Maximum of ${tierLimits.maxBatchSize} assistants reached`
                        : 'Add a new AI assistant'
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      className="transition-transform hover:scale-110"
                    >
                      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                    </svg>
                    <span>Add Assistant</span>
                  </button>
                  {isBatchLimitReached && (
                    <div className="absolute -bottom-6 left-0 right-0 text-center">
                      <p className="text-xs text-destructive">
                        Maximum of {tierLimits.maxBatchSize} assistants reached
                      </p>
                    </div>
                  )}
                </div>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Main page export wrapped with WorkflowProvider
 */
export default function TextAIAssistantsPage() {
  return (
    <WorkflowProvider>
      <TextAIAssistantsContent />
    </WorkflowProvider>
  );
}
