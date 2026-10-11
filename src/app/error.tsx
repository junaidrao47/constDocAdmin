"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="max-w-md border border-destructive/30 bg-card p-8 text-center shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-destructive">
          Workspace error
        </p>
        <h1 className="mt-3 text-2xl font-semibold">This page could not load</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Try again, or return to the control center. Your session and saved data are unchanged.
        </p>
        <button
          className="mt-6 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          onClick={() => reset()}
        >
          Try again
        </button>
      </section>
    </main>
  );
}
