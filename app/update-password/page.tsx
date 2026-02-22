"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Comprobar que venimos de un enlace de recuperación válido
  useEffect(() => {
    const check = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("getSession error (update-password)", error);
        setHasRecoverySession(false);
      } else {
        setHasRecoverySession(!!data.session);
      }

      setCheckingSession(false);
    };

    void check();
  }, []);

  const validate = () => {
    if (!password || !passwordConfirm) {
      setErrorMsg("Introduce y confirma tu nueva contraseña.");
      return false;
    }

    if (password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      return false;
    }

    if (password !== passwordConfirm) {
      setErrorMsg("Las contraseñas no coinciden.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error("updateUser password error", error);
        setErrorMsg(error.message || "No se pudo actualizar la contraseña.");
        return;
      }

      setMessage(
        "Tu contraseña se ha actualizado correctamente. Ahora puedes iniciar sesión con la nueva contraseña."
      );

      // Cerrar sesión de seguridad y volver al login
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push("/");
      }, 1800);
    } catch (err) {
      console.error("Unexpected error updating password", err);
      setErrorMsg("Ha ocurrido un error inesperado. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- UI ----------

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-300">
          Verificando enlace de recuperación…
        </p>
      </main>
    );
  }

  if (!hasRecoverySession) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-7 shadow-[0_18px_45px_rgba(15,23,42,0.7)]">
          <h1 className="text-xl font-semibold text-slate-50 mb-2">
            Enlace no válido o caducado
          </h1>
          <p className="text-sm text-slate-400 mb-4">
            El enlace de recuperación ya no es válido o ha expirado. Solicita un
            nuevo correo de restablecimiento desde la página de inicio de sesión.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-semibold text-white py-2.5"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-7 shadow-[0_18px_45px_rgba(15,23,42,0.7)]">
        <header className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-400">
            SAP Notes Hub
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">
            Actualiza tu contraseña
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Has accedido desde un enlace de recuperación enviado por correo.
            Elige una nueva contraseña para tu cuenta.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5 text-sm">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-300"
            >
              Nueva contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>

          <div className="space-y-1.5 text-sm">
            <label
              htmlFor="passwordConfirm"
              className="block text-xs font-medium text-slate-300"
            >
              Confirmar contraseña
            </label>
            <input
              id="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="Repítela para confirmar"
              required
            />
          </div>

          <div className="min-h-[1.5rem] text-[11px]" aria-live="polite">
            {errorMsg && (
              <p className="text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-md px-2 py-1">
                {errorMsg}
              </p>
            )}
            {!errorMsg && message && (
              <p className="text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-md px-2 py-1">
                {message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-sm font-semibold text-white py-2.5 mt-1"
          >
            {submitting ? "Guardando…" : "Guardar nueva contraseña"}
          </button>

          <p className="mt-2 text-[11px] text-slate-500">
            Por seguridad, después de actualizar la contraseña te volveremos a
            pedir que inicies sesión.
          </p>
        </form>
      </div>
    </main>
  );
}