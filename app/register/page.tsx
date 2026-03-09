"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 6;

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = fullName.trim();
    const mail = email.trim();
    const pwd = password;
    const confirm = confirmPassword;

    if (!mail) {
      setErrorMsg("El correo electrónico es obligatorio.");
      return;
    }
    if (pwd.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (pwd !== confirm) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: mail,
        password: pwd,
        options: {
          data: { full_name: name || undefined },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.debug(
          "[signup] Auth user created; DB trigger will create/update profile with is_active = false. Only admin-created users get is_active = true."
        );
      }

      router.replace("/register/success");
    } catch {
      setErrorMsg("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex">
      <section className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 text-white p-10 flex-col justify-between">
        <header className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-sm font-bold">
            PH
          </div>
          <span className="text-sm font-medium tracking-wide">Project Hub</span>
        </header>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-snug">
            Centraliza la documentación
            <br />
            técnica de tus proyectos.
          </h1>
          <p className="text-sm text-blue-100 max-w-md">
            Un entorno privado para registrar decisiones, notas funcionales
            y detalles clave de tus implementaciones.
          </p>
        </div>
        <p className="text-[11px] text-blue-100/80">Acceso restringido · Información interna</p>
      </section>

      <section className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <h1 className="text-2xl font-semibold text-slate-900">Project Hub</h1>
            <p className="text-sm text-slate-500">Crear cuenta</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Crear cuenta</h2>
            <p className="text-xs text-slate-500 mb-6">
              Regístrate para solicitar acceso a la plataforma. Un administrador activará tu cuenta.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Nombre completo</label>
                <input
                  type="text"
                  placeholder="Nombre y apellidos"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Correo electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
                <p className="text-[11px] text-slate-400">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Repetir contraseña <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {errorMsg && (
                <p className="text-xs text-red-500">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-medium transition"
              >
                {loading ? "Creando cuenta…" : "Crear cuenta"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-500">
              ¿Ya tienes cuenta?{" "}
              <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
