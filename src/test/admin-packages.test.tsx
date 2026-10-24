import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPackagesPage from "@/app/(admin)/admin/packages/page";

// vi.mock factories are hoisted, so the fake error class is created inside vi.hoisted too.
const { apiRequest, FakeApiError } = vi.hoisted(() => {
  class FakeApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 400, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
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

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

// The page reads the session for the image-upload token and calls the upload helper; neither
// is exercised by these tests, so a fixed session and a no-op upload keep them isolated.
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ session: { accessToken: "test-token", user: { role: "admin" } } }),
}));
vi.mock("@/lib/upload", () => ({ uploadWithProgress: vi.fn() }));

const SERVICE_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const CATEGORY_ID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const service = {
  id: SERVICE_ID,
  name: "Compliance review",
  nameEn: "Compliance review",
  description: null,
  basePrice: 1500,
  categoryId: CATEGORY_ID,
  isActive: true,
};
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
const pkg = {
  id: "pkg-1",
  name: "Premium compliance",
  nameEn: "Premium compliance",
  type: "premium",
  price: 25000,
  durationDays: 365,
  description: "Full coverage",
  categoryId: CATEGORY_ID,
  isActive: true,
  isFeatured: true,
  sortOrder: 1,
  services: [service],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function defaultApi(path: string, init?: { method?: string }) {
  if (path === "/admin/packages" && !init) return Promise.resolve([pkg]);
  if (path.startsWith("/admin/services")) return Promise.resolve([service]);
  if (path === "/admin/categories") return Promise.resolve([category]);
  return Promise.resolve({});
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminPackagesPage />
    </QueryClientProvider>,
  );
}

async function pickCategory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("Category"));
  await user.click(await screen.findByRole("option", { name: "Permits" }));
}

beforeEach(() => {
  apiRequest.mockReset();
  toastSuccess.mockReset();
  apiRequest.mockImplementation(defaultApi);
});

describe("admin packages", () => {
  it("fetches the bare-array list in client mode and renders the row", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Premium compliance")).toBeInTheDocument());
    // No page/pageSize/sort — asking for them would imply a contract this endpoint lacks.
    expect(apiRequest).toHaveBeenCalledWith("/admin/packages");
    expect(screen.getByText(/25,000\.00/)).toBeInTheDocument();
  });

  it("blocks a submit that fails client validation and fires no request", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Premium compliance")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New package" }));
    await user.click(screen.getByRole("button", { name: "Create package" }));

    expect(await screen.findByText("A category is required")).toBeInTheDocument();
    expect(screen.getByText("English name is required")).toBeInTheDocument();
    expect(screen.getByText("Spanish name is required")).toBeInTheDocument();
    expect(screen.getByText("Type is required")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith(
      "/admin/packages",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends the bilingual + category create payload", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Premium compliance")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New package" }));
    await pickCategory(user);
    await user.type(screen.getByLabelText("Name (English)"), "Starter");
    await user.type(screen.getByLabelText("Name (Spanish)"), "Inicial");
    await user.type(screen.getByLabelText("Type"), "basic");
    await user.clear(screen.getByLabelText("Price (MXN)"));
    await user.type(screen.getByLabelText("Price (MXN)"), "1000");
    await user.click(screen.getByRole("checkbox", { name: "Compliance review" }));
    await user.click(screen.getByRole("button", { name: "Create package" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/admin/packages", {
        method: "POST",
        body: JSON.stringify({
          name: "Starter",
          nameEn: "Starter",
          nameEs: "Inicial",
          type: "basic",
          price: 1000,
          durationDays: 30,
          serviceIds: [SERVICE_ID],
          categoryId: CATEGORY_ID,
          description: null,
          descriptionEn: null,
          descriptionEs: null,
          sortOrder: 0,
          isFeatured: false,
        }),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Package created.");
  });

  it("keeps the 409 visible in the delete dialog and does not close it", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((path: string, init?: { method?: string }) =>
      init?.method === "DELETE"
        ? Promise.reject(
            new FakeApiError("Package cannot be deleted while subscriptions reference it", 409),
          )
        : defaultApi(path, init),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText("Premium compliance")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete package" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Package cannot be deleted while subscriptions reference it",
      ),
    );
    expect(screen.getByText("Delete this package?")).toBeInTheDocument();
  });

  it("retires a package through the dedicated status route", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Premium compliance")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(screen.getByText("Retire this package?")).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Deactivate" }),
    );

    await waitFor(() =>
      // isActive is not settable via the package schema; retiring is its own PATCH.
      expect(apiRequest).toHaveBeenCalledWith("/admin/packages/pkg-1/status", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Package retired.");
  });
});
