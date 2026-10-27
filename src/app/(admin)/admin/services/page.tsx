"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm, type Control } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { PageHeader } from "@/components/page-header";
import { RequirementsEditor } from "@/components/requirements-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { messageForError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { resolveImageUrl } from "@/lib/media";
import type { Category, Service } from "@/lib/types";
import { uploadWithProgress } from "@/lib/upload";
import { useListQuery } from "@/lib/use-list-query";

// react-hook-form's useFieldArray needs object items, so the bullet list is modelled as
// `{ value }[]` in the form and flattened to `string[]` on submit.
const includedItemSchema = z.object({ value: z.string().trim().max(200, "Keep it under 200 characters") });
const processStepSchema = z.object({
  title: z.string().trim().max(150, "Keep the title short"),
  description: z.string().trim().max(500, "Keep the description under 500 characters"),
});

const serviceFormSchema = z.object({
  categoryId: z.string().uuid("A category is required"),
  nameEn: z.string().trim().min(1, "English name is required").max(150, "Name is too long"),
  nameEs: z.string().trim().min(1, "Spanish name is required").max(150, "Name is too long"),
  descriptionEn: z.string().trim().max(2000, "Description is too long"),
  descriptionEs: z.string().trim().max(2000, "Description is too long"),
  whatsIncludedEn: z.array(includedItemSchema).max(20),
  whatsIncludedEs: z.array(includedItemSchema).max(20),
  processStepsEn: z.array(processStepSchema).max(12),
  processStepsEs: z.array(processStepSchema).max(12),
  basePrice: z
    .number({ message: "Enter a base price" })
    .min(0, "Price cannot be negative")
    .max(999999999.99, "Price is too large"),
});

type ServiceFormValues = z.infer<typeof serviceFormSchema>;

const EMPTY_FORM: ServiceFormValues = {
  categoryId: "",
  nameEn: "",
  nameEs: "",
  descriptionEn: "",
  descriptionEs: "",
  whatsIncludedEn: [],
  whatsIncludedEs: [],
  processStepsEn: [],
  processStepsEs: [],
  basePrice: 0,
};

function toFormValues(service: Service): ServiceFormValues {
  return {
    categoryId: service.categoryId ?? "",
    nameEn: service.nameEn ?? service.name,
    nameEs: service.nameEs ?? service.name,
    descriptionEn: service.descriptionEn ?? service.description ?? "",
    descriptionEs: service.descriptionEs ?? "",
    whatsIncludedEn: (service.whatsIncludedEn ?? []).map((value) => ({ value })),
    whatsIncludedEs: (service.whatsIncludedEs ?? []).map((value) => ({ value })),
    processStepsEn: (service.processStepsEn ?? []).map((s) => ({ title: s.title, description: s.description })),
    processStepsEs: (service.processStepsEs ?? []).map((s) => ({ title: s.title, description: s.description })),
    basePrice: service.basePrice,
  };
}

