"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, LogOut, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

function getInitials(fullName: string | null, email: string | null): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email[0].toUpperCase();
  }
  return "?";
}

export function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [appRole, setAppRole] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName((profile as { full_name?: string | null }).full_name ?? null);
      }

      // Role from /api/me (DB-backed) so it matches admin panel and backend
      const token = session?.access_token;
      if (token) {
        const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        const role = (data as { appRole?: string | null }).appRole ?? null;
        setAppRole(role);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    router.push("/");
  };

  const initials = getInitials(fullName, email);
  const isSuperadmin = appRole === "superadmin";
  const roleLabelMap: Record<string, string> = {
    superadmin: "Superadministrador",
    admin: "Administrador",
    consultant: "Consultor",
    viewer: "Lector",
  };
  const roleLabel = appRole ? roleLabelMap[appRole] ?? appRole : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 pl-2 pr-2.5 text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-slate-950"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Menú de usuario"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/90 text-sm font-semibold text-white">
          {initials}
        </span>
        <span className="hidden lg:inline text-sm font-medium truncate max-w-[120px]">
          {fullName || email || "Cuenta"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 hidden lg:block" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-1 focus:outline-none"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-slate-700/80">
            {fullName && (
              <p className="text-sm font-semibold text-slate-100 truncate">
                {fullName}
              </p>
            )}
            {email && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{email}</p>
            )}
            {roleLabel && (
              <span
                className={`inline-block mt-1.5 text-[11px] font-medium rounded-full px-2 py-0.5 ${
                  appRole === "superadmin"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-slate-700/60 text-slate-400"
                }`}
              >
                {roleLabel}
              </span>
            )}
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/account");
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-150"
              role="menuitem"
            >
              <User className="h-4 w-4 shrink-0 text-slate-500" />
              Cuenta
            </button>

            {isSuperadmin && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/admin");
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-150"
                role="menuitem"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500" />
                Administración
              </button>
            )}

            <div className="my-1 border-t border-slate-700/80" />

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-rose-400 transition-colors duration-150"
              role="menuitem"
            >
              <LogOut className="h-4 w-4 shrink-0 text-slate-500" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
