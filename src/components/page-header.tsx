import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** Small uppercase line above the title, e.g. "Revenue operations". */
  eyebrow: string;
  title: string;
  description?: string;
  /** Right-aligned controls — a create button, a refresh button. */
  actions?: ReactNode;
}

/**
 * The heading block every screen opens with. It was copy-pasted into five pages with
 * small drifts in spacing; this is the one copy.
 */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
