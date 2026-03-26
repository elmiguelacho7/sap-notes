"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { User, ShieldCheck, LogOut, ChevronDown, Languages } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { LOCALE_COOKIE_NAME, type AppLocale } from "@/i18n/config";

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

const LOCALE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

function setLocaleCookie(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=${LOCALE_MAX_AGE_SEC};SameSite=Lax`;
}

export function UserMenu() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("common.userMenu");
  const tLang = useTranslations("common.language");
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
  const roleLabel = appRole
    ? ["superadmin", "admin", "consultant", "viewer"].includes(appRole)
      ? t(`roles.${appRole as "superadmin" | "admin" | "consultant" | "viewer"}`)
      : appRole
    : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 items-center gap-2 rounded-lg border border-[rgb(var(--rb-surface-border))]/55 bg-[rgb(var(--rb-surface))]/72 pl-2 pr-2.5 text-[rgb(var(--rb-text-primary))] shadow-sm hover:bg-[rgb(var(--rb-surface))]/88 hover:border-[rgb(var(--rb-surface-border))]/65 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("aria")}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--rb-brand-primary))]/25 bg-[rgb(var(--rb-brand-primary))]/15 text-sm font-medium text-[rgb(var(--rb-brand-primary))]">
          {initials}
        </span>
        <span className="hidden lg:inline text-sm font-medium truncate max-w-[120px]">
          {fullName || email || t("account")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))] hidden lg:block" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 backdrop-blur-sm shadow-md py-1 focus:outline-none"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-[rgb(var(--rb-surface-border))]/60">
            {fullName && (
              <p className="text-sm font-semibold text-[rgb(var(--rb-text-primary))] truncate">
                {fullName}
              </p>
            )}
            {email && (
              <p className="text-xs text-[rgb(var(--rb-text-secondary))] truncate mt-0.5">{email}</p>
            )}
            {roleLabel && (
              <span
                className={`rb-badge mt-1.5 inline-flex ${
                  appRole === "superadmin" ? "rb-badge-success" : "rb-badge-neutral"
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
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface))]/80 transition-colors duration-150"
              role="menuitem"
            >
              <User className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))]" />
              {t("account")}
            </button>

            {isSuperadmin && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/admin");
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface))]/80 transition-all duration-150"
                role="menuitem"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))]" />
                {t("admin")}
              </button>
            )}

            <div className="my-1 border-t border-[rgb(var(--rb-surface-border))]/60" />

            <div className="px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--rb-text-muted))] mb-1.5 flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" aria-hidden />
                {tLang("label")}
              </p>
              <div className="flex gap-2">
                {(["en", "es"] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors border ${
                      locale === code
                        ? "border-[rgb(var(--rb-brand-primary))]/28 bg-[rgb(var(--rb-brand-primary))]/10 text-[rgb(var(--rb-text-primary))]"
                        : "border-[rgb(var(--rb-surface-border))]/50 bg-[rgb(var(--rb-surface-3))]/40 text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface))]/80 hover:text-[rgb(var(--rb-text-primary))]"
                    }`}
                    onClick={() => {
                      setLocaleCookie(code);
                      setOpen(false);
                      router.refresh();
                    }}
                  >
                    {tLang(code)}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-1 border-t border-[rgb(var(--rb-surface-border))]/60" />

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface))]/80 hover:text-red-600 transition-all duration-150"
              role="menuitem"
            >
              <LogOut className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))]" />
              {t("logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
