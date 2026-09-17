import Link from "next/link";

export default function NotFound() { return <main className="flex min-h-screen items-center justify-center bg-[#f4f0e8] px-6 text-center text-slate-900"><section><p className="text-sm font-bold uppercase tracking-[.18em] text-amber-700">404</p><h1 className="mt-3 text-4xl font-semibold">Page not found</h1><p className="mt-3 text-sm text-slate-600">The workspace page you requested does not exist.</p><Link className="mt-6 inline-flex bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white" href="/admin">Return to dashboard</Link></section></main>; }
