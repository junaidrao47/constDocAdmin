"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
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
type LoginAudience = "staff" | "admin";

const destinations: Record<LoginAudience, string> = {
  staff: "/staff",
  admin: "/admin",
};

const allowedRoles: Record<LoginAudience, UserRole[]> = {
  staff: ["agent", "manager"],
  admin: ["admin"],
};

export function LoginForm({ audience }: { audience: LoginAudience }) {
  const router = useRouter();
  const { login, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const isAdmin = audience === "admin";

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    try {
      const session = await login(values.email, values.password);
      if (!allowedRoles[audience].includes(session.user.role)) {
        logout();
        setError(
          isAdmin
            ? "This account is not an administrator account."
            : "Use the administrator sign-in for admin accounts.",
        );
        return;
      }
      router.replace(destinations[audience]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    }
  };

  return (
    <main
      className={
        isAdmin
          ? "min-h-screen bg-background px-5 py-10 text-foreground"
          : "min-h-screen bg-primary px-5 py-10 text-foreground"
      }
    >
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <section
          className={
            isAdmin
              ? "w-full max-w-md border border-border bg-card p-8 shadow-xl"
              : "w-full max-w-md border border-border bg-background p-8 shadow-2xl"
          }
        >
          <div className="mb-10 border-b border-border pb-5">
            <Image
              src="/logo.png"
              alt="Grupo G2H — Servicios Integrales"
              width={960}
              height={429}
              priority
              className="mb-6 h-12 w-auto"
            />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Grupo G2H / {isAdmin ? "control" : "operations"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {isAdmin ? "Administrator sign in" : "Staff sign in"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAdmin
                ? "Manage people, permissions, and platform operations."
                : "Review customer compliance work and document decisions."}
            </p>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <label className="block text-sm font-medium text-muted-foreground">
              Work email
              <Input className="mt-2" type="email" autoComplete="email" {...register("email")} />
              {errors.email && (
                <span className="mt-1 block text-xs text-destructive">{errors.email.message}</span>
              )}
            </label>
            <label className="block text-sm font-medium text-muted-foreground">
              Password
              <Input
                className="mt-2"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <span className="mt-1 block text-xs text-destructive">
                  {errors.password.message}
                </span>
              )}
            </label>
            {error && (
              <p
                role="alert"
                className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <Button
              className={
                isAdmin
                  ? "w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  : "w-full bg-primary text-primary-foreground hover:bg-primary/90"
              }
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Signing in..."
                : `Sign in to ${isAdmin ? "control" : "staff"} workspace`}
            </Button>
          </form>
          <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            {isAdmin ? (
              <a className="text-primary underline underline-offset-4" href="/staff/login">
                Staff sign in
              </a>
            ) : (
              <a className="text-primary underline underline-offset-4" href="/admin/login">
                Administrator sign in
              </a>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
