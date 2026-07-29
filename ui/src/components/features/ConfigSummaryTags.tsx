"use client";

import * as React from "react";
import { Options } from "@/lib/types";
import {
  FORMALITY_EMOJIS,
  TONE_EMOJIS,
  LANGUAGE_LEVELS,
  LANGUAGES,
} from "@/lib/constants";

/**
 * Props for the ConfigSummaryTags component
 */
interface ConfigSummaryTagsProps {
  /** The enhancement options to display as tags */
  options: Options;
  /** Callback fired when the tags are clicked (typically opens edit modal) */
  onClick: () => void;
}

export function ConfigSummaryTags({ options, onClick }: ConfigSummaryTagsProps) {
  const tags: string[] = [];

  // Add action tags
  if (options.improve) tags.push("Improve");
  if (options.fixMistakes) tags.push("Fix Mistakes");
  if (options.format) tags.push("Format");
  if (options.shorten) tags.push("Shorten");
  if (options.lengthen) tags.push("Lengthen");
  if (options.addEmojis) tags.push("+ Emojis");

  // Add formality with emoji
  tags.push(`${FORMALITY_EMOJIS[options.formality]} ${options.formality}`);

  // Add tone with emoji
  tags.push(`${TONE_EMOJIS[options.tone]} ${options.tone}`);

  // Add language level if set
  if (options.languageLevel) {
    const level = LANGUAGE_LEVELS.find((l) => l.value === options.languageLevel);
    if (level) tags.push(`lvl: ${level.label}`);
  }

  // Add translation target if set
  if (options.translateTo) {
    const langName = LANGUAGES.find((l) => l.code === options.translateTo)?.name;
    if (langName && langName !== "No Translation") {
      tags.push(`→ ${langName}`);
    }
  }

  if (tags.length === 0) return null;

  return (
    <button
      className="flex flex-wrap gap-2 cursor-pointer rounded-md px-2 py-2 -mx-2 transition-all duration-200 outline-2 outline-transparent outline-offset-2 focus-visible:bg-surface-hover focus-visible:outline-primary bg-transparent border-none w-full text-left"
      onClick={onClick}
      type="button"
      title="Edit this assistant"
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="bg-surface-hover text-muted-foreground px-2.5 py-1 rounded-xl text-xs"
        >
          {tag}
        </span>
      ))}
    </button>
  );
}
