import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#10252b] px-6 text-white">
      <section className="max-w-lg border border-cyan-800 bg-[#17363d] p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
          403 / access denied
        </p>
        <h1 className="mt-4 text-3xl font-semibold">This workspace is staff-only.</h1>
        <p className="mt-3 text-sm leading-6 text-cyan-50/70">
          Your account does not have permission to use the operations console.
        </p>
        <Link
          className="mt-7 inline-block text-sm font-semibold text-cyan-300 underline underline-offset-4"
          href="/login"
        >
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
