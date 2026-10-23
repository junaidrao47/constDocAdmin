"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, ApiError } from "@/lib/api";
import { messageForError } from "@/lib/errors";
import type { Category, Package, Service } from "@/lib/types";
import { useListQuery } from "@/lib/use-list-query";

// Mirrors the backend CategoryCreateSchema bounds so a bad value is caught before the
// round trip; the server still validates and its field errors land inline via FormDialog.
const categoryFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(180, "Slug is too long")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
  nameEn: z.string().trim().min(1, "English name is required").max(150, "Name is too long"),
  nameEs: z.string().trim().min(1, "Spanish name is required").max(150, "Name is too long"),
  descriptionEn: z.string().trim().max(2000, "Description is too long"),
  descriptionEs: z.string().trim().max(2000, "Description is too long"),
  icon: z.string().trim().max(60, "Icon name is too long"),
  sortOrder: z
    .number({ message: "Enter a sort order" })
    .int("Whole number only")
    .min(0, "Cannot be negative")
    .max(100000, "Too large"),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

const EMPTY_FORM: CategoryFormValues = {
  slug: "",
  nameEn: "",
  nameEs: "",
  descriptionEn: "",
  descriptionEs: "",
  icon: "",
  sortOrder: 0,
};

function toFormValues(category: Category): CategoryFormValues {
  return {
    slug: category.slug,
    nameEn: category.nameEn,
    nameEs: category.nameEs,
    descriptionEn: category.descriptionEn ?? "",
    descriptionEs: category.descriptionEs ?? "",
    icon: category.icon ?? "",
    sortOrder: category.sortOrder,
  };
}

