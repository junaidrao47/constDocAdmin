import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn("inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50", className)}
      {...props}
    />
  );
}