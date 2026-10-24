import type { DocumentPhase, PhaseProgress, PhaseStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A plain percent bar with a "completed/total" caption. */
export function ProgressBar({ progress, className }: { progress: PhaseProgress; className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress.percent}%` }}
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {progress.completed}/{progress.total} phases · {progress.percent}%
      </p>
    </div>
  );
}

const SEGMENT_TONE: Record<PhaseStatus, string> = {
  completed: "bg-success",
  in_progress: "bg-warning",
  rejected: "bg-destructive",
  not_started: "bg-muted",
};

/**
 * A segmented bar, one block per phase, coloured by that phase's status — so a glance
 * shows which phases are done, in progress, rejected or not started.
 */
export function SegmentedProgress({ phases }: { phases: Pick<DocumentPhase, "id" | "status">[] }) {
  if (phases.length === 0) {
    return <p className="text-xs text-muted-foreground">No phases defined.</p>;
  }
  return (
    <div className="flex w-full gap-1" aria-label={`${phases.length} phases`}>
      {phases.map((phase) => (
        <span
          key={phase.id}
          className={cn("h-2 flex-1 rounded-full", SEGMENT_TONE[phase.status] ?? "bg-muted")}
          title={phase.status.replaceAll("_", " ")}
        />
      ))}
    </div>
  );
}