function nullIfBlank(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

/** Drop blank bullet lines and trim; the API rejects empty strings. */
function cleanIncluded(items: { value: string }[]): string[] {
  return items.map((i) => i.value.trim()).filter((v) => v.length > 0);
}

/** Keep only steps that have a title; a step with no title has nothing to render. */
function cleanSteps(steps: { title: string; description: string }[]) {
  return steps
    .map((s) => ({ title: s.title.trim(), description: s.description.trim() }))
    .filter((s) => s.title.length > 0);
}

export default function AdminServicesPage() {
  const client = useQueryClient();
  const { session } = useAuth();
  const token = session?.accessToken ?? null;
  const [editing, setEditing] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Service | null>(null);
  const [requirementsFor, setRequirementsFor] = useState<Service | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => apiRequest<Category[]>("/admin/categories"),
  });
  const categoryName = (id: string | null | undefined) =>
    categories.data?.find((c) => c.id === id)?.nameEn ?? "—";
  const activeCategories = (categories.data ?? []).filter((c) => c.isActive);
  const hasCategories = (categories.data ?? []).length > 0;

  const list = useListQuery<Service>({
    key: "admin-services",
    path: "/admin/services",
    mode: "client",
    clientFilter: categoryFilter === "all" ? undefined : (row) => row.categoryId === categoryFilter,
    clientFilterKey: categoryFilter,
  });

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const save = useMutation({
    mutationFn: (values: ServiceFormValues) => {
      // `name` is the backend's canonical unique key; it tracks the English name.
      const body = JSON.stringify({
        name: values.nameEn,
        nameEn: values.nameEn,
        nameEs: values.nameEs,
        description: nullIfBlank(values.descriptionEn),
        descriptionEn: nullIfBlank(values.descriptionEn),
        descriptionEs: nullIfBlank(values.descriptionEs),
        whatsIncludedEn: cleanIncluded(values.whatsIncludedEn),
        whatsIncludedEs: cleanIncluded(values.whatsIncludedEs),
        processStepsEn: cleanSteps(values.processStepsEn),
        processStepsEs: cleanSteps(values.processStepsEs),
        basePrice: values.basePrice,
        categoryId: values.categoryId,
      });
      return editing
        ? apiRequest<Service>(`/admin/services/${editing.id}`, { method: "PATCH", body })
        : apiRequest<Service>("/admin/services", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Service updated." : "Service created.");
      closeForm();
      void client.invalidateQueries({ queryKey: ["admin-services"] });
    },
  });

  const setStatus = useMutation({
    mutationFn: ({ service, isActive }: { service: Service; isActive: boolean }) =>
      apiRequest(`/admin/services/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (_result, variables) => {
      toast.success(variables.isActive ? "Service restored." : "Service deactivated.");
      setStatusTarget(null);
      void client.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onError: (error: unknown) => toast.error(messageForError(error, "Could not update the service.")),
  });

  // Image upload mirrors packages: available only when editing an existing service (needs an
  // id). The server returns the updated service, which replaces `editing` so the preview
  // updates without a refetch; the list is invalidated so its rows pick it up too.
  const uploadImage = useMutation({
    mutationFn: (file: File) =>
      uploadWithProgress<Service>({ path: `/admin/services/${editing!.id}/image`, file, field: "image", token }),
    onSuccess: (updated) => {
      toast.success("Image updated.");
      setEditing(updated);
      void client.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not upload the image.")),
  });

  const removeImage = useMutation({
    mutationFn: () => apiRequest<Service>(`/admin/services/${editing!.id}/image`, { method: "DELETE" }),
    onSuccess: (updated) => {
      toast.success("Image removed.");
      setEditing(updated);
      void client.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not remove the image.")),
  });

  function openCreate() {
    setEditing(null);
    save.reset();
    form.reset(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(service: Service) {
    setEditing(service);
    save.reset();
    form.reset(toFormValues(service));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    save.reset();
  }

  const columns: Column<Service>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <>
          <p className="font-medium">{row.nameEn ?? row.name}</p>
          {row.nameEs && row.nameEs !== (row.nameEn ?? row.name) && (
            <p className="text-xs text-muted-foreground">{row.nameEs}</p>
          )}
        </>
      ),
      sortKey: "name",
    },
    {
      id: "category",
      header: "Category",
      cell: (row) => categoryName(row.categoryId),
      hideBelow: "md",
    },
    {
      id: "price",
      header: "Base price",
      cell: (row) => formatMoney(row.basePrice),
      sortKey: "basePrice",
      align: "right",
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={row.isActive ? "secondary" : "outline"}>
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Catalogue"
        title="Services"
        description="Compliance services customers can buy. Each belongs to one category and can carry a required-documents checklist."
        actions={<Button onClick={openCreate}>New service</Button>}
      />

      {hasCategories && (
        <div className="mb-5 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Category</span>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-56" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories.data ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.nameEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <DataTable
        columns={columns}
        state={list}
        rowKey={(row) => row.id}
        noun="service"
        emptyMessage="No services match. Create one to get started."
        actions={(row) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRequirementsFor(row)}>
              Required documents
            </Button>
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
          </div>
        )}
      />

      <FormDialog
        open={showForm}
        onOpenChange={(open) => !open && closeForm()}
        title={editing ? "Edit service" : "New service"}
        description="A service belongs to one category. Name it in both languages."
        form={form}
        onSubmit={(values) => save.mutate(values)}
        submitLabel={editing ? "Save changes" : "Create service"}
        isPending={save.isPending}
        error={save.error ?? undefined}
      >
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="service-category">
            Category
          </label>
          {hasCategories ? (
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="service-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No categories exist yet.{" "}
              <Link href="/admin/categories" className="font-medium text-primary underline">
                Create a category first
              </Link>
              .
            </p>
          )}
          {form.formState.errors.categoryId && (
            <span className="text-xs text-destructive">
              {form.formState.errors.categoryId.message}
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="service-name-en">
              Name (English)
            </label>
            <Input id="service-name-en" {...form.register("nameEn")} />
            {form.formState.errors.nameEn && (
              <span className="text-xs text-destructive">{form.formState.errors.nameEn.message}</span>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="service-name-es">
              Name (Spanish)
            </label>
            <Input id="service-name-es" {...form.register("nameEs")} />
            {form.formState.errors.nameEs && (
              <span className="text-xs text-destructive">{form.formState.errors.nameEs.message}</span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="service-desc-en">
              Description (English)
            </label>
            <Textarea id="service-desc-en" rows={2} {...form.register("descriptionEn")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="service-desc-es">
              Description (Spanish)
            </label>
            <Textarea id="service-desc-es" rows={2} {...form.register("descriptionEs")} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Card & detail image</span>
          {editing ? (
            <div className="rounded-md border border-border p-3">
              {resolveImageUrl(editing.imageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveImageUrl(editing.imageUrl)!} alt="" className="mb-3 h-32 w-full rounded object-cover" />
              ) : (
                <p className="mb-3 text-sm text-muted-foreground">
                  No image yet. The public card uses the category image until you upload one.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
                  {uploadImage.isPending ? "Uploading…" : editing.imageUrl ? "Replace image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploadImage.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage.mutate(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {editing.imageUrl && (
                  <Button type="button" variant="outline" size="sm" disabled={removeImage.isPending} onClick={() => removeImage.mutate()}>
                    {removeImage.isPending ? "Removing…" : "Remove"}
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">JPG, PNG or WebP, up to 8MB. A 16:9 image looks best.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Save the service first, then edit it to upload an image.</p>
          )}
        </div>

        <div className="grid gap-4 rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-semibold">What&apos;s included</p>
            <p className="text-xs text-muted-foreground">
              Bullet points shown on the public service page — what the customer gets for the price.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <IncludedListField control={form.control} name="whatsIncludedEn" label="English" placeholder="e.g. Document review by a specialist" />
            <IncludedListField control={form.control} name="whatsIncludedEs" label="Spanish" placeholder="p. ej. Revisión de documentos por un especialista" />
          </div>
        </div>

        <div className="grid gap-4 rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-semibold">How it works after you buy</p>
            <p className="text-xs text-muted-foreground">
              Numbered steps explaining what happens once the customer purchases this service.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProcessStepsField control={form.control} name="processStepsEn" label="English" />
            <ProcessStepsField control={form.control} name="processStepsEs" label="Spanish" />
          </div>
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="service-price">
            Base price (MXN)
          </label>
          <Input
            id="service-price"
            type="number"
            step="0.01"
            min="0"
            {...form.register("basePrice", { valueAsNumber: true })}
          />
          {form.formState.errors.basePrice && (
            <span className="text-xs text-destructive">
              {form.formState.errors.basePrice.message}
            </span>
          )}
        </div>
      </FormDialog>

      {requirementsFor && (
        <RequirementsEditor
          serviceId={requirementsFor.id}
          serviceName={requirementsFor.nameEn ?? requirementsFor.name}
          open
          onOpenChange={(open) => !open && setRequirementsFor(null)}
        />
      )}

      {statusTarget && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setStatusTarget(null)}
          title={statusTarget.isActive ? "Deactivate this service?" : "Restore this service?"}
          description={
            statusTarget.isActive
              ? `${statusTarget.nameEn ?? statusTarget.name} will be hidden from the catalogue and the calculator.`
              : `${statusTarget.nameEn ?? statusTarget.name} will be available again.`
          }
          confirmLabel={statusTarget.isActive ? "Deactivate" : "Restore"}
          variant={statusTarget.isActive ? "destructive" : "default"}
          isPending={setStatus.isPending}
          error={setStatus.error ?? undefined}
          onConfirm={() => setStatus.mutate({ service: statusTarget, isActive: !statusTarget.isActive })}
        />
      )}
    </div>
  );
}

/** A repeatable bullet list (the "what's included" items) for one language. */
function IncludedListField({
  control,
  name,
  label,
  placeholder,
}: {
  control: Control<ServiceFormValues>;
  name: "whatsIncludedEn" | "whatsIncludedEs";
  label: string;
  placeholder: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <div className="grid gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Controller
            control={control}
            name={`${name}.${index}.value` as const}
            render={({ field: f }) => <Input {...f} placeholder={placeholder} />}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Remove item"
            onClick={() => remove(index)}
          >
            <X size={15} />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append({ value: "" })}>
        <Plus size={14} className="mr-1" /> Add item
      </Button>
    </div>
  );
}

/** A repeatable list of numbered { title, description } steps for one language. */
function ProcessStepsField({
  control,
  name,
  label,
}: {
  control: Control<ServiceFormValues>;
  name: "processStepsEn" | "processStepsEs";
  label: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <div className="grid gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {fields.map((field, index) => (
        <div key={field.id} className="grid gap-2 rounded-md border border-border p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <Controller
              control={control}
              name={`${name}.${index}.title` as const}
              render={({ field: f }) => <Input {...f} placeholder="Step title (e.g. You purchase)" />}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Remove step"
              onClick={() => remove(index)}
            >
              <X size={15} />
            </Button>
          </div>
          <Controller
            control={control}
            name={`${name}.${index}.description` as const}
            render={({ field: f }) => <Textarea rows={2} {...f} placeholder="What happens in this step" />}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append({ title: "", description: "" })}>
        <Plus size={14} className="mr-1" /> Add step
      </Button>
    </div>
  );
}
