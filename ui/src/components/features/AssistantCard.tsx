'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { ToggleSwitch } from '@/components/features/ToggleSwitch';
import { ConfigSummaryTags } from '@/components/features/ConfigSummaryTags';
import { ResultTextarea } from '@/components/features/ResultTextarea';
import { LoadingSpinner } from '@/components/features/LoadingSpinner';
import { InfoTooltip } from '@/components/features/InfoTooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AiConfig, Result } from '@/lib/types';
import { TOOLTIP_TEXTS, getAiRoleLabel } from '@/lib/constants';
import type { BatchSelection } from '../../../../backend/src/types/api.types';

type SuccessfulSelection = Extract<BatchSelection, { status: 'success' }>;

/**
 * Props for the AssistantCard component
 */
interface AssistantCardProps {
  /** The AI assistant configuration to display */
  config: AiConfig;
  /** Optional result from the AI generation */
  result?: Result;
  /** Callback to toggle assistant enabled state */
  onToggle: (id: number) => void;
  /** Callback to open edit modal for this assistant */
  onEdit: (id: number) => void;
  /** Callback to duplicate this assistant */
  onCopy: (id: number) => void;
  /** Callback to remove this assistant */
  onRemove: (id: number) => void;
  /** Callback to copy result text to clipboard */
  onCopyResult: (text: string, configId: number) => void;
  /** Callback to use result as new input text */
  onImproveVersion: (text: string) => void;
  /** ID of the assistant whose result was just copied (for visual feedback) */
  copiedId: number | null;
  /** Present only when this card is the current Jev selection. */
  jevSelection?: SuccessfulSelection;
}

export function AssistantCard({
  config,
  result,
  onToggle,
  onEdit,
  onCopy,
  onRemove,
  onCopyResult,
  onImproveVersion,
  copiedId,
  jevSelection,
}: AssistantCardProps) {
  const selectedByJev = Boolean(jevSelection && result && !result.error && !result.isLoading);

  return (
    <li
      key={config.id}
      data-testid={`assistant-card-${config.id}`}
      className={`bg-background p-6 rounded-lg border flex flex-col gap-4 relative transition-all duration-300 ${
        !config.enabled ? 'opacity-60' : ''
      } ${selectedByJev ? 'ring-2 ring-secondary/40' : ''
      }`}
      style={{ borderColor: result?.error ? 'var(--destructive)' : selectedByJev ? 'var(--secondary)' : 'var(--border)' }}
    >
      {/* Assistant Card Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1 flex-grow">
          <div className="flex items-center gap-3">
            <ToggleSwitch
              id={`toggle-${config.id}`}
              checked={config.enabled}
              onChange={() => onToggle(config.id)}
            />
            <h3 className="text-base text-secondary m-0">{getAiRoleLabel(config.aiRoleId)}</h3>
          </div>
          <small className="text-muted-foreground">{config.model}</small>
          {selectedByJev && (
            <span
              data-testid={`jev-selection-${config.id}`}
              className="mt-1 w-fit rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-semibold text-secondary"
              title="Selected by Jev from the successful results in this run."
            >
              ✨ Chosen by Jev
            </span>
          )}
        </div>

        {/* Kebab Menu */}
        <div className="relative flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid={`kebab-menu-${config.id}`}
                className="bg-transparent border-none p-1 rounded-full cursor-pointer leading-none hover:bg-surface-hover transition-colors"
                aria-label="More options"
                title="More options"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="fill-muted-foreground hover:fill-foreground transition-colors"
                  aria-hidden="true"
                >
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid={`edit-assistant-${config.id}`}
                onSelect={() => onEdit(config.id)}
              >
                Edit Assistant
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid={`duplicate-assistant-${config.id}`}
                onSelect={() => onCopy(config.id)}
              >
                Duplicate Assistant
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid={`remove-assistant-${config.id}`}
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onSelect={() => onRemove(config.id)}
              >
                Remove Assistant
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Config Summary Tags */}
      <ConfigSummaryTags options={config.options} onClick={() => onEdit(config.id)} />

      {/* Assistant Card Body */}
      <div className="bg-card rounded-lg p-4 min-h-[100px] flex flex-col">
        {result?.isLoading ? (
          <div className="mx-auto my-8">
            <LoadingSpinner />
            <span className="sr-only">Loading...</span>
          </div>
        ) : result ? (
          <div className="flex flex-col">
            <ResultTextarea
              value={result.text}
              aria-label="Generated text"
            />
            <div className="mt-4 flex justify-end items-center gap-2">
              {!result.error && (
                <button
                  data-testid={`improve-version-${config.id}`}
                  onClick={() => onImproveVersion(result.text)}
                  className="flex items-center gap-2 px-6 py-3 bg-muted hover:bg-muted-foreground/20 text-foreground rounded-lg transition-colors cursor-pointer"
                  title="Use this text as the next input"
                >
                  Improve this Version
                  <InfoTooltip text={TOOLTIP_TEXTS.useThisText} position="left" />
                </button>
              )}
              <button
                data-testid={`copy-result-${config.id}`}
                onClick={() => onCopyResult(result.text, config.id)}
                className="bg-transparent border-none p-2 opacity-60 hover:opacity-100 hover:text-secondary transition-all leading-none cursor-pointer"
                aria-label={copiedId === config.id ? 'Copied!' : 'Copy result to clipboard'}
                title={copiedId === config.id ? 'Copied!' : 'Copy result to clipboard'}
              >
                {copiedId === config.id ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6Z"
                    />
                    <path d="M2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground m-auto flex flex-col gap-2 p-4">
            <p className="font-medium text-base">Ready to enhance your text?</p>
            <p className="text-sm">
              Enter text in the input field and click "Enhance Text" to see AI-generated results here.
            </p>
            <p className="text-xs opacity-75">
              Tip: Enable multiple assistants to compare different enhancement styles
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
