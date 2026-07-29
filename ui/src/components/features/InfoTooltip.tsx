"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  text: string;
  position?: "right" | "left";
}

export function InfoTooltip({ text, position = "right" }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="inline-flex items-center justify-center cursor-help"
            tabIndex={0}
            role="tooltip"
            aria-label={text}
          >
            <span className="inline-block w-4 h-4 border border-neutral-500 rounded-full text-xs font-bold text-center leading-[14px] text-neutral-500">
              i
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side={position}
          align="center"
          className="w-[220px] bg-neutral-800 text-white text-center rounded-md px-2 py-2 text-sm font-normal"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
