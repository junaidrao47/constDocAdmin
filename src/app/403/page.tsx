import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-primary px-6 text-primary-foreground">
      <section className="max-w-lg border border-border bg-primary p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">
          403 / access denied
        </p>
        <h1 className="mt-4 text-3xl font-semibold">This workspace is staff-only.</h1>
        <p className="mt-3 text-sm leading-6 text-primary-foreground/70">
          Your account does not have permission to use the operations console.
        </p>
        <Link
          className="mt-7 inline-block text-sm font-semibold text-accent underline underline-offset-4"
          href="/login"
        >
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
