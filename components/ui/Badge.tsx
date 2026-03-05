import type { ReactNode } from "react";

type Variant = "default" | "brand";

const variantClasses: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-700",
  brand: "bg-indigo-50 text-indigo-700",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
