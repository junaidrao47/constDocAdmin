import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-offset-white focus:ring-2 focus:ring-cyan-600", className)} {...props} />;
}