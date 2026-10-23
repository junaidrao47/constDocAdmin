import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminServicesPage from "@/app/(admin)/admin/services/page";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api", () => ({
  apiRequest,
  ApiError: class ApiError extends Error {},
  errorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminServicesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
});

describe("admin services", () => {
  it("tells the user to create a category first when none exist", async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === "/admin/categories") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "New service" }));
    const link = await screen.findByRole("link", { name: "Create a category first" });
    expect(link).toHaveAttribute("href", "/admin/categories");
  });

  it("requires a category before it will submit", async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === "/admin/categories")
        return Promise.resolve([
          { id: "dddddddd-4444-4444-8444-dddddddddddd", slug: "permits", nameEn: "Permits", nameEs: "Permisos", isActive: true, sortOrder: 0, icon: null, descriptionEn: null, descriptionEs: null },
        ]);
      return Promise.resolve([]);
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "New service" }));
    await user.click(screen.getByRole("button", { name: "Create service" }));

    expect(await screen.findByText("A category is required")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith(
      "/admin/services",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
