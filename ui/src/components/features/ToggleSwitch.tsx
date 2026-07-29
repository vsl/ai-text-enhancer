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
      className="relative inline-block w-10 h-6 flex-shrink-0 m-0 cursor-pointer"
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
          absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-3xl
          transition-all duration-400
          ${checked ? "bg-[#03dac6]" : "bg-neutral-700"}
          peer-focus-visible:outline-2 peer-focus-visible:outline-[#03dac6] peer-focus-visible:outline-offset-2
          before:absolute before:content-[''] before:h-4 before:w-4 before:left-1 before:bottom-1
          before:bg-white before:transition-all before:duration-400 before:rounded-full
          ${checked ? "before:translate-x-4" : "before:translate-x-0"}
        `}
      />
    </label>
  );
}
