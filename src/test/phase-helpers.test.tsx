import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/status-badge";
import { allowedPhaseTransitions } from "@/lib/documents";
import type { PhaseStatusContract } from "@/lib/types";

const contract: PhaseStatusContract = {
  statuses: [
    { value: "not_started", key: "phase.not_started", terminal: false },
    { value: "in_progress", key: "phase.in_progress", terminal: false },
    { value: "completed", key: "phase.completed", terminal: true },
    { value: "rejected", key: "phase.rejected", terminal: false },
  ],
  // Matches the real API shape: a single `from → [to]` flow, not keyed by role.
  flow: {
    not_started: ["in_progress", "completed", "rejected"],
    in_progress: ["completed", "rejected"],
    rejected: ["in_progress", "completed"],
    completed: ["in_progress"],
  },
};

describe("allowedPhaseTransitions", () => {
  it("returns the transitions for the current status", () => {
    expect(allowedPhaseTransitions(contract, "in_progress")).toEqual(["completed", "rejected"]);
    expect(allowedPhaseTransitions(contract, "not_started")).toEqual([
      "in_progress",
      "completed",
      "rejected",
    ]);
  });

  it("returns an empty list for a missing status or contract", () => {
    expect(allowedPhaseTransitions(contract, undefined)).toEqual([]);
    expect(allowedPhaseTransitions(undefined, "in_progress")).toEqual([]);
  });
});

describe("StatusBadge new statuses", () => {
  it("labels account and phase statuses", () => {
    render(
      <>
        <StatusBadge status="pending_approval" />
        <StatusBadge status="suspended" />
        <StatusBadge status="in_progress" />
        <StatusBadge status="not_started" />
      </>,
    );
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
    expect(screen.getByText("Suspended")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });
});
