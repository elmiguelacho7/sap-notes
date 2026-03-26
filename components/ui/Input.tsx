import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-xl border border-[rgb(var(--rb-surface-border))] bg-[rgb(var(--rb-surface))] px-3 text-sm text-[rgb(var(--rb-text-primary))] outline-none transition-colors focus:border-[rgb(var(--rb-brand-primary))]/65 focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/25 placeholder:text-[rgb(var(--rb-text-muted))] ${className}`}
      {...props}
    />
  );
}