/** `""` would persist an empty string in a nullable column, so send null instead. */
function nullIfBlank(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export default function AdminCategoriesPage() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  // One page holds every category (there are only ever a handful), so `list.rows` is the
  // whole set — which the reorder action needs to send a complete ordered id list.
  const list = useListQuery<Category>({
    key: "admin-categories",
    path: "/admin/categories",
    mode: "client",
    pageSize: 1000,
  });

  // Item counts are not on the category payload, so they are derived from the two
  // catalogues that reference a category.
  const services = useQuery({
    queryKey: ["admin-services", "all"],
    queryFn: () => apiRequest<Service[]>("/admin/services"),
  });
  const packages = useQuery({
    queryKey: ["admin-packages"],
    queryFn: () => apiRequest<Package[]>("/admin/packages"),
  });
  const countFor = (categoryId: string) => {
    const serviceCount = (services.data ?? []).filter((s) => s.categoryId === categoryId).length;
    const packageCount = (packages.data ?? []).filter((p) => p.categoryId === categoryId).length;
    return { serviceCount, packageCount, total: serviceCount + packageCount };
  };

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const save = useMutation({
    mutationFn: (values: CategoryFormValues) => {
      const body = JSON.stringify({
        slug: values.slug,
        nameEn: values.nameEn,
        nameEs: values.nameEs,
        descriptionEn: nullIfBlank(values.descriptionEn),
        descriptionEs: nullIfBlank(values.descriptionEs),
        icon: nullIfBlank(values.icon),
        sortOrder: values.sortOrder,
      });
      return editing
        ? apiRequest<Category>(`/admin/categories/${editing.id}`, { method: "PATCH", body })
        : apiRequest<Category>("/admin/categories", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Category updated." : "Category created.");
      closeForm();
      void client.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    // No onError: FormDialog renders save.error in place and maps field errors onto fields.
  });

  const setStatus = useMutation({
    mutationFn: ({ category, isActive }: { category: Category; isActive: boolean }) =>
      apiRequest(`/admin/categories/${category.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (_result, variables) => {
      toast.success(variables.isActive ? "Category activated." : "Category deactivated.");
      setStatusTarget(null);
      setDeleteTarget(null);
      void client.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: (error: unknown) => toast.error(messageForError(error, "Could not update the category.")),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiRequest("/admin/categories/reorder", {
        method: "POST",
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin-categories"] }),
    onError: (error: unknown) => toast.error(messageForError(error, "Could not reorder categories.")),
  });

  const remove = useMutation({
    mutationFn: (category: Category) =>
      apiRequest(`/admin/categories/${category.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Category deleted.");
      setDeleteTarget(null);
      void client.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    // No onError: the ConfirmDialog stays open and shows the CATEGORY_NOT_EMPTY message.
  });

  function openCreate() {
    setEditing(null);
    save.reset();
    form.reset(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    save.reset();
    form.reset(toFormValues(category));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    save.reset();
  }

  function move(category: Category, direction: -1 | 1) {
    const rows = list.rows;
    const index = rows.findIndex((row) => row.id === category.id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= rows.length) return;
    const ids = rows.map((row) => row.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  }

  const deleteBlocked = remove.error instanceof ApiError && remove.error.code === "CATEGORY_NOT_EMPTY";

  const columns: Column<Category>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <>
          <p className="font-medium">{row.nameEn}</p>
          <p className="text-xs text-muted-foreground">{row.nameEs}</p>
        </>
      ),
    },
    { id: "slug", header: "Slug", cell: (row) => <span className="font-mono text-xs">{row.slug}</span>, hideBelow: "md" },
    {
      id: "icon",
      header: "Icon",
      cell: (row) =>
        row.icon ? (
          <span className="text-xs">{row.icon}</span>
        ) : (
          <span aria-hidden className="text-muted-foreground">
            —
          </span>
        ),
      hideBelow: "lg",
    },
    {
      id: "order",
      header: "Order",
      cell: (row) => {
        const index = list.rows.findIndex((r) => r.id === row.id);
        return (
          <div className="flex items-center gap-1">
            <span className="tabular-nums">{row.sortOrder}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              aria-label={`Move ${row.nameEn} up`}
              disabled={index <= 0 || reorder.isPending}
              onClick={() => move(row, -1)}
            >
              <ArrowUp size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              aria-label={`Move ${row.nameEn} down`}
              disabled={index === list.rows.length - 1 || reorder.isPending}
              onClick={() => move(row, 1)}
            >
              <ArrowDown size={14} />
            </Button>
          </div>
        );
      },
    },
    {
      id: "items",
      header: "Items",
      cell: (row) => {
        const { serviceCount, packageCount } = countFor(row.id);
        return (
          <span className="text-xs text-muted-foreground">
            {serviceCount} service{serviceCount === 1 ? "" : "s"} · {packageCount} package
            {packageCount === 1 ? "" : "s"}
          </span>
        );
      },
      hideBelow: "md",
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
        title="Categories"
        description="Every service and package belongs to exactly one category. Create categories before adding services or packages."
        actions={<Button onClick={openCreate}>New category</Button>}
      />

      <DataTable
        columns={columns}
        state={list}
        rowKey={(row) => row.id}
        noun="category"
        emptyMessage="No categories yet. Create the first one to start building the catalogue."
        actions={(row) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStatus.reset();
                setStatusTarget(row);
              }}
            >
              {row.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                remove.reset();
                setDeleteTarget(row);
              }}
            >
              Delete
            </Button>
          </div>
        )}
      />

      <FormDialog
        open={showForm}
        onOpenChange={(open) => !open && closeForm()}
        title={editing ? "Edit category" : "New category"}
        description="Bilingual name and a URL slug. Both languages are required."
        form={form}
        onSubmit={(values) => save.mutate(values)}
        submitLabel={editing ? "Save changes" : "Create category"}
        isPending={save.isPending}
        error={save.error ?? undefined}
      >
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="category-slug">
            Slug
          </label>
          <Input id="category-slug" placeholder="e.g. permits" {...form.register("slug")} />
          {form.formState.errors.slug && (
            <span className="text-xs text-destructive">{form.formState.errors.slug.message}</span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="category-name-en">
              Name (English)
            </label>
            <Input id="category-name-en" {...form.register("nameEn")} />
            {form.formState.errors.nameEn && (
              <span className="text-xs text-destructive">{form.formState.errors.nameEn.message}</span>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="category-name-es">
              Name (Spanish)
            </label>
            <Input id="category-name-es" {...form.register("nameEs")} />
            {form.formState.errors.nameEs && (
              <span className="text-xs text-destructive">{form.formState.errors.nameEs.message}</span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="category-desc-en">
              Description (English)
            </label>
            <Textarea id="category-desc-en" rows={2} {...form.register("descriptionEn")} />
            {form.formState.errors.descriptionEn && (
              <span className="text-xs text-destructive">
                {form.formState.errors.descriptionEn.message}
              </span>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="category-desc-es">
              Description (Spanish)
            </label>
            <Textarea id="category-desc-es" rows={2} {...form.register("descriptionEs")} />
            {form.formState.errors.descriptionEs && (
              <span className="text-xs text-destructive">
                {form.formState.errors.descriptionEs.message}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="category-icon">
              Icon (optional)
            </label>
            <Input id="category-icon" placeholder="e.g. file-text" {...form.register("icon")} />
            {form.formState.errors.icon && (
              <span className="text-xs text-destructive">{form.formState.errors.icon.message}</span>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="category-sort">
              Sort order
            </label>
            <Input
              id="category-sort"
              type="number"
              min="0"
              step="1"
              {...form.register("sortOrder", { valueAsNumber: true })}
            />
            {form.formState.errors.sortOrder && (
              <span className="text-xs text-destructive">
                {form.formState.errors.sortOrder.message}
              </span>
            )}
          </div>
        </div>
      </FormDialog>

      {statusTarget && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setStatusTarget(null)}
          title={statusTarget.isActive ? "Deactivate this category?" : "Activate this category?"}
          description={
            statusTarget.isActive
              ? `${statusTarget.nameEn} will be hidden from the public catalogue. Services and packages in it are unaffected.`
              : `${statusTarget.nameEn} will be available again.`
          }
          confirmLabel={statusTarget.isActive ? "Deactivate" : "Activate"}
          variant={statusTarget.isActive ? "destructive" : "default"}
          isPending={setStatus.isPending}
          error={setStatus.error ?? undefined}
          onConfirm={() => setStatus.mutate({ category: statusTarget, isActive: !statusTarget.isActive })}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete this category?"
          description={
            deleteBlocked
              ? messageForError(remove.error, "This category is still in use.")
              : `${deleteTarget.nameEn} will be permanently removed. This cannot be undone.`
          }
          confirmLabel={deleteBlocked ? "Deactivate instead" : "Delete category"}
          variant="destructive"
          isPending={deleteBlocked ? setStatus.isPending : remove.isPending}
          error={deleteBlocked ? undefined : (remove.error ?? undefined)}
          onConfirm={() =>
            deleteBlocked
              ? setStatus.mutate({ category: deleteTarget, isActive: false })
              : remove.mutate(deleteTarget)
          }
        />
      )}
    </div>
  );
}
