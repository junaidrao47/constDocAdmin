import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/status-badge";

describe("StatusBadge", () => {
  it("renders the new submitted_to_government status with a readable label", () => {
    render(<StatusBadge status="submitted_to_government" />);
    expect(screen.getByText("Submitted to government")).toBeInTheDocument();
  });

  it("covers the core document statuses", () => {
    const { rerender } = render(<StatusBadge status="approved" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
    rerender(<StatusBadge status="rejected" />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("humanises an unknown status instead of showing a raw token", () => {
    render(<StatusBadge status="some_future_status" />);
    expect(screen.getByText("some future status")).toBeInTheDocument();
  });
});
