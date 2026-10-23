"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { messageForError } from "@/lib/errors";
import type { Requirement } from "@/lib/types";

const requirementFormSchema = z.object({
  nameEn: z.string().trim().min(1, "English name is required").max(150, "Name is too long"),
  nameEs: z.string().trim().min(1, "Spanish name is required").max(150, "Name is too long"),
  descriptionEn: z.string().trim().max(2000, "Description is too long"),
  descriptionEs: z.string().trim().max(2000, "Description is too long"),
  isRequired: z.boolean(),
});

type RequirementFormValues = z.infer<typeof requirementFormSchema>;

const EMPTY_FORM: RequirementFormValues = {
  nameEn: "",
  nameEs: "",
  descriptionEn: "",
  descriptionEs: "",
  isRequired: true,
};

function nullIfBlank(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export interface RequirementsEditorProps {
  serviceId: string;
  serviceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "Required documents" editor for one service (PROJECT-BRIEF admin brief §4).
 *
 * Requirements are a sub-resource keyed by an existing service id, so this is opened from
 * a row action on a saved service, never during first create. Add / edit / delete and
 * up-down reordering all hit the admin requirement endpoints; reordering swaps the two
 * items' `sortOrder` values (there is no bulk reorder endpoint for requirements).
 */
export function RequirementsEditor({
  serviceId,
  serviceName,
  open,
  onOpenChange,
}: RequirementsEditorProps) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Requirement | null>(null);

  const query = useQuery({
    queryKey: ["service-requirements", serviceId],
    queryFn: () => apiRequest<Requirement[]>(`/admin/services/${serviceId}/requirements`),
    enabled: open,
  });
  const rows = [...(query.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const form = useForm<RequirementFormValues>({
    resolver: zodResolver(requirementFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const invalidate = () =>
    void client.invalidateQueries({ queryKey: ["service-requirements", serviceId] });

  const save = useMutation({
    mutationFn: (values: RequirementFormValues) => {
      const body = JSON.stringify({
        nameEn: values.nameEn,
        nameEs: values.nameEs,
        descriptionEn: nullIfBlank(values.descriptionEn),
        descriptionEs: nullIfBlank(values.descriptionEs),
        isRequired: values.isRequired,
        sortOrder: editing ? editing.sortOrder : rows.length,
      });
      return editing
        ? apiRequest<Requirement>(`/admin/requirements/${editing.id}`, { method: "PATCH", body })
        : apiRequest<Requirement>(`/admin/services/${serviceId}/requirements`, { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Requirement updated." : "Requirement added.");
      setEditing(null);
      form.reset(EMPTY_FORM);
      invalidate();
    },
    onError: (error: unknown) => toast.error(messageForError(error, "Could not save the requirement.")),
  });

  const remove = useMutation({
    mutationFn: (requirement: Requirement) =>
      apiRequest(`/admin/requirements/${requirement.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Requirement removed.");
      invalidate();
    },
    onError: (error: unknown) => toast.error(messageForError(error, "Could not remove the requirement.")),
  });

  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: Requirement; b: Requirement }) => {
      // Swap the two items' sort orders; the list re-sorts on `sortOrder`.
      await apiRequest(`/admin/requirements/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      });
      await apiRequest(`/admin/requirements/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      });
    },
    onSuccess: invalidate,
    onError: (error: unknown) => toast.error(messageForError(error, "Could not reorder.")),
  });

  function move(requirement: Requirement, direction: -1 | 1) {
    const index = rows.findIndex((r) => r.id === requirement.id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= rows.length) return;
    // Equal sortOrders would not swap visibly; nudge before swapping.
    const a = rows[index];
    const b = rows[target];
    reorder.mutate({ a, b: a.sortOrder === b.sortOrder ? { ...b, sortOrder: b.sortOrder + 1 } : b });
  }

  function startEdit(requirement: Requirement) {
    setEditing(requirement);
    save.reset();
    form.reset({
      nameEn: requirement.nameEn,
      nameEs: requirement.nameEs,
      descriptionEn: requirement.descriptionEn ?? "",
      descriptionEs: requirement.descriptionEs ?? "",
      isRequired: requirement.isRequired,
    });
  }

  function cancelEdit() {
    setEditing(null);
    save.reset();
    form.reset(EMPTY_FORM);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Required documents</SheetTitle>
          <SheetDescription>
            Documents customers must submit for <span className="font-medium">{serviceName}</span>.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-6">
          {query.isLoading && <p className="text-sm text-muted-foreground">Loading requirements…</p>}
          {query.isError && (
            <p
              role="alert"
              className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {messageForError(query.error, "Could not load the requirements.")}
            </p>
          )}
          {query.isSuccess && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No required documents yet. Add the first one below.
            </p>
          )}

          <ul className="grid gap-2">
            {rows.map((requirement, index) => (
              <li
                key={requirement.id}
                className="flex items-start justify-between gap-3 border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {requirement.nameEn}
                    {!requirement.isRequired && (
                      <span className="ml-2 text-xs text-muted-foreground">(optional)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{requirement.nameEs}</p>
                  {requirement.descriptionEn && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {requirement.descriptionEn}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`Move ${requirement.nameEn} up`}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(requirement, -1)}
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`Move ${requirement.nameEn} down`}
                    disabled={index === rows.length - 1 || reorder.isPending}
                    onClick={() => move(requirement, 1)}
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`Edit ${requirement.nameEn}`}
                    onClick={() => startEdit(requirement)}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    aria-label={`Remove ${requirement.nameEn}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(requirement)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <form
            className="grid gap-3 border-t border-border pt-4"
            onSubmit={form.handleSubmit((values) => save.mutate(values))}
            noValidate
          >
            <p className="text-sm font-semibold">{editing ? "Edit requirement" : "Add a requirement"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium" htmlFor="req-name-en">
                  Name (English)
                </label>
                <Input id="req-name-en" {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <span className="text-xs text-destructive">{form.formState.errors.nameEn.message}</span>
                )}
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium" htmlFor="req-name-es">
                  Name (Spanish)
                </label>
                <Input id="req-name-es" {...form.register("nameEs")} />
                {form.formState.errors.nameEs && (
                  <span className="text-xs text-destructive">{form.formState.errors.nameEs.message}</span>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium" htmlFor="req-desc-en">
                  Description (English)
                </label>
                <Textarea id="req-desc-en" rows={2} {...form.register("descriptionEn")} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium" htmlFor="req-desc-es">
                  Description (Spanish)
                </label>
                <Textarea id="req-desc-es" rows={2} {...form.register("descriptionEs")} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm" htmlFor="req-required">
              <Checkbox
                id="req-required"
                checked={form.watch("isRequired")}
                onCheckedChange={(next) => form.setValue("isRequired", next === true)}
              />
              Required document
            </label>
            <div className="flex justify-end gap-2">
              {editing && (
                <Button type="button" variant="outline" onClick={cancelEdit} disabled={save.isPending}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editing ? "Save requirement" : "Add requirement"}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
