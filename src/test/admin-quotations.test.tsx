import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminQuotationsPage from "@/app/(admin)/admin/quotations/page";

// vi.mock factories are hoisted above the module body, so the error class the factory
// returns has to be created inside vi.hoisted too.
const { apiRequest, FakeApiError } = vi.hoisted(() => {
  class FakeApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  }
  return { apiRequest: vi.fn(), FakeApiError };
});
vi.mock("@/lib/api", () => ({
  apiRequest,
  ApiError: FakeApiError,
  errorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

const draft = {
  id: "q-1",
  customerId: "cust-1",
  totalPrice: "12500.00",
  currency: "MXN",
  status: "draft",
  workerCount: 12,
  expiresAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  customer: { id: "cust-1", email: "obra@example.mx", name: "Constructora Obra", role: "customer" },
};
const converted = { ...draft, id: "q-2", status: "converted", customer: undefined };

function listResponse(rows: unknown[], total = rows.length) {
  return {
    data: rows,
    pagination: { page: 1, pageSize: 25, total, totalPages: total > 25 ? 2 : 1 },
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminQuotationsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  toastSuccess.mockReset();
  apiRequest.mockResolvedValue(listResponse([draft]));
});

describe("admin quotations, on the shared components", () => {
  it("asks for the paginated shape and renders the row", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Constructora Obra")).toBeInTheDocument());
    // Sending a page param is what switches this endpoint off its bare-array response.
    expect(apiRequest).toHaveBeenCalledWith("/admin/quotations?page=1&pageSize=25&sort=-createdAt");
    expect(screen.getByText("obra@example.mx")).toBeInTheDocument();
    expect(screen.getByText("01 Oct 2026")).toBeInTheDocument();
  });

  it("formats the total in the currency the row carries", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText(/12,500\.00/)).toBeInTheDocument());
  });

  it("offers every legal transition for the row's status, not just two", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Constructora Obra")).toBeInTheDocument());

    // draft -> sent | rejected | cancelled, per the backend state machine. The old page
    // hardcoded "Send" alone and left the rest reachable only from a database client.
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel quotation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });

  it("says so for a terminal status instead of showing an empty cell", async () => {
    apiRequest.mockResolvedValue(listResponse([converted]));
    renderPage();

    await waitFor(() => expect(screen.getByText("No further action")).toBeInTheDocument());
  });

  it("confirms before transitioning and sends the status with the note", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Constructora Obra")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Send" }));
    // The click opens a dialog; it must not have fired the PATCH on its own.
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Send this quotation?")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Note/), "Approved by finance");
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/admin/quotations/q-1/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "sent", note: "Approved by finance" }),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Quotation moved to sent.");
  });

  it("omits the note entirely when it is left blank", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Constructora Obra")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Reject" }),
    );

    await waitFor(() =>
      // `note: ""` would write an empty string into the status history.
      expect(apiRequest).toHaveBeenCalledWith("/admin/quotations/q-1/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      }),
    );
  });

  it("keeps a rejected transition visible in the dialog and raises no toast", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((path: string) =>
      path.includes("/status")
        ? Promise.reject(new FakeApiError("Cannot move a quotation from draft to accepted", 409))
        : Promise.resolve(listResponse([draft])),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText("Constructora Obra")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Cannot move a quotation from draft to accepted",
      ),
    );
    // The reason has to stay where the action was taken, not vanish on a timer.
    expect(screen.getByText("Send this quotation?")).toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("filters by status and resets to the first page", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Constructora Obra")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Filter by status"), "accepted");

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/quotations?page=1&pageSize=25&sort=-createdAt&status=accepted",
      ),
    );
  });

  it("sorts through the API rather than in the browser", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Constructora Obra")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Total/ }));

    // Only this endpoint accepts `sort`, and the whole result set must be ordered —
    // not just the 25 rows this page happens to hold.
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/quotations?page=1&pageSize=25&sort=totalPrice",
      ),
    );
  });

  it("pages with page and pageSize", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue(listResponse([draft], 30));
    renderPage();
    await waitFor(() => expect(screen.getByText("Constructora Obra")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/quotations?page=2&pageSize=25&sort=-createdAt",
      ),
    );
  });

  it("shows the empty state naming the filter in force", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue(listResponse([]));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("No quotations have been created yet.")).toBeInTheDocument(),
    );

    await user.selectOptions(screen.getByLabelText("Filter by status"), "expired");
    await waitFor(() =>
      expect(screen.getByText("No quotations are currently expired.")).toBeInTheDocument(),
    );
  });

  it("surfaces a failed load with a retry", async () => {
    apiRequest.mockRejectedValue(new FakeApiError("Service unavailable", 503));
    renderPage();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable"));
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
