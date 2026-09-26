"use client";

import { useEffect, useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/features/InfoTooltip";
import { useAuth } from "@/context/AuthContext";
import { AiConfig, AiRoleId } from "@/lib/types";
import {
  AVAILABLE_MODELS,
  MODEL_NAMES,
  AVAILABLE_AI_ROLES,
  OPTIONS_CHECKBOXES,
  FORMALITY,
  TONES,
  LANGUAGE_LEVELS,
  LANGUAGES,
  TOOLTIP_TEXTS,
  getAiRoleLabel,
} from "@/lib/constants";

/**
 * Props for the ConfigEditorModal component
 */
interface ConfigEditorModalProps {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Callback fired when the modal should close */
  onClose: () => void;
  /** Callback fired when the configuration is saved */
  onSave: (config: AiConfig) => void;
  /** The AI assistant configuration data to edit */
  configData: AiConfig;
  /** Whether we're adding a new assistant or editing an existing one */
  mode: "add" | "edit";
}

/**
 * ConfigEditorModal Component
 * 
 * A slide-in sheet modal for editing AI assistant configurations.
 * Features:
 * - Slides in from the right
 * - Form sections: Base Setup, Actions, Style, Language
 * - Tracks dirty state to enable/disable Save button
 * - Mutual exclusivity: shorten/lengthen cannot both be checked
 * - Dynamic tooltip for language level based on translation selection
 * - Scrollable body with fixed header and footer
 * - Close on Escape key
 */
export function ConfigEditorModal({
  isOpen,
  onClose,
  onSave,
  configData,
  mode,
}: ConfigEditorModalProps) {
  const { tierLimits } = useAuth();
  const [editedConfig, setEditedConfig] = useState<AiConfig | null>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && configData) {
      setEditedConfig(structuredClone(configData));
      setIsFormDirty(false);
    }
  }, [isOpen, configData]);

  // Track dirty state
  useEffect(() => {
    if (editedConfig && configData) {
      setIsFormDirty(
        JSON.stringify(editedConfig) !== JSON.stringify(configData)
      );
    }
  }, [editedConfig, configData]);

  // Handle Escape key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
    }

    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Handle form field changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!editedConfig) return;

    const { name, value, type } = e.target;

    if (name === "model") {
      setEditedConfig({ ...editedConfig, [name]: value });
    } else if (name === "aiRoleId") {
      setEditedConfig({ ...editedConfig, aiRoleId: value as AiRoleId });
    } else {
      const newOptions = { ...editedConfig.options };
      
      if (type === "checkbox") {
        const { checked } = e.target as HTMLInputElement;
        newOptions[name] = checked;

        // Mutual exclusivity: shorten and lengthen
        if (name === "shorten" && checked) {
          newOptions.lengthen = false;
        }
        if (name === "lengthen" && checked) {
          newOptions.shorten = false;
        }
      } else {
        newOptions[name] = value;
      }

      setEditedConfig({ ...editedConfig, options: newOptions });
    }
  };

  // Handle Save button click
  const handleSaveClick = () => {
    if (editedConfig) {
      onSave(editedConfig);
      onClose();
    }
  };

  // Handle close with unsaved changes confirmation
  const handleClose = () => {
    onClose();
  };

  if (!editedConfig) return null;

  const isSaveDisabled = mode === "edit" && !isFormDirty;
  const levelTooltipText = editedConfig.options.translateTo
    ? "Adjusts the complexity of the translated language."
    : "Adjusts the complexity of the original language.";
  const selectClassName = "w-full min-w-0 rounded-xl border border-border-strong bg-input px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[550px] gap-0 border-border-strong bg-card p-0 shadow-none"
        aria-describedby="editor-modal-description"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader className="shrink-0 border-b border-border px-6 pb-5 pt-6 sm:px-8">
          <span className="text-sm text-tertiary">{mode === "edit" ? "Edit assistant" : "Add assistant"}</span>
          <SheetTitle ref={titleRef} tabIndex={-1} id="editor-modal-title" className="text-2xl font-semibold tracking-tight">
            {mode === "edit" ? getAiRoleLabel(configData.aiRoleId) : "New AI Assistant"}
          </SheetTitle>
          <SheetDescription id="editor-modal-description" className="sr-only">
            Configure AI assistant settings including model, role, actions, style, and language options.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <fieldset className="border-none">
            <legend className="sr-only">Configuration Options</legend>

            {/* Base Setup */}
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-tertiary">Base setup</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="model"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    Model <InfoTooltip text={TOOLTIP_TEXTS.model} />
                  </label>
                  <select
                    id="model"
                    name="model"
                    value={editedConfig.model}
                    onChange={handleChange}
                    className={selectClassName}
                  >
                    {AVAILABLE_MODELS.map((m) => {
                      const isAvailable = tierLimits.availableModels.includes(m);
                      return (
                        <option
                          key={m}
                          value={m}
                          disabled={!isAvailable}
                        >
                          {MODEL_NAMES[m] ?? m}{!isAvailable ? ' (Unavailable)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="aiRoleId"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    AI role <InfoTooltip text={TOOLTIP_TEXTS.aiRole} position="left" />
                  </label>
                  <select
                    id="aiRoleId"
                    name="aiRoleId"
                    value={editedConfig.aiRoleId}
                    onChange={handleChange}
                    className={selectClassName}
                  >
                    {AVAILABLE_AI_ROLES.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-tertiary">Actions</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(OPTIONS_CHECKBOXES).map(([key, label]) => {
                  const checked = Boolean(editedConfig.options[key]);
                  return (
                  <div key={key} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm ${checked ? 'border-violet-border bg-violet-surface/70 text-foreground' : 'border-border-strong bg-input text-muted-foreground'}`}>
                    <label htmlFor={key} className="flex flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        id={key}
                        name={key}
                        checked={editedConfig.options[key] as boolean}
                        onChange={handleChange}
                        className="size-5 shrink-0 cursor-pointer rounded border border-border-strong bg-surface accent-primary focus-visible:outline-2 focus-visible:outline-primary"
                      />
                      <span>{label}</span>
                    </label>
                    <InfoTooltip text={TOOLTIP_TEXTS[key as keyof typeof TOOLTIP_TEXTS]} />
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Style */}
            <div className="mt-8">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-tertiary">Writing style</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="formality"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    Formality
                    <InfoTooltip text={TOOLTIP_TEXTS.formality} />
                  </label>
                  <select
                    id="formality"
                    name="formality"
                    value={editedConfig.options.formality}
                    onChange={handleChange}
                    className={selectClassName}
                  >
                    {FORMALITY.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="tone"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    Tone
                    <InfoTooltip text={TOOLTIP_TEXTS.tone} position="left" />
                  </label>
                  <select
                    id="tone"
                    name="tone"
                    value={editedConfig.options.tone}
                    onChange={handleChange}
                    className={selectClassName}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Language */}
            <div className="mt-8">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-tertiary">Language</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="languageLevel"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    Level
                    <InfoTooltip text={levelTooltipText} />
                  </label>
                  <select
                    id="languageLevel"
                    name="languageLevel"
                    value={editedConfig.options.languageLevel}
                    onChange={handleChange}
                    className={selectClassName}
                  >
                    {LANGUAGE_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="translateTo"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    Translate to
                    <InfoTooltip text={TOOLTIP_TEXTS.translateTo} position="left" />
                  </label>
                  <select
                    id="translateTo"
                    name="translateTo"
                    value={editedConfig.options.translateTo}
                    onChange={handleChange}
                    className={selectClassName}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </fieldset>
        </div>

        <SheetFooter className="shrink-0 border-t border-border bg-card px-6 py-4 sm:px-8">
          <div className="flex justify-end gap-3 w-full">
            <Button
              onClick={handleClose}
              variant="secondary"
              className="h-10 cursor-pointer border border-border-strong bg-surface px-4 text-foreground hover:bg-surface-hover"
              title="Discard changes and close editor"
              type="button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveClick}
              disabled={isSaveDisabled}
              className="h-10 cursor-pointer bg-primary px-4 text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              title={
                isSaveDisabled ? "No changes to save" : "Save this configuration"
              }
              type="button"
            >
              Save changes
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
