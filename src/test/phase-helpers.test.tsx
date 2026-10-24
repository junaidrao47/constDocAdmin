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
  transitionsByRole: {
    manager: {
      not_started: ["in_progress"],
      in_progress: ["completed", "rejected"],
      rejected: ["in_progress"],
    },
  },
};

describe("allowedPhaseTransitions", () => {
  it("returns the transitions for a role and current status", () => {
    expect(allowedPhaseTransitions(contract, "manager", "in_progress")).toEqual(["completed", "rejected"]);
    expect(allowedPhaseTransitions(contract, "manager", "not_started")).toEqual(["in_progress"]);
  });

  it("returns an empty list for an unknown role, status, or missing contract", () => {
    expect(allowedPhaseTransitions(contract, "agent", "in_progress")).toEqual([]);
    expect(allowedPhaseTransitions(contract, "manager", "completed")).toEqual([]);
    expect(allowedPhaseTransitions(undefined, "manager", "in_progress")).toEqual([]);
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
