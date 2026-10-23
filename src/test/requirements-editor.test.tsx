import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequirementsEditor } from "@/components/requirements-editor";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api", () => ({
  apiRequest,
  ApiError: class ApiError extends Error {},
  errorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RequirementsEditor serviceId="svc-1" serviceName="Compliance review" open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue([]);
});

describe("RequirementsEditor", () => {
  it("validates bilingual names before adding a requirement", async () => {
    const user = userEvent.setup();
    renderEditor();

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/admin/services/svc-1/requirements"),
    );

    await user.click(screen.getByRole("button", { name: "Add requirement" }));

    expect(await screen.findByText("English name is required")).toBeInTheDocument();
    expect(screen.getByText("Spanish name is required")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith(
      "/admin/services/svc-1/requirements",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
