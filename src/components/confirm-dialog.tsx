"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  isPending?: boolean;
  /** A failed attempt. Rendered in place; the dialog deliberately stays open. */
  error?: unknown;
  /**
   * Optional extra input gathered alongside the confirmation — a rejection reason, a
   * status-change note. Kept here rather than in a second dialog so the user types the
   * reason and confirms in one step.
   */
  children?: React.ReactNode;
}

/**
 * Confirmation for an action that cannot be undone from the UI.
 *
 * The confirm button is a plain `Button`, not `AlertDialogAction`: Radix's action
 * closes the dialog on click, which would throw away the server's reason for
 * refusing. The caller closes this on success instead.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = "default",
  onConfirm,
  isPending = false,
  error,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {error !== undefined && error !== null && (
          <p
            role="alert"
            className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {errorMessage(error, "The action could not be completed.")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button variant={variant} disabled={isPending} onClick={onConfirm}>
            {isPending ? "Working..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
