"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type TabsNavItem = {
  label: string;
  href: string;
  exact?: boolean;
  icon?: React.ReactNode;
};

export function TabsNav({
  items,
  className = "",
  variant = "light",
}: {
  items: TabsNavItem[];
  className?: string;
  variant?: "light" | "dark";
}) {
  const pathname = usePathname();

  const wrapperClass =
    variant === "dark"
      ? "flex items-center gap-0.5 rounded-lg bg-slate-800/40 p-1 overflow-x-auto"
      : "flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1";

  return (
    <div className={`${wrapperClass} ${className}`}>
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname?.startsWith(`${item.href}/`);

        const linkClass =
          variant === "dark"
            ? active
              ? "bg-slate-700/90 text-slate-100 shadow-sm"
              : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
            : active
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-700 hover:bg-slate-100/70";

        const iconClass =
          variant === "dark"
            ? active
              ? "text-slate-200"
              : "text-slate-500"
            : "text-slate-400";

        const sizeClass = variant === "dark" ? "gap-1.5 rounded-md px-2.5 py-1.5 text-xs" : "gap-2 rounded-lg px-3 py-2 text-sm";
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative inline-flex items-center font-medium transition-colors ${sizeClass} ${linkClass}`}
          >
            {item.icon ? <span className={iconClass}>{item.icon}</span> : null}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
