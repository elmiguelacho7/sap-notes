import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "secondary" | "ghost" | "destructive";

const variantClasses: Record<Variant, string> = {
  default:
    "rb-btn-primary border-transparent",
  secondary:
    "bg-[rgb(var(--rb-surface-2))] text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))] active:bg-[rgb(var(--rb-surface-3))] border-[rgb(var(--rb-surface-border))]",
  ghost:
    "bg-transparent text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-brand-primary))]/10 active:bg-[rgb(var(--rb-brand-primary))]/15 border-transparent",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 border-transparent",
};

export function Button({
  children,
  variant = "default",
  className = "",
  type = "button",
  disabled,
  ...props
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-workspace-bg))] ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
