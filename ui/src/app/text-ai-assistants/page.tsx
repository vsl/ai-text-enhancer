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
import { orderConfigsForDisplay } from '@/lib/result-order';
import { TOOLTIP_TEXTS, DEFAULT_OPTIONS, DEFAULT_WORKFLOW_NAMES, AVAILABLE_MODELS } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { Plus, Sparkles } from 'lucide-react';

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
  } = useWorkflow();

  const { tierLimits, profile } = useAuth();

  const displayedConfigs = orderConfigsForDisplay(configs, results, selection);
  const hasResults = results.size > 0;
  const selectedResultId = selection?.status === 'success' ? selection.selectedResultId : undefined;
  const selectedResult = selectedResultId ? results.get(Number(selectedResultId)) : undefined;
  const featuredResultId = selection?.status === 'success' && selectedResult
    && !selectedResult.error && !selectedResult.isLoading
    && selection.probabilities[selection.selectedResultId] !== undefined
    ? selection.selectedResultId : undefined;
  const workflowSubtitle = selectedWorkflow === 'Quick Fix'
    ? 'Clean up and improve everyday text'
    : selectedWorkflow === 'Formal Email'
      ? 'Create polished email responses'
      : 'Reusable AI workflow';

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
    <div className="content-grid flex flex-col flex-grow py-10 md:py-12">
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
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[30px]">{selectedWorkflow || 'AI Text Enhancer'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{workflowSubtitle}</p>
        </div>
        {profile && (
          <div className="text-left md:text-right" aria-label="Weekly demo allowance">
            <p className="text-sm font-medium tabular-nums">{profile.tokens_available.toLocaleString()} tokens left</p>
            <p className="mt-1 text-xs text-tertiary">resets Monday 00:00 UTC</p>
          </div>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,380px)_minmax(0,1fr)]">
        {/* Left Column - Input & Configuration */}
        <aside
          className="flex w-full flex-col gap-6 rounded-2xl border border-border-strong bg-card p-5 sm:p-6 lg:sticky lg:top-6"
          aria-labelledby="input-heading"
        >
          <h2 id="input-heading" className="sr-only">
            Input and Controls
          </h2>

          <div id="setup-panel" className="flex flex-col gap-5">
            {/* Your Text Input */}
            <div className="flex flex-col">
              <label htmlFor="inputText" className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                Your text <InfoTooltip text={TOOLTIP_TEXTS.yourText} />
              </label>
              <textarea
                id="inputText"
                data-testid="input-text"
                className={`min-h-[168px] w-full resize-y rounded-xl border bg-input p-3 text-sm leading-6 text-foreground placeholder:text-tertiary focus:border-primary focus:outline-none ${
                  isInputHighlighted
                    ? 'border-primary'
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
              <label htmlFor="contextText" className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
                Context <InfoTooltip text={TOOLTIP_TEXTS.context} />
              </label>
              <p className="mb-2 text-xs leading-5 text-tertiary">Optional supporting text, email thread, or background</p>
              <textarea
                id="contextText"
                data-testid="context-text"
                className="min-h-[146px] w-full resize-y rounded-xl border border-border bg-input p-3 text-sm leading-6 text-foreground placeholder:text-tertiary focus:border-primary focus:outline-none"
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
              className="w-full rounded-lg bg-destructive p-3 text-sm font-semibold text-white transition-colors hover:bg-destructive/90"
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
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary p-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                title="Process text with the current assistants"
              >
                <Sparkles className="size-4" aria-hidden="true" /> Enhance text
              </button>
              <p className="mt-2 text-center text-xs text-tertiary">
                Press <kbd className="rounded border border-border bg-surface px-1 py-0.5">⌘</kbd> + <kbd className="rounded border border-border bg-surface px-1 py-0.5">Enter</kbd> to enhance
              </p>
            </>
          )}
        </aside>

        {/* Right Column - Workflows & Results */}
        <section
          className="min-w-0 w-full"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Workflow Tabs */}
          <ul
            className="mb-6 flex list-none items-center gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label="AI Workflows"
          >
            {workflows.map((workflow) => (
              <li key={workflow.name} role="presentation">
                <div
                  id={`tab-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
                  data-testid={`workflow-tab-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`relative flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                    selectedWorkflow === workflow.name
                      ? 'border-violet-border bg-violet-surface font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                  }`}
                  onClick={() => handleLoadWorkflow(workflow.name)}
                  role="tab"
                  aria-selected={selectedWorkflow === workflow.name}
                  aria-controls={`panel-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleLoadWorkflow(workflow.name);
                    }
                  }}
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
                      className="inline-flex size-5 items-center justify-center rounded text-base leading-none text-muted-foreground hover:bg-destructive hover:text-white"
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
                className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-dashed border-border-strong px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
                onClick={() => setIsCreateWorkflowModalOpen(true)}
                title="Create a new workflow"
              >
                <Plus className="size-4" aria-hidden="true" /> New workflow
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
            {hasResults && (
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-base font-semibold">Results</h2>
                {selection?.status === 'success' && <span className="rounded-full bg-surface-hover px-2.5 py-1 text-xs text-tertiary">Evaluated by Jev</span>}
              </div>
            )}
            <ul className={`grid list-none gap-4 ${hasResults ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`} aria-label="Current AI Assistants">
              {displayedConfigs.map((config) => (
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
                  jevSelection={selection?.status === 'success' ? selection : undefined}
                  featured={featuredResultId === config.id.toString()}
                />
              ))}

              {/* Add Assistant Card */}
              <li>
                <div className="relative">
                  <button
                    data-testid="add-assistant-button"
                    className={`flex min-h-[154px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-transparent p-5 text-sm text-muted-foreground transition-colors ${
                      isBatchLimitReached
                        ? 'border-muted cursor-not-allowed opacity-50'
                        : 'border-border-strong hover:border-primary hover:bg-surface-hover hover:text-foreground'
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
                    <span>Add assistant</span>
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
    </div>
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
