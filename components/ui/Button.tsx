import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  default:
    "bg-indigo-600 text-white hover:bg-indigo-700 border-transparent",
  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200 border-slate-200",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 border-transparent",
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
