'use client';

import { Check, Copy, MoreVertical, WandSparkles } from 'lucide-react';
import { ToggleSwitch } from '@/components/features/ToggleSwitch';
import { ConfigSummaryTags } from '@/components/features/ConfigSummaryTags';
import { ResultTextarea } from '@/components/features/ResultTextarea';
import { InfoTooltip } from '@/components/features/InfoTooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AiConfig, Result } from '@/lib/types';
import { TOOLTIP_TEXTS, getAiRoleLabel, MODEL_NAMES } from '@/lib/constants';
import type { BatchSelection } from '../../../../backend/src/types/api.types';

type SuccessfulSelection = Extract<BatchSelection, { status: 'success' }>;

interface AssistantCardProps {
  config: AiConfig;
  result?: Result;
  onToggle: (id: number) => void;
  onEdit: (id: number) => void;
  onCopy: (id: number) => void;
  onRemove: (id: number) => void;
  onCopyResult: (text: string, configId: number) => void;
  onImproveVersion: (text: string) => void;
  copiedId: number | null;
  jevSelection?: SuccessfulSelection;
  featured?: boolean;
}

export function AssistantCard({
  config, result, onToggle, onEdit, onCopy, onRemove,
  onCopyResult, onImproveVersion, copiedId, jevSelection, featured = false,
}: AssistantCardProps) {
  const probability = result && !result.error && !result.isLoading
    ? jevSelection?.probabilities[config.id.toString()] : undefined;
  const selectedByJev = probability !== undefined && jevSelection?.selectedResultId === config.id.toString();
  const rejectionReasons = probability === undefined ? [] : jevSelection?.rejectionReasons?.[config.id.toString()] ?? [];
  const percentage = probability === undefined ? undefined : probability > 0 && probability < 0.01
    ? '<1%' : `${Math.round(probability * 100)}%`;

  return (
    <li
      data-testid={`assistant-card-${config.id}`}
      className={`relative flex min-w-0 flex-col rounded-2xl border bg-card p-4 transition-colors sm:p-5 ${featured ? 'col-span-full bg-violet-surface/60' : ''} ${result?.error ? 'border-destructive/70' : selectedByJev ? 'border-violet-border' : 'border-border-strong'} ${!config.enabled ? 'opacity-60' : ''}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="pt-0.5">
          <ToggleSwitch id={`toggle-${config.id}`} checked={config.enabled} onChange={() => onToggle(config.id)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold leading-5 text-foreground">{getAiRoleLabel(config.aiRoleId)}</h3>
            {selectedByJev && (
              <span
                data-testid={`jev-selection-${config.id}`}
                className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                title="Selected by Jev from the successful results in this run."
              >
                Chosen by Jev
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-tertiary">{MODEL_NAMES[config.model] ?? config.model}</p>
        </div>
        {percentage !== undefined && (
          <span
            data-testid={`jev-probability-${config.id}`}
            className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${selectedByJev ? 'bg-primary/15 text-primary' : 'bg-surface-hover text-muted-foreground'}`}
            title="Jev’s relative preference among results that passed the checks, not an absolute quality score. Rejected results receive 0%."
          >
            Jev {percentage}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid={`kebab-menu-${config.id}`}
              className="shrink-0 rounded-md p-1 text-tertiary hover:bg-surface-hover hover:text-foreground"
              aria-label="More options"
              title="More options"
            >
              <MoreVertical className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid={`edit-assistant-${config.id}`} onSelect={() => onEdit(config.id)}>Edit Assistant</DropdownMenuItem>
            <DropdownMenuItem data-testid={`duplicate-assistant-${config.id}`} onSelect={() => onCopy(config.id)}>Duplicate Assistant</DropdownMenuItem>
            <DropdownMenuItem data-testid={`remove-assistant-${config.id}`} className="text-destructive hover:bg-destructive hover:text-white" onSelect={() => onRemove(config.id)}>Remove Assistant</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfigSummaryTags options={config.options} onClick={() => onEdit(config.id)} />

      {result && (
        <div className="mt-4 border-t border-border pt-4">
          {probability !== undefined && (
            <div className="mb-4 h-1 overflow-hidden rounded-full bg-border-strong" aria-hidden="true">
              <div className={`h-full rounded-full ${selectedByJev ? 'bg-primary' : 'bg-tertiary/50'}`} style={{ width: `${probability * 100}%` }} />
            </div>
          )}
          {result.isLoading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground" role="status" aria-label="Assistant is thinking">
              <span className="size-3 animate-pulse rounded-full bg-primary" aria-hidden="true" /> Thinking...
            </div>
          ) : result.error ? (
            <p role="alert" className="text-sm leading-6 text-destructive">{result.text}</p>
          ) : (
            <>
              {rejectionReasons.length > 0 && (
                <p className="mb-3 text-sm text-destructive" role="status">
                  Excluded: {rejectionReasons.map(reason => reason === 'EM_DASH'
                    ? 'contains an em dash while Avoid AI symbols is enabled'
                    : 'followed an embedded instruction instead of transforming the text').join('; ')}.
                </p>
              )}
              <ResultTextarea value={result.text} aria-label="Generated text" />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  data-testid={`improve-version-${config.id}`}
                  onClick={() => onImproveVersion(result.text)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  title="Use this text as the next input"
                >
                  <WandSparkles className="size-3.5" aria-hidden="true" /> Improve this version
                  <InfoTooltip text={TOOLTIP_TEXTS.useThisText} position="left" />
                </button>
                <button
                  data-testid={`copy-result-${config.id}`}
                  onClick={() => onCopyResult(result.text, config.id)}
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  aria-label={copiedId === config.id ? 'Copied!' : 'Copy result to clipboard'}
                  title={copiedId === config.id ? 'Copied!' : 'Copy result to clipboard'}
                >
                  {copiedId === config.id ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                  {copiedId === config.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
