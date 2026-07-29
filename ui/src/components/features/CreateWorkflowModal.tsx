"use client";

import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Props for the CreateWorkflowModal component
 */
interface CreateWorkflowModalProps {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Callback fired when the modal should close */
  onClose: () => void;
  /** Callback fired when a new workflow is created with the workflow name */
  onCreate: (name: string) => void;
  /** Array of existing workflow names for duplicate validation */
  existingWorkflowNames: string[];
}

/**
 * CreateWorkflowModal Component
 * 
 * A modal dialog for creating new workflows with validation.
 * Features:
 * - Auto-focus input field on open
 * - Real-time validation (empty name, duplicate check - case-insensitive)
 * - Error message display
 * - Create button disabled when validation fails
 * - Fade-in animation on open
 * - Close on Escape key
 */
export function CreateWorkflowModal({
  isOpen,
  onClose,
  onCreate,
  existingWorkflowNames,
}: CreateWorkflowModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setError("");
      // Auto-focus the input with a slight delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Validate workflow name on change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);

    if (!newName.trim()) {
      setError("Workflow name cannot be empty.");
    } else if (
      existingWorkflowNames.some(
        (existing) => existing.toLowerCase() === newName.trim().toLowerCase()
      )
    ) {
      setError("A workflow with this name already exists.");
    } else {
      setError("");
    }
  };

  // Handle Create button click
  const handleCreateClick = () => {
    const trimmedName = name.trim();
    if (!error && trimmedName) {
      onCreate(trimmedName);
      onClose();
    }
  };

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

  // Handle Enter key to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !error && name.trim()) {
      handleCreateClick();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-[500px] bg-card border-border"
        aria-describedby="create-modal-description"
      >
        <DialogHeader>
          <DialogTitle id="create-modal-title" className="text-xl font-semibold">
            Create New Workflow
          </DialogTitle>
          <DialogDescription id="create-modal-description" className="sr-only">
            Enter a unique name for your new workflow configuration
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-2">
            <label
              htmlFor="newWorkflowName"
              className="text-sm font-medium flex items-center gap-2"
            >
              Workflow Name
            </label>
            <input
              ref={inputRef}
              type="text"
              id="newWorkflowName"
              data-testid="workflow-name-input"
              value={name}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter workflow name"
              aria-describedby="workflow-name-error"
              autoFocus
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors"
            />
            {error && (
              <p id="workflow-name-error" className="text-destructive text-sm min-h-[1.2rem] mt-1">
                {error}
              </p>
            )}
            {!error && (
              <div className="min-h-[1.2rem]" />
            )}
          </div>
        </div>

        <DialogFooter className="gap-3 sm:gap-3">
          <Button
            data-testid="cancel-workflow-button"
            onClick={onClose}
            variant="secondary"
            className="bg-muted hover:bg-muted-foreground/20 text-foreground cursor-pointer"
            title="Cancel creation"
            type="button"
          >
            Cancel
          </Button>
          <Button
            data-testid="create-workflow-submit"
            onClick={handleCreateClick}
            disabled={!!error || !name.trim()}
            className="bg-primary hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed cursor-pointer"
            title={error || !name.trim() ? "Please enter a valid workflow name" : "Create the new workflow"}
            type="button"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
