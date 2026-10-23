import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCategoriesPage from "@/app/(admin)/admin/categories/page";

const { apiRequest, FakeApiError } = vi.hoisted(() => {
  class FakeApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 400, options: { code?: string } = {}) {
      super(message);
      this.status = status;
      this.code = options.code;
    }
  }
  return { apiRequest: vi.fn(), FakeApiError };
});
vi.mock("@/lib/api", () => ({
  apiRequest,
  ApiError: FakeApiError,
  errorMessage: (error: unknown, fallback: string) =>
    error instanceof FakeApiError ? error.message : fallback,
}));
const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

const CATEGORY_ID = "cccccccc-3333-4333-8333-cccccccccccc";
const category = {
  id: CATEGORY_ID,
  slug: "permits",
  nameEn: "Permits",
  nameEs: "Permisos",
  descriptionEn: null,
  descriptionEs: null,
  icon: null,
  sortOrder: 0,
  isActive: true,
};

function defaultApi(path: string, init?: { method?: string }) {
  if (path === "/admin/categories" && !init) return Promise.resolve([category]);
  if (path === "/admin/services") return Promise.resolve([]);
  if (path === "/admin/packages") return Promise.resolve([]);
  return Promise.resolve({});
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminCategoriesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  apiRequest.mockImplementation(defaultApi);
});

describe("admin categories", () => {
  it("blocks a submit that fails client validation", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Permits")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New category" }));
    await user.click(screen.getByRole("button", { name: "Create category" }));

    expect(await screen.findByText("Slug is required")).toBeInTheDocument();
    expect(screen.getByText("English name is required")).toBeInTheDocument();
    expect(screen.getByText("Spanish name is required")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith(
      "/admin/categories",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("offers deactivate when a delete is refused because the category is not empty", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (init?.method === "DELETE") {
        return Promise.reject(
          new FakeApiError("still in use", 409, { code: "CATEGORY_NOT_EMPTY" }),
        );
      }
      return defaultApi(path, init);
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Permits")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete category" }),
    );

    // The dialog stays open, shows the mapped message, and switches to a deactivate action.
    const deactivate = await screen.findByRole("button", { name: "Deactivate instead" });
    expect(
      screen.getByText(/still has services or packages\. Deactivate it instead/i),
    ).toBeInTheDocument();

    await user.click(deactivate);
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(`/admin/categories/${CATEGORY_ID}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
    );
  });
});
