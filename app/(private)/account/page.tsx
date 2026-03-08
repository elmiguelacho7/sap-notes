"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";

const MIN_PASSWORD_LENGTH = 8;

type IntegrationSummary = {
  id: string;
  provider: string;
  display_name: string;
  account_email: string | null;
  status: string;
  created_at: string;
};

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleConnectPending, setGoogleConnectPending] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (!cancelled && profile) {
        setFullName((profile as { full_name?: string | null }).full_name ?? null);
      }
      if (!cancelled) setLoading(false);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  // Query params: google=connected | error=...
  useEffect(() => {
    const google = searchParams?.get("google");
    const err = searchParams?.get("error");
    if (google === "connected") setGoogleConnected(true);
    if (err) {
      const messages: Record<string, string> = {
        missing_params: "Faltan parámetros en la respuesta de Google.",
        invalid_state: "Sesión de conexión inválida. Inténtalo de nuevo.",
        not_authenticated: "Debes iniciar sesión para conectar.",
        config: "Configuración del servidor incompleta.",
        callback_failed: "Error al conectar con Google. Inténtalo más tarde.",
      };
      setGoogleConnectError(messages[err] || "Error al conectar con Google.");
    }
  }, [searchParams]);

  // Load integrations (for status)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIntegrationsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setIntegrations([]);
          return;
        }
        const res = await fetch("/api/integrations", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({ integrations: [] }));
        setIntegrations((data as { integrations?: IntegrationSummary[] }).integrations ?? []);
      } catch {
        if (!cancelled) setIntegrations([]);
      } finally {
        if (!cancelled) setIntegrationsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [googleConnected]);

  const handleConnectGoogleDrive = async () => {
    setGoogleConnectError(null);
    setGoogleConnectPending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setGoogleConnectError("Debes iniciar sesión para conectar Google Drive.");
        return;
      }
      const res = await fetch("/api/integrations/google/connect", {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok) {
        setGoogleConnectError(data.error ?? (res.status === 401 ? "Debes iniciar sesión para conectar Google Drive." : "Error al iniciar la conexión con Google."));
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setGoogleConnectError("Respuesta inesperada del servidor. Inténtalo de nuevo.");
    } catch {
      setGoogleConnectError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setGoogleConnectPending(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});

    const current = currentPassword.trim();
    const newPwd = newPassword.trim();
    const confirm = confirmNewPassword.trim();

    const errors: Record<string, string> = {};
    if (!current) errors.currentPassword = "La contraseña actual es obligatoria.";
    if (!newPwd) errors.newPassword = "La nueva contraseña es obligatoria.";
    else if (newPwd.length < MIN_PASSWORD_LENGTH)
      errors.newPassword = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    if (!confirm) errors.confirmNewPassword = "Repite la nueva contraseña.";
    else if (newPwd !== confirm)
      errors.confirmNewPassword = "Las contraseñas no coinciden.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    const userEmail = email;
    if (!userEmail) {
      setErrorMsg("No se pudo obtener tu correo. Cierra sesión y vuelve a entrar.");
      setSaving(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: current,
    });

    if (signInError) {
      setErrorMsg("La contraseña actual no es correcta.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPwd,
    });

    setSaving(false);

    if (updateError) {
      setErrorMsg("No se pudo actualizar la contraseña. Inténtalo de nuevo.");
      return;
    }

    setSuccessMsg("Contraseña actualizada correctamente.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setFieldErrors({});

    await supabase.auth.signOut();
    router.push("/?message=password-updated");
  };

  if (loading) {
    return (
      <PageShell wide={false}>
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-slate-700">Cargando…</p>
          <p className="mt-1 text-sm text-slate-500">Un momento.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide={false}>
      <div className="space-y-8">
      <PageHeader
        title="Cuenta"
        description="Información de tu cuenta y opciones de seguridad."
      />

        {/* Integraciones conectadas */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Integraciones conectadas
          </h2>
          <p className="text-sm text-slate-500">
            Conecta tu cuenta de Google Drive para usar carpetas o archivos como fuentes de conocimiento (global o por proyecto). La conexión se gestiona principalmente desde Admin → Knowledge Sources.
          </p>
          {googleConnectError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {googleConnectError}
            </div>
          )}
          {googleConnected && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Cuenta de Google conectada correctamente.
            </div>
          )}
          {integrationsLoading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div>
                  <p className="font-medium text-slate-800">Google Drive</p>
                  {integrations.some((i) => i.provider === "google_drive") ? (
                    <>
                      <p className="mt-1 text-xs text-slate-600">
                        Cuenta conectada:{" "}
                        {integrations.find((i) => i.provider === "google_drive")?.account_email ?? "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Estado: {integrations.find((i) => i.provider === "google_drive")?.status === "active" ? "Activo" : "Revisar"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">No conectado</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleConnectGoogleDrive}
                  disabled={googleConnectPending}
                  className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors shrink-0 disabled:opacity-60"
                >
                  {googleConnectPending ? "Redirigiendo…" : integrations.some((i) => i.provider === "google_drive") ? "Reconectar" : "Conectar Google Drive"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Información de la cuenta */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Información de la cuenta
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500 font-medium">Email</dt>
              <dd className="text-slate-900 mt-0.5">
                {email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Nombre</dt>
              <dd className="text-slate-900 mt-0.5">
                {fullName ?? "—"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Cambiar contraseña */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Cambiar contraseña
          </h2>
          <p className="text-sm text-slate-500">
            Introduce tu contraseña actual y la nueva contraseña. Tras
            actualizarla, tendrás que iniciar sesión de nuevo.
          </p>

          {errorMsg && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="account-current-password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Contraseña actual *
              </label>
              <input
                id="account-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Tu contraseña actual"
                required
                autoComplete="current-password"
                disabled={saving}
              />
              {fieldErrors.currentPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.currentPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="account-new-password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Nueva contraseña *
              </label>
              <input
                id="account-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                disabled={saving}
              />
              {fieldErrors.newPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="account-confirm-password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Repetir nueva contraseña *
              </label>
              <input
                id="account-confirm-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Vuelve a escribir la nueva contraseña"
                required
                autoComplete="new-password"
                disabled={saving}
              />
              {fieldErrors.confirmNewPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.confirmNewPassword}
                </p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Guardando..." : "Actualizar contraseña"}
              </button>
            </div>
          </form>

          <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
            ¿Olvidaste tu contraseña? Puedes restablecerla desde el enlace que
            te enviamos por correo.{" "}
            <a
              href="/update-password"
              className="text-indigo-600 font-medium hover:underline"
            >
              Restablecer contraseña
            </a>
          </p>
        </section>
      </div>
    </PageShell>
  );
}
