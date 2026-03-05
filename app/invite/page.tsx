"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type LookupPayload = {
  projectId: string;
  projectName: string;
  email: string;
  role: string;
  expiresAt: string;
};

function InvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [lookup, setLookup] = useState<LookupPayload | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const signInUrl = token
    ? `/?next=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}`
    : "/";

  const loadLookup = useCallback(async () => {
    if (!token.trim()) {
      setLookupError("Falta el token de invitación.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLookupError(null);
    setLookup(null);
    try {
      const res = await fetch(
        `/api/invitations/lookup?token=${encodeURIComponent(token)}`
      );
      const data = await res.json().catch(() => ({})) as LookupPayload & { error?: string };
      if (!res.ok) {
        setLookupError(data.error ?? "Invitación no encontrada o no válida.");
        setLoading(false);
        return;
      }
      setLookup({
        projectId: data.projectId,
        projectName: data.projectName,
        email: data.email,
        role: data.role,
        expiresAt: data.expiresAt,
      });
    } catch {
      setLookupError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadLookup();
  }, [loadLookup]);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ? { id: data.user.id } : null);
    };
    checkUser();
  }, []);

  const handleAccept = async () => {
    if (!token.trim() || !user) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (sessionData?.session?.access_token) {
        headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      }
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; projectId?: string; error?: string; currentEmail?: string; invitationEmail?: string };
      if (!res.ok) {
        if (res.status === 403 && data.currentEmail !== undefined) {
          setAcceptError(
            `El correo de tu cuenta (${data.currentEmail || "no disponible"}) no coincide con la invitación (${data.invitationEmail ?? ""}). Inicia sesión con el correo correcto o pide una nueva invitación.`
          );
        } else {
          setAcceptError(data.error ?? "No se pudo aceptar la invitación.");
        }
        setAccepting(false);
        return;
      }
      if (data.ok && data.projectId) {
        router.replace(`/projects/${data.projectId}/members`);
      } else {
        router.replace("/projects");
      }
    } catch {
      setAcceptError("Error de conexión.");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <p className="text-sm text-slate-500">Cargando invitación…</p>
      </main>
    );
  }

  if (lookupError) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">
            Invitación no válida
          </h1>
          <p className="text-sm text-slate-600">
            {lookupError}
          </p>
          <p className="text-xs text-slate-500">
            Puede que el enlace haya expirado, ya se haya utilizado o haya sido revocado.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Ir a inicio de sesión
          </Link>
        </div>
      </main>
    );
  }

  if (!lookup) {
    return null;
  }

  const roleLabels: Record<string, string> = {
    owner: "Propietario",
    editor: "Editor",
    viewer: "Lector",
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
        <h1 className="text-lg font-semibold text-slate-900">
          Invitación al proyecto
        </h1>
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2 text-sm">
          <p>
            <span className="text-slate-500">Proyecto:</span>{" "}
            <span className="font-medium text-slate-900">{lookup.projectName}</span>
          </p>
          <p>
            <span className="text-slate-500">Invitado como:</span>{" "}
            <span className="font-medium text-slate-900">{lookup.email}</span>
          </p>
          <p>
            <span className="text-slate-500">Rol:</span>{" "}
            <span className="font-medium text-slate-900">
              {roleLabels[lookup.role] ?? lookup.role}
            </span>
          </p>
        </div>

        {!user ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Inicia sesión con la cuenta <strong>{lookup.email}</strong> para aceptar la invitación.
            </p>
            <Link
              href={signInUrl}
              className="block w-full text-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Iniciar sesión para aceptar
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {acceptError && (
              <p className="text-sm text-red-600">{acceptError}</p>
            )}
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {accepting ? "Aceptando…" : "Aceptar invitación"}
            </button>
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          Este enlace caduca en 7 días. Si ya has aceptado esta invitación, abre el proyecto desde tu panel.
        </p>
      </div>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-sm text-slate-500">Cargando…</p></div>}>
      <InvitePageContent />
    </Suspense>
  );
}
