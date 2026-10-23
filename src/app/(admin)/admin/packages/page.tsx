"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Category, Package, Service } from "@/lib/types";
import { useListQuery } from "@/lib/use-list-query";

// Mirrors the server's PackageSchema bounds so a bad value is caught before the round
// trip; the server still validates, and its field errors land inline via FormDialog.
// isActive is deliberately absent — retiring is the separate Deactivate action.
const packageFormSchema = z.object({
  categoryId: z.string().uuid("A category is required"),
  nameEn: z.string().trim().min(1, "English name is required").max(150, "Name is too long"),
  nameEs: z.string().trim().min(1, "Spanish name is required").max(150, "Name is too long"),
  type: z.string().trim().min(1, "Type is required").max(50, "Type is too long"),
  price: z
    .number({ message: "Enter a price" })
    .min(0, "Price cannot be negative")
    .max(999999999.99, "Price is too large"),
  durationDays: z
    .number({ message: "Enter a duration" })
    .int("Duration must be a whole number")
    .min(1, "Duration must be at least 1 day")
    .max(3650, "Duration cannot exceed 3650 days"),
  descriptionEn: z.string().trim().max(2000, "Description is too long"),
  descriptionEs: z.string().trim().max(2000, "Description is too long"),
  sortOrder: z
    .number({ message: "Enter a sort order" })
    .int("Sort order must be a whole number")
    .min(0, "Sort order cannot be negative")
    .max(100000, "Sort order is too large"),
  isFeatured: z.boolean(),
  serviceIds: z.array(z.string().uuid()).max(100, "Too many services selected"),
});

type PackageFormValues = z.infer<typeof packageFormSchema>;

const EMPTY_FORM: PackageFormValues = {
  categoryId: "",
  nameEn: "",
  nameEs: "",
  type: "",
  price: 0,
  durationDays: 30,
  descriptionEn: "",
  descriptionEs: "",
  sortOrder: 0,
  isFeatured: false,
  serviceIds: [],
};

function toFormValues(pkg: Package): PackageFormValues {
  return {
    categoryId: pkg.categoryId ?? "",
    nameEn: pkg.nameEn ?? pkg.name,
    nameEs: pkg.nameEs ?? pkg.name,
    type: pkg.type,
    price: pkg.price,
    durationDays: pkg.durationDays,
    descriptionEn: pkg.descriptionEn ?? pkg.description ?? "",
    descriptionEs: pkg.descriptionEs ?? "",
    sortOrder: pkg.sortOrder,
    isFeatured: pkg.isFeatured,
    serviceIds: pkg.services.map((service) => service.id),
  };
}

