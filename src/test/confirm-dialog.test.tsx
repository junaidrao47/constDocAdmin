import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiError } from "@/lib/api";

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const view = render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Send this quotation?"
      description="The customer is emailed a link and the quotation leaves draft."
      confirmLabel="Send"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onOpenChange, unmount: view.unmount };
}

describe("ConfirmDialog", () => {
  it("fires the confirm handler exactly once", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    expect(screen.getByText("Send this quotation?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons and relabels while pending", () => {
    renderDialog({ isPending: true });

    // A second click during a transition would send the same PATCH twice.
    expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("shows a failure inline and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({
      error: new ApiError("Cannot move a quotation from draft to accepted", 409),
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cannot move a quotation from draft to accepted",
    );
    // The reason the API gave must survive on screen; the caller closes on success only.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Send this quotation?")).toBeInTheDocument();

    // Retrying after a failure is allowed — the buttons are not latched.
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders no alert when there is no error", () => {
    renderDialog();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("falls back to a generic message for a transport error or a non-Error", () => {
    const { unmount } = renderDialog({ error: new TypeError("Failed to fetch") });
    expect(screen.getByRole("alert")).toHaveTextContent("The action could not be completed.");
    unmount();

    renderDialog({ error: { code: 500 } });
    expect(screen.getByRole("alert")).toHaveTextContent("The action could not be completed.");
  });

  it("asks for confirmation through a destructive button when told to", () => {
    renderDialog({ variant: "destructive", confirmLabel: "Disable access" });
    expect(screen.getByRole("button", { name: "Disable access" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Send this quotation?"
        description="Never shown."
        confirmLabel="Send"
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByText("Send this quotation?")).not.toBeInTheDocument();
  });
});
