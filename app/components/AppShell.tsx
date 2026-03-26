"use client";

/**
 * Legacy light marketing/internal shell (separate from the private app).
 * Authenticated dark UI uses `components/ui/layout/AppShell.tsx` + Ribbit tokens in `app/globals.css`.
 */
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="leading-none">
            <p className="rb-wordmark text-xl text-slate-900">
              r<span className="rb-accent">i</span>bbit
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Entorno interno</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <button
            onClick={() => router.push("/dashboard")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              isActive("/dashboard")
                ? "bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-hover))] font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => router.push("/notes")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              isActive("/notes")
                ? "bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-hover))] font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Notas
          </button>

          <button
            onClick={() => router.push("/projects")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              isActive("/projects")
                ? "bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-hover))] font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Proyectos
          </button>

          <button
            onClick={() => router.push("/process-flows/demo")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              pathname.startsWith("/process-flows")
                ? "bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-hover))] font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Flujos de proceso
          </button>

          <button
            onClick={() => router.push("/update-password")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              isActive("/update-password")
                ? "bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-hover))] font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Cambiar contraseña
          </button>
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
          <p className="mt-2 text-[10px] text-slate-400">
            Acceso restringido · Información interna
          </p>
        </div>
      </aside>

      {/* Contenido */}
      <section className="flex-1">{children}</section>
    </main>
  );
}