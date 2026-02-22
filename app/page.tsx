"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type Mode = "signin" | "signup";

const MIN_PASSWORD_LENGTH = 6;

// URL base del sitio: se inyecta desde NEXT_PUBLIC_SITE_URL
// En local:  http://localhost:3000
// En Vercel: https://tu-dominio.vercel.app
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Popup "Olvidé mi contraseña"
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // ---------- Redirigir si ya hay sesión (sin mostrar proyectos) ----------
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session) {
        // Usuario ya logueado -> lo mando directo al panel protegido
        router.push("/projects");
      }
    };
    void checkSession();
  }, [router]);

  // ---------- Validaciones login ----------

  const validateForm = () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Introduce tu email y contraseña.");
      return false;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      setErrorMsg("Introduce un email válido.");
      return false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        setMessage("Inicio de sesión correcto ✅");
        // Después de logarte, te llevo directo a /notes
        setTimeout(() => router.push("/notes"), 400);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        setMessage(
          "Cuenta creada. Si tienes activada la confirmación por email, revisa tu bandeja de entrada ✉️"
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Ha ocurrido un error inesperado.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setErrorMsg(null);
    setMessage(null);
  };

  // ---------- Reset password modal ----------

  const openResetModal = () => {
    setResetEmail(email || "");
    setResetError(null);
    setResetMessage(null);
    setResetSent(false);
    setShowResetModal(true);
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetLoading(false);
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetMessage(null);

    const emailTrim = resetEmail.trim();
    const emailRegex = /\S+@\S+\.\S+/;

    if (!emailTrim) {
      setResetError("Introduce tu email para enviar el enlace de recuperación.");
      return;
    }

    if (!emailRegex.test(emailTrim)) {
      setResetError("Introduce un email válido.");
      return;
    }

    try {
      setResetLoading(true);

      // URL a la que redirigirá el enlace de Supabase
      const redirectTo = `${SITE_URL}/update-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(emailTrim, {
        redirectTo,
      });

      if (error) throw error;

      setResetMessage(
        "Si el email existe en el sistema, te hemos enviado un enlace para restablecer tu contraseña. Revisa también la carpeta de spam."
      );
      setResetSent(true);
    } catch (err: unknown) {
      const base =
        "No se ha podido enviar el email de recuperación. Inténtalo de nuevo en unos minutos.";
      let msg = base;

      if (err instanceof Error) {
        const lower = err.message.toLowerCase();
        if (lower.includes("rate limit")) {
          msg =
            "Has solicitado demasiados correos en poco tiempo. Espera unos minutos antes de volver a intentarlo.";
        } else {
          msg = err.message || base;
        }
      }

      setResetError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  // ---------- UI (marketing estático + login) ----------

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Panel lateral tipo marketing (SIN datos reales del usuario) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[44%] border-r border-slate-200 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-sky-500/25 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />
        </div>

        <header className="relative px-8 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/40">
              <span className="text-xs font-bold tracking-tight text-slate-950">
                SN
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">
                SAP Notes Hub
              </p>
              <p className="text-[11px] text-slate-300">
                by elmiguelacho.com
              </p>
            </div>
          </div>
        </header>

        <main className="relative flex-1 px-8 pb-10 flex flex-col justify-between gap-8">
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Tu panel de notas SAP
              </h1>
              <p className="mt-2 text-sm text-slate-200/90 max-w-md">
                Centraliza proyectos, errores y configuraciones SAP S/4HANA en
                un único panel. Encuentra rápido qué hiciste en cada rollout.
              </p>
            </div>

            {/* Cards de ejemplo (valores genéricos, NO datos reales) */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-2xl bg-slate-900/70 border border-slate-700/70 px-3 py-3">
                <p className="text-slate-400 mb-1">Proyectos SAP</p>
                <p className="text-lg font-semibold">∞</p>
                <p className="text-[11px] text-emerald-400 mt-1">
                  Centraliza cada implementación.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900/70 border border-slate-700/70 px-3 py-3">
                <p className="text-slate-400 mb-1">Clientes</p>
                <p className="text-lg font-semibold">Flexibles</p>
                <p className="text-[11px] text-emerald-400 mt-1">
                  Agrupa por organización o país.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900/70 border border-slate-700/70 px-3 py-3">
                <p className="text-slate-400 mb-1">Módulos</p>
                <p className="text-lg font-semibold">SD · MM · FI…</p>
                <p className="text-[11px] text-sky-400 mt-1">
                  Diseñado para implementaciones complejas.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/70 border border-slate-700/70 px-4 py-3">
              <p className="text-xs font-medium text-slate-200 mb-1">
                Pensado para consultores
              </p>
              <p className="text-[11px] text-slate-400">
                Ideal si saltas entre rollouts, ECC y S/4HANA y necesitas un
                historial claro de lo que hiciste en cada cliente.
              </p>
            </div>
          </div>

          <footer className="relative text-[11px] text-slate-400">
            <p>
              Accede con tu usuario para ver tus notas reales. Esta vista solo
              muestra información de ejemplo.
            </p>
          </footer>
        </main>
      </aside>

      {/* Panel derecho: SIEMPRE login / registro */}
      <section className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-[0_18px_45px_rgba(15,23,42,0.12)] px-6 py-7">
          <header className="mb-6">
            <p className="text-xs font-semibold text-sky-600 mb-1">
              {mode === "signin" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              {mode === "signin"
                ? "Accede a tu panel de notas"
                : "Empieza a centralizar tus notas SAP"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Usa el mismo correo que utilizas en tus proyectos o en tu
              consultora.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5 text-sm">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="tu.email@consultora.com"
              />
            </div>

            <div className="space-y-1.5 text-sm">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-700"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={toggleMode}
                className="text-[11px] text-sky-600 hover:text-sky-500 font-medium"
              >
                {mode === "signin"
                  ? "¿No tienes cuenta? Crear una"
                  : "¿Ya tienes cuenta? Inicia sesión"}
              </button>

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={openResetModal}
                  className="text-[11px] text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>

            <div className="min-h-[1.5rem]" aria-live="polite">
              {errorMsg && (
                <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2 py-1">
                  {errorMsg}
                </p>
              )}
              {!errorMsg && message && (
                <p className="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1">
                  {message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-semibold text-white py-2.5"
            >
              {loading
                ? mode === "signin"
                  ? "Entrando…"
                  : "Creando cuenta…"
                : mode === "signin"
                ? "Entrar en SAP Notes Hub"
                : "Crear cuenta"}
            </button>

            <p className="text-[11px] text-slate-400 pt-1">
              Usarás este usuario para acceder a tus notas de implementación
              SAP desde cualquier dispositivo.
            </p>
          </form>
        </div>

        {/* Modal reset password */}
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-5 relative">
              <button
                type="button"
                onClick={closeResetModal}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>

              <h2 className="text-sm font-semibold text-slate-900 mb-1">
                Restablecer contraseña
              </h2>
              <p className="text-[11px] text-slate-500 mb-3">
                Introduce tu email y, si existe en SAP Notes Hub, te enviaremos
                un enlace para crear una nueva contraseña. Revisa también la
                carpeta de spam.
              </p>

              <form
                onSubmit={handleResetPassword}
                className="space-y-3 text-sm"
              >
                <div className="space-y-1">
                  <label
                    htmlFor="resetEmail"
                    className="block text-[11px] text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="tu.email@consultora.com"
                    required
                  />
                </div>

                <div
                  className="min-h-[1.5rem] text-[11px]"
                  aria-live="polite"
                >
                  {resetError && (
                    <p className="text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2 py-1">
                      {resetError}
                    </p>
                  )}
                  {!resetError && resetMessage && (
                    <p className="text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1">
                      {resetMessage}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-1">
                  <button
                    type="submit"
                    disabled={resetLoading || resetSent}
                    className="flex-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 disabled:cursor-not-allowed py-2 text-xs font-semibold text-white transition-colors"
                  >
                    {resetLoading
                      ? "Enviando…"
                      : resetSent
                      ? "Enlace enviado"
                      : "Enviar enlace"}
                  </button>
                  <button
                    type="button"
                    onClick={closeResetModal}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}