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
      className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-[inherit] text-sm leading-7 text-muted-foreground focus:outline-none"
      {...props}
    />
  );
}
