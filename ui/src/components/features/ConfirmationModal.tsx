"use client";

import { useEffect } from "react";
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
 * Props for the ConfirmationModal component
 */
interface ConfirmationModalProps {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Callback fired when the modal should close (cancel action) */
  onClose: () => void;
  /** Callback fired when the user confirms the deletion */
  onConfirm: () => void;
  /** Name of the workflow to be deleted */
  workflowName: string;
}

/**
 * ConfirmationModal Component
 * 
 * A modal dialog for confirming workflow deletion.
 * Features:
 * - Fade-in animation on open
 * - Close on Escape key (handled by Radix UI Dialog)
 * - Click overlay to close
 * - Cancel and Delete buttons with appropriate styling
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  workflowName,
}: ConfirmationModalProps) {
  // Handle Escape key (redundant with Radix UI but added for clarity)
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-[500px] bg-card border-border"
        aria-describedby="confirm-modal-description"
      >
        <DialogHeader>
          <DialogTitle id="confirm-modal-title" className="text-xl font-semibold">
            Confirm Deletion
          </DialogTitle>
          <DialogDescription id="confirm-modal-description" className="text-base pt-4">
            Are you sure you want to delete the workflow{" "}
            <strong className="text-foreground font-semibold">&quot;{workflowName}&quot;</strong>? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 gap-3 sm:gap-3">
          <Button
            data-testid="cancel-delete-button"
            onClick={onClose}
            variant="secondary"
            className="bg-muted hover:bg-muted-foreground/20 text-foreground cursor-pointer"
            title="Cancel deletion"
            type="button"
          >
            Cancel
          </Button>
          <Button
            data-testid="confirm-delete-button"
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
            title="Confirm deletion"
            type="button"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
