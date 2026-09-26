"use client";

import { ShieldCheck } from "lucide-react";
import { Options } from "@/lib/types";
import { LANGUAGE_LEVELS, LANGUAGES } from "@/lib/constants";

interface ConfigSummaryTagsProps {
  options: Options;
  onClick: () => void;
}

export function ConfigSummaryTags({ options, onClick }: ConfigSummaryTagsProps) {
  const actions: string[] = [];
  if (options.improve) actions.push("Improve");
  if (options.fixMistakes) actions.push("Fix mistakes");
  if (options.format) actions.push("Format");
  if (options.shorten) actions.push("Shorten");
  if (options.lengthen) actions.push("Lengthen");
  if (options.addEmojis) actions.push("Add emojis");

  const style: string[] = [options.formality, options.tone];
  if (options.languageLevel) {
    const level = LANGUAGE_LEVELS.find((item) => item.value === options.languageLevel);
    if (level) style.push(level.label);
  }
  if (options.translateTo) {
    const language = LANGUAGES.find((item) => item.code === options.translateTo);
    if (language && language.name !== "No Translation") style.push("→ " + language.name);
  }

  return (
    <button
      className="mt-4 w-full cursor-pointer rounded-md text-left focus-visible:outline-2 focus-visible:outline-primary"
      onClick={onClick}
      type="button"
      title="Edit this assistant"
      aria-label="Edit assistant configuration"
      aria-description={options.avoidCommonAiSymbols ? "Avoid common AI symbols is enabled for this assistant." : undefined}
    >
      <span className="flex flex-wrap gap-1.5">
        {actions.map((tag) => (
          <span key={tag} className="rounded-md border border-border-strong bg-surface px-2 py-0.5 text-xs text-muted-foreground">{tag}</span>
        ))}
      </span>
      <span className="mt-1.5 flex flex-wrap gap-1.5">
        {style.map((tag) => (
          <span key={tag} className="rounded-md bg-violet-surface px-2 py-0.5 text-xs text-primary">{tag}</span>
        ))}
        {options.avoidCommonAiSymbols && (
          <span className="inline-flex items-center gap-1 rounded-md border border-violet-border bg-violet-surface/50 px-2 py-0.5 text-xs text-primary">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Avoid AI symbols
          </span>
        )}
      </span>
    </button>
  );
}
