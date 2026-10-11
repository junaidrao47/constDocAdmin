"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-6 text-center">
          <section>
            <h1 className="text-3xl font-semibold">ConstDoc is temporarily unavailable</h1>
            <p className="mt-3 text-sm text-muted-foreground">Please try again.</p>
            <button
              className="mt-6 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              onClick={() => reset()}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
