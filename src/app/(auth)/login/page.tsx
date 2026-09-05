"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

const loginSchema = z.object({
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(1, "Enter your password."),
});
type LoginValues = z.infer<typeof loginSchema>;

const roleLanding: Record<Exclude<UserRole, "customer">, string> = {
  agent: "/documents",
  manager: "/documents",
  admin: "/documents",
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    try {
      const session = await login(values.email, values.password);
      if (session.user.role === "customer") {
        router.replace("/403?reason=customer");
        return;
      }
      router.replace(roleLanding[session.user.role]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#10252b] px-5 py-10">
      <section className="w-full max-w-md border border-cyan-900 bg-[#f4f7f8] p-8 shadow-2xl">
        <div className="mb-10 border-b border-slate-200 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">ConstDoc / operations</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Staff sign in</h1>
          <p className="mt-2 text-sm text-slate-500">Document compliance workspace for internal teams.</p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm font-medium text-slate-700">Work email<Input className="mt-2" type="email" autoComplete="email" {...register("email")} />{errors.email && <span className="mt-1 block text-xs text-red-700">{errors.email.message}</span>}</label>
          <label className="block text-sm font-medium text-slate-700">Password<Input className="mt-2" type="password" autoComplete="current-password" {...register("password")} />{errors.password && <span className="mt-1 block text-xs text-red-700">{errors.password.message}</span>}</label>
          {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <Button className="w-full bg-cyan-700 text-white hover:bg-cyan-800" type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Sign in to workspace"}</Button>
        </form>
      </section>
    </main>
  );
}
