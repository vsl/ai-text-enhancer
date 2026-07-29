"use client";

import * as React from "react";

interface ResultTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

/**
 * Custom hook to auto-resize a textarea based on its content
 */
function useAutoResizeTextarea(value: string) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto"; // Reset height
      el.style.height = `${el.scrollHeight}px`; // Set to content height
    }
  }, [value]);

  return ref;
}

export function ResultTextarea({
  value,
  onChange,
  readOnly,
  ...props
}: ResultTextareaProps) {
  const textareaRef = useAutoResizeTextarea(value);

  // If onChange is not provided, make the textarea read-only to avoid React warnings
  const isReadOnly = readOnly !== undefined ? readOnly : !onChange;

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      readOnly={isReadOnly}
      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground font-[inherit] text-base transition-all duration-300 focus:outline-none focus:border-primary resize-none"
      {...props}
    />
  );
}
