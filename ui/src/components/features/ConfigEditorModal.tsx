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
  FORMALITY_EMOJIS,
  TONES,
  TONE_EMOJIS,
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
  const modelSelectRef = useRef<HTMLSelectElement>(null);

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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px] bg-card border-border flex flex-col p-0"
        aria-describedby="editor-modal-description"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          modelSelectRef.current?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader className="px-8 pt-6 pb-4 border-b border-border flex-shrink-0">
          <SheetTitle id="editor-modal-title" className="text-xl font-semibold flex items-center gap-2">
            {mode === "edit"
              ? `Editing: ${getAiRoleLabel(configData.aiRoleId)}`
              : "Add New Assistant"}
          </SheetTitle>
          <SheetDescription id="editor-modal-description" className="sr-only">
            Configure AI assistant settings including model, role, actions, style, and language options.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <fieldset className="border-none">
            <legend className="sr-only">Configuration Options</legend>

            {/* Base Setup */}
            <div className="py-6 first:pt-0">
              <h4 className="text-base font-semibold mb-4">Base Setup</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="model"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    Model <InfoTooltip text={TOOLTIP_TEXTS.model} />
                  </label>
                  <select
                    id="model"
                    name="model"
                    ref={modelSelectRef}
                    value={editedConfig.model}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors"
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
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    AI Role <InfoTooltip text={TOOLTIP_TEXTS.aiRole} position="left" />
                  </label>
                  <select
                    id="aiRoleId"
                    name="aiRoleId"
                    value={editedConfig.aiRoleId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors"
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
            <div className="py-6 border-t border-border">
              <h4 className="text-base font-semibold mb-4">Actions</h4>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(OPTIONS_CHECKBOXES).map(([key, label], index) => (
                  <div key={key} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={key}
                      name={key}
                      checked={editedConfig.options[key] as boolean}
                      onChange={handleChange}
                      className="mt-1 w-4 h-4 rounded border-border bg-background checked:bg-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor={key}
                      className="text-sm flex items-center gap-1 cursor-pointer"
                    >
                      {label}
                      <InfoTooltip
                        text={TOOLTIP_TEXTS[key as keyof typeof TOOLTIP_TEXTS]}
                        position={(index + 1) % 3 === 0 ? "left" : "right"}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Style */}
            <div className="py-6 border-t border-border">
              <h4 className="text-base font-semibold mb-4">Style</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="formality"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    Formality {FORMALITY_EMOJIS[editedConfig.options.formality]}
                    <InfoTooltip text={TOOLTIP_TEXTS.formality} />
                  </label>
                  <select
                    id="formality"
                    name="formality"
                    value={editedConfig.options.formality}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors"
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
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    Tone {TONE_EMOJIS[editedConfig.options.tone]}
                    <InfoTooltip text={TOOLTIP_TEXTS.tone} position="left" />
                  </label>
                  <select
                    id="tone"
                    name="tone"
                    value={editedConfig.options.tone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors"
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
            <div className="py-6 border-t border-border">
              <h4 className="text-base font-semibold mb-4">Language</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="languageLevel"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    Level
                    <InfoTooltip text={levelTooltipText} />
                  </label>
                  <select
                    id="languageLevel"
                    name="languageLevel"
                    value={editedConfig.options.languageLevel}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors"
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
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    Translate to
                    <InfoTooltip text={TOOLTIP_TEXTS.translateTo} position="left" />
                  </label>
                  <select
                    id="translateTo"
                    name="translateTo"
                    value={editedConfig.options.translateTo}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors"
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

        <SheetFooter className="px-8 py-4 border-t border-border flex-shrink-0">
          <div className="flex justify-end gap-3 w-full">
            <Button
              onClick={handleClose}
              variant="secondary"
              className="bg-muted hover:bg-muted-foreground/20 text-foreground cursor-pointer"
              title="Discard changes and close editor"
              type="button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveClick}
              disabled={isSaveDisabled}
              className="bg-primary hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed cursor-pointer"
              title={
                isSaveDisabled ? "No changes to save" : "Save this configuration"
              }
              type="button"
            >
              Save Changes
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
