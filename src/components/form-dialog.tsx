"use client";

import { useEffect } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, errorMessage } from "@/lib/api";

export interface FormDialogProps<T extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  onSubmit: (values: T) => void;
  submitLabel: string;
  isPending?: boolean;
  /** The last failed submission. Field errors land on their field; the rest shows above the footer. */
  error?: unknown;
  /** The form's inputs. Laid out by the caller, validated by its zod resolver. */
  children: React.ReactNode;
}

/**
 * A create/edit form in a dialog, per the repo rule "RHF + Zod, show server errors
 * inline". Errors stay in the dialog rather than becoming a toast, because the ones
 * that matter here — a 409 on delete, a worker-range overlap — tell the user which
 * field to change, and a message that disappears on a timer cannot do that.
 */
export function FormDialog<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  form,
  onSubmit,
  submitLabel,
  isPending = false,
  error,
  children,
}: FormDialogProps<T>) {
  // Field errors from the API are placed on their own field, so they render next to the
  // input the server objected to instead of as one opaque sentence at the bottom.
  useEffect(() => {
    if (!(error instanceof ApiError) || !error.fieldErrors) return;

    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (messages?.length) {
        form.setError(field as Path<T>, { type: "server", message: messages[0] });
      }
    }
  }, [error, form]);

  const unfieldedError =
    error instanceof ApiError && error.fieldErrors && Object.keys(error.fieldErrors).length > 0
      ? undefined
      : error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {children}
          {unfieldedError !== undefined && unfieldedError !== null && (
            <p
              role="alert"
              className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errorMessage(unfieldedError, "The form could not be saved.")}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
