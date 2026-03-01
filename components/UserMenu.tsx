"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, LogOut } from "lucide-react";
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
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, app_role")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName((profile as { full_name?: string | null }).full_name ?? null);
        setAppRole((profile as { app_role?: string | null }).app_role ?? null);
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-indigo-500 text-sm font-semibold text-white shadow-sm hover:ring-2 hover:ring-indigo-300 transition-all"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Menú de usuario"
      >
        {initials}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl border border-slate-200 bg-white py-1 shadow-lg focus:outline-none"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            {fullName && (
              <p className="text-sm font-semibold text-slate-900 truncate">
                {fullName}
              </p>
            )}
            {email && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{email}</p>
            )}
            {appRole && (
              <span
                className={`inline-block mt-1.5 text-[11px] font-medium rounded-full px-2 py-0.5 ${
                  appRole === "superadmin"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {appRole === "superadmin" ? "Superadministrador" : "Consultor"}
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
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              role="menuitem"
            >
              <User className="h-4 w-4 shrink-0 text-slate-400" />
              Cuenta
            </button>

            {isSuperadmin && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/admin");
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                role="menuitem"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                Administración
              </button>
            )}

            <div className="my-1 border-t border-slate-100" />

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-rose-600 transition-colors"
              role="menuitem"
            >
              <LogOut className="h-4 w-4 shrink-0 text-slate-400" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
