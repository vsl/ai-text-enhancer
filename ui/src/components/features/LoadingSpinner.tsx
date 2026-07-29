"use client";

import * as React from "react";

interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className = "" }: LoadingSpinnerProps) {
  return (
    <div
      className={`
        w-8 h-8 
        border-4 border-neutral-700 border-t-[#03dac6] 
        rounded-full 
        animate-spin
        ${className}
      `}
      role="status"
      aria-label="Loading"
    />
  );
}