function nullIfBlank(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export default function AdminPackagesPage() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Package | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Package | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // A bare array with neither pagination nor sort server-side, so client mode: fetch once,
  // sort name/price in memory.
  const list = useListQuery<Package>({
    key: "admin-packages",
    path: "/admin/packages",
    mode: "client",
    clientFilter: categoryFilter === "all" ? undefined : (row) => row.categoryId === categoryFilter,
    clientFilterKey: categoryFilter,
  });

  // Only active services can be attached — the API rejects inactive ids with a 400 — so
  // the picker never offers one that would bounce the whole save.
  const services = useQuery({
    queryKey: ["admin-services", "active"],
    queryFn: () => apiRequest<Service[]>("/admin/services?isActive=true"),
  });

  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => apiRequest<Category[]>("/admin/categories"),
  });
  const categoryName = (id: string | null | undefined) =>
    categories.data?.find((c) => c.id === id)?.nameEn ?? "—";
  const activeCategories = (categories.data ?? []).filter((c) => c.isActive);
  const hasCategories = (categories.data ?? []).length > 0;

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const save = useMutation({
    mutationFn: (values: PackageFormValues) => {
      // `name` is the backend's canonical unique key; it tracks the English name.
      const body = JSON.stringify({
        name: values.nameEn,
        nameEn: values.nameEn,
        nameEs: values.nameEs,
        type: values.type,
        price: values.price,
        durationDays: values.durationDays,
        serviceIds: values.serviceIds,
        categoryId: values.categoryId,
        description: nullIfBlank(values.descriptionEn),
        descriptionEn: nullIfBlank(values.descriptionEn),
        descriptionEs: nullIfBlank(values.descriptionEs),
        sortOrder: values.sortOrder,
        isFeatured: values.isFeatured,
      });
      return editing
        ? apiRequest<Package>(`/admin/packages/${editing.id}`, { method: "PATCH", body })
        : apiRequest<Package>("/admin/packages", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Package updated." : "Package created.");
      closeForm();
      void client.invalidateQueries({ queryKey: ["admin-packages"] });
    },
    // No onError: FormDialog renders save.error in place and maps field errors onto fields.
  });

  const setStatus = useMutation({
    mutationFn: ({ pkg, isActive }: { pkg: Package; isActive: boolean }) =>
      apiRequest(`/admin/packages/${pkg.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (_result, variables) => {
      toast.success(variables.isActive ? "Package restored." : "Package retired.");
      setStatusTarget(null);
      void client.invalidateQueries({ queryKey: ["admin-packages"] });
    },
  });

  const remove = useMutation({
    mutationFn: (pkg: Package) => apiRequest(`/admin/packages/${pkg.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Package deleted.");
      setDeleteTarget(null);
      void client.invalidateQueries({ queryKey: ["admin-packages"] });
    },
    // No onError: the ConfirmDialog stays open and shows the 409 when subscriptions exist.
  });

  function openCreate() {
    setEditing(null);
    save.reset();
    form.reset(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(pkg: Package) {
    setEditing(pkg);
    save.reset();
    form.reset(toFormValues(pkg));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    save.reset();
  }

  const columns: Column<Package>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <>
          <p className="font-medium">{row.nameEn ?? row.name}</p>
          {row.description && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{row.description}</p>
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
    { id: "type", header: "Type", cell: (row) => row.type, hideBelow: "md" },
    {
      id: "price",
      header: "Price",
      cell: (row) => formatMoney(row.price),
      sortKey: "price",
      align: "right",
    },
    {
      id: "duration",
      header: "Duration",
      cell: (row) => `${row.durationDays} days`,
      hideBelow: "lg",
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={row.isActive ? "secondary" : "outline"}>
          {row.isActive ? "Active" : "Retired"}
        </Badge>
      ),
    },
    {
      id: "services",
      header: "Services",
      cell: (row) => row.services.length,
      align: "right",
      hideBelow: "lg",
    },
  ];

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        eyebrow="Catalogue"
        title="Package management"
        description="Create and price the subscription packages customers can choose from."
        actions={<Button onClick={openCreate}>New package</Button>}
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
        noun="package"
        emptyMessage="No packages have been created yet."
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
              {row.isActive ? "Deactivate" : "Restore"}
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
        title={editing ? "Edit package" : "New package"}
        description="Category, services, pricing and visibility for a subscription package."
        form={form}
        onSubmit={(values) => save.mutate(values)}
        submitLabel={editing ? "Save changes" : "Create package"}
        isPending={save.isPending}
        error={save.error ?? undefined}
      >
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="package-category">
            Category
          </label>
          {hasCategories ? (
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="package-category">
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
            <label className="text-sm font-medium" htmlFor="package-name-en">
              Name (English)
            </label>
            <Input id="package-name-en" {...form.register("nameEn")} />
            {form.formState.errors.nameEn && (
              <span className="text-xs text-destructive">{form.formState.errors.nameEn.message}</span>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="package-name-es">
              Name (Spanish)
            </label>
            <Input id="package-name-es" {...form.register("nameEs")} />
            {form.formState.errors.nameEs && (
              <span className="text-xs text-destructive">{form.formState.errors.nameEs.message}</span>
            )}
          </div>
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="package-type">
            Type
          </label>
          <Input id="package-type" placeholder="e.g. standard, premium" {...form.register("type")} />
          {form.formState.errors.type && (
            <span className="text-xs text-destructive">{form.formState.errors.type.message}</span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="package-price">
              Price (MXN)
            </label>
            <Input
              id="package-price"
              type="number"
              step="0.01"
              min="0"
              {...form.register("price", { valueAsNumber: true })}
            />
            {form.formState.errors.price && (
              <span className="text-xs text-destructive">{form.formState.errors.price.message}</span>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="package-duration">
              Duration (days)
            </label>
            <Input
              id="package-duration"
              type="number"
              min="1"
              step="1"
              {...form.register("durationDays", { valueAsNumber: true })}
            />
            {form.formState.errors.durationDays && (
              <span className="text-xs text-destructive">
                {form.formState.errors.durationDays.message}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="package-desc-en">
              Description (English)
            </label>
            <Textarea id="package-desc-en" rows={2} {...form.register("descriptionEn")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="package-desc-es">
              Description (Spanish)
            </label>
            <Textarea id="package-desc-es" rows={2} {...form.register("descriptionEs")} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Services</span>
          <Controller
            control={form.control}
            name="serviceIds"
            render={({ field }) => (
              <div className="max-h-44 overflow-y-auto rounded-md border border-border p-3">
                {services.isLoading && (
                  <p className="text-sm text-muted-foreground">Loading services…</p>
                )}
                {services.isError && (
                  <p className="text-sm text-destructive">Could not load services.</p>
                )}
                {services.data && services.data.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active services to attach.</p>
                )}
                <div className="grid gap-2">
                  {services.data?.map((service) => {
                    const checked = field.value.includes(service.id);
                    return (
                      <label
                        key={service.id}
                        className="flex items-center gap-2 text-sm"
                        htmlFor={`service-${service.id}`}
                      >
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={checked}
                          onCheckedChange={(next) =>
                            field.onChange(
                              next
                                ? [...field.value, service.id]
                                : field.value.filter((id) => id !== service.id),
                            )
                          }
                        />
                        {service.nameEn ?? service.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          />
          {form.formState.errors.serviceIds && (
            <span className="text-xs text-destructive">
              {form.formState.errors.serviceIds.message}
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="package-sort">
              Sort order
            </label>
            <Input
              id="package-sort"
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
          <div className="flex items-end">
            <Controller
              control={form.control}
              name="isFeatured"
              render={({ field }) => (
                <label
                  className="flex items-center gap-2 text-sm font-medium"
                  htmlFor="package-featured"
                >
                  <Checkbox
                    id="package-featured"
                    checked={field.value}
                    onCheckedChange={(next) => field.onChange(next === true)}
                  />
                  Featured
                </label>
              )}
            />
          </div>
        </div>
      </FormDialog>

      {statusTarget && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setStatusTarget(null)}
          title={statusTarget.isActive ? "Retire this package?" : "Restore this package?"}
          description={
            statusTarget.isActive
              ? `${statusTarget.nameEn ?? statusTarget.name} will be hidden from the public catalogue. Existing subscriptions keep it.`
              : `${statusTarget.nameEn ?? statusTarget.name} will return to the public catalogue.`
          }
          confirmLabel={statusTarget.isActive ? "Deactivate" : "Restore"}
          variant={statusTarget.isActive ? "destructive" : "default"}
          isPending={setStatus.isPending}
          error={setStatus.error ?? undefined}
          onConfirm={() => setStatus.mutate({ pkg: statusTarget, isActive: !statusTarget.isActive })}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete this package?"
          description={`${deleteTarget.nameEn ?? deleteTarget.name} will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete package"
          variant="destructive"
          isPending={remove.isPending}
          error={remove.error ?? undefined}
          onConfirm={() => remove.mutate(deleteTarget)}
        />
      )}
    </div>
  );
}
