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
import { apiRequest } from "@/lib/api";
import { messageForError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import type { Category, Service } from "@/lib/types";
import { useListQuery } from "@/lib/use-list-query";

const serviceFormSchema = z.object({
  categoryId: z.string().uuid("A category is required"),
  nameEn: z.string().trim().min(1, "English name is required").max(150, "Name is too long"),
  nameEs: z.string().trim().min(1, "Spanish name is required").max(150, "Name is too long"),
  descriptionEn: z.string().trim().max(2000, "Description is too long"),
  descriptionEs: z.string().trim().max(2000, "Description is too long"),
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
  basePrice: 0,
};

function toFormValues(service: Service): ServiceFormValues {
  return {
    categoryId: service.categoryId ?? "",
    nameEn: service.nameEn ?? service.name,
    nameEs: service.nameEs ?? service.name,
    descriptionEn: service.descriptionEn ?? service.description ?? "",
    descriptionEs: service.descriptionEs ?? "",
    basePrice: service.basePrice,
  };
}

function nullIfBlank(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export default function AdminServicesPage() {
  const client = useQueryClient();
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
