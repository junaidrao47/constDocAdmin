"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { messageForError } from "@/lib/errors";
import { useListQuery } from "@/lib/use-list-query";

/**
 * One editable pricing rule's field. All values move through the form as strings (so a blank
 * numeric input is just `""`, never `NaN`); `toBody` on the parent does the Number()/null
 * conversion the API expects.
 */
export interface RuleField {
  name: string;
  label: string;
  kind: "text" | "number";
  step?: string;
  min?: number;
  /** false = optional text; a number field with `nullable` may be left blank (→ null). */
  required?: boolean;
  nullable?: boolean;
  placeholder?: string;
  help?: string;
}

export interface RuleCrudProps<T extends { id: string; isActive?: boolean }> {
  title: string;
  description: string;
  noun: string;
  /** API base path, e.g. "/admin/industries". */
  endpoint: string;
  queryKey: string;
  columns: Column<T>[];
  fields: RuleField[];
  toForm: (row: T) => Record<string, string>;
  toBody: (values: Record<string, string>) => Record<string, unknown>;
  /** Called after any create/update/status change so the live preview can recompute. */
  onChanged?: () => void;
}

type FormValues = Record<string, string>;

function buildSchema(fields: RuleField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.kind === "number") {
      const numeric = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
      if (field.nullable) {
        shape[field.name] = z
          .string()
          .trim()
          .refine((v) => v === "" || numeric(v), `${field.label} must be a number`)
          .refine((v) => v === "" || Number(v) >= (field.min ?? -Infinity), `${field.label} is too small`);
      } else {
        shape[field.name] = z
          .string()
          .trim()
          .min(1, `${field.label} is required`)
          .refine(numeric, `${field.label} must be a number`)
          .refine((v) => Number(v) >= (field.min ?? -Infinity), `${field.label} is too small`);
      }
    } else {
      const base = z.string().trim();
      shape[field.name] = field.required === false ? base : base.min(1, `${field.label} is required`);
    }
  }
  return z.object(shape);
}

export function RuleCrud<T extends { id: string; isActive?: boolean }>(props: RuleCrudProps<T>) {
  const { title, description, noun, endpoint, queryKey, columns, fields, toForm, toBody, onChanged } = props;
  const client = useQueryClient();
  const [editing, setEditing] = useState<T | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusTarget, setStatusTarget] = useState<T | null>(null);

  const schema = useMemo(() => buildSchema(fields), [fields]);
  const emptyForm = useMemo<FormValues>(
    () => Object.fromEntries(fields.map((f) => [f.name, ""])),
    [fields],
  );

  const list = useListQuery<T>({ key: queryKey, path: endpoint, mode: "client" });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: emptyForm,
  });

  function refresh() {
    void client.invalidateQueries({ queryKey: [queryKey] });
    onChanged?.();
  }

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const body = JSON.stringify(toBody(values));
      return editing
        ? apiRequest<T>(`${endpoint}/${editing.id}`, { method: "PATCH", body })
        : apiRequest<T>(endpoint, { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? `${title} updated.` : `${title} created.`);
      close();
      refresh();
    },
  });

  const setStatus = useMutation({
    mutationFn: ({ row, isActive }: { row: T; isActive: boolean }) =>
      apiRequest(`${endpoint}/${row.id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: (_r, variables) => {
      toast.success(variables.isActive ? "Restored." : "Deactivated.");
      setStatusTarget(null);
      refresh();
    },
    onError: (error: unknown) => toast.error(messageForError(error, "Could not update.")),
  });

  function openCreate() {
    setEditing(null);
    save.reset();
    form.reset(emptyForm);
    setShowForm(true);
  }
  function openEdit(row: T) {
    setEditing(row);
    save.reset();
    form.reset({ ...emptyForm, ...toForm(row) });
    setShowForm(true);
  }
  function close() {
    setShowForm(false);
    setEditing(null);
    save.reset();
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        <Button onClick={openCreate} className="shrink-0">
          New {noun}
        </Button>
      </div>

      <DataTable
        columns={columns}
        state={list}
        rowKey={(row) => row.id}
        noun={noun}
        emptyMessage={`No ${noun}s yet. Create one to get started.`}
        actions={(row) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
              Edit
            </Button>
            {row.isActive !== undefined && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setStatus.reset();
                  setStatusTarget(row);
                }}
              >
                {row.isActive ? "Deactivate" : "Restore"}
              </Button>
            )}
          </div>
        )}
      />

      <FormDialog
        open={showForm}
        onOpenChange={(open) => !open && close()}
        title={editing ? `Edit ${noun}` : `New ${noun}`}
        description={description}
        form={form}
        onSubmit={(values) => save.mutate(values)}
        submitLabel={editing ? "Save changes" : `Create ${noun}`}
        isPending={save.isPending}
        error={save.error ?? undefined}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.name} className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor={`rule-${field.name}`}>
                {field.label}
              </label>
              <Input
                id={`rule-${field.name}`}
                type={field.kind === "number" ? "number" : "text"}
                step={field.step}
                min={field.min}
                placeholder={field.placeholder}
                {...form.register(field.name)}
              />
              {field.help && <span className="text-xs text-muted-foreground">{field.help}</span>}
              {form.formState.errors[field.name] && (
                <span className="text-xs text-destructive">
                  {String(form.formState.errors[field.name]?.message ?? "")}
                </span>
              )}
            </div>
          ))}
        </div>
      </FormDialog>

      {statusTarget && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setStatusTarget(null)}
          title={statusTarget.isActive ? `Deactivate this ${noun}?` : `Restore this ${noun}?`}
          description={
            statusTarget.isActive
              ? `It will no longer affect the calculator or public catalogue.`
              : `It will be used again by the calculator.`
          }
          confirmLabel={statusTarget.isActive ? "Deactivate" : "Restore"}
          variant={statusTarget.isActive ? "destructive" : "default"}
          isPending={setStatus.isPending}
          error={setStatus.error ?? undefined}
          onConfirm={() => setStatus.mutate({ row: statusTarget, isActive: !statusTarget.isActive })}
        />
      )}
    </div>
  );
}
