import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/(admin)/admin/page";
import CustomersPage from "@/app/(staff)/customers/page";
import DocumentsPage from "@/app/(staff)/documents/page";
import OversightPage from "@/app/(staff)/oversight/page";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn(() => ({ session: { user: { email: "admin@example.com", role: "admin" } } })) }));
vi.mock("@/lib/api", () => ({
  apiRequest,
  ApiError: class ApiError extends Error {},
}));
vi.mock("@/lib/auth-context", () => ({ useAuth }));

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("frontend modules", () => {
  it("renders the customer, oversight, and admin module entry points", () => {
    render(<><CustomersPage /><OversightPage /><AdminPage /></>);
    expect(screen.getByRole("heading", { name: "My Customers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Oversight" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Platform control center" })).toBeInTheDocument();
  });

  it("loads documents and approves an item under review", async () => {
    apiRequest.mockImplementation((path: string) => path === "/documents"
      ? Promise.resolve([{ id: "doc-1", customerId: "cust-1", fileName: "permit.pdf", status: "under_review", updatedAt: "2026-01-01T00:00:00.000Z" }])
      : Promise.resolve({}));
    const user = userEvent.setup();
    renderWithQuery(<DocumentsPage />);

    expect(await screen.findByText("permit.pdf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/documents/doc-1/status", expect.objectContaining({ method: "PATCH" })));
    expect(await screen.findByText("Document status updated.")).toBeInTheDocument();
  });
});