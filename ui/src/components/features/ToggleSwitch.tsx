"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}

export function ToggleSwitch({ checked, onChange, id }: ToggleSwitchProps) {
  return (
    <label
      htmlFor={id}
      className="relative inline-block h-5 w-9 flex-shrink-0 m-0 cursor-pointer"
      title={checked ? "Disable Assistant" : "Enable Assistant"}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="opacity-0 w-0 h-0 peer"
      />
      <span
        className={`
          absolute inset-0 cursor-pointer rounded-full
          transition-colors duration-200
          ${checked ? "bg-primary" : "bg-muted"}
          peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2
          before:absolute before:content-[''] before:h-3.5 before:w-3.5 before:left-[3px] before:bottom-[3px]
          before:bg-white before:transition-transform before:duration-200 before:rounded-full
          ${checked ? "before:translate-x-4" : "before:translate-x-0"}
        `}
      />
    </label>
  );
}
