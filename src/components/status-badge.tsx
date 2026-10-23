import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral";

/**
 * Label + colour per status across documents, quotations and invoices.
 *
 * The *set* of document statuses and the allowed transitions are owned by the API
 * (`GET /documents/statuses`) and drive the action buttons — never a hardcoded list.
 * Colours are not part of that contract, so this presentation map (label + tone) stays
 * local; the labels are English today and map 1:1 to the contract's i18n keys for the
 * day next-intl lands. An unknown status still renders via the humanised fallback below.
 */
const STATUSES: Record<string, { label: string; tone: Tone }> = {
  // documents
  pending: { label: "Pending", tone: "neutral" },
  under_review: { label: "Under review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  submitted_to_government: { label: "Submitted to government", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
  expiring_soon: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  // quotations
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  converted: { label: "Converted", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  // invoices
  issued: { label: "Issued", tone: "neutral" },
  partially_paid: { label: "Partially paid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
};

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STATUSES[status] ?? { label: status.replaceAll("_", " "), tone: "neutral" as Tone };
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", TONE_CLASSES[entry.tone], className)}
    >
      {entry.label}
    </Badge>
  );
}
