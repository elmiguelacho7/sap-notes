"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si ya hay sesión, mandamos directo al dashboard
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/dashboard");
      }
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-slate-50 flex">
      {/* Panel izquierdo tipo “branding” */}
      <section className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 text-white p-10 flex-col justify-between">
        <header className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-sm font-bold">
            PH
          </div>
          <span className="text-sm font-medium tracking-wide">
            Project Hub
          </span>
        </header>

        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-snug">
            Centraliza la documentación
            <br />
            técnica de tus proyectos.
          </h1>
          <p className="text-sm text-blue-100 max-w-md">
            Un entorno privado para registrar decisiones, notas funcionales
            y detalles clave de tus implementaciones, siempre a tu alcance.
          </p>
        </div>

        <p className="text-[11px] text-blue-100/80">
          Acceso restringido · Información interna
        </p>
      </section>

      {/* Panel derecho: formulario */}
      <section className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <h1 className="text-2xl font-semibold text-slate-900">
              Project Hub
            </h1>
            <p className="text-sm text-slate-500">
              Acceso seguro a la gestión de proyectos.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Iniciar sesión
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Introduce tus credenciales para acceder al espacio interno.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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
                {loading ? "Validando..." : "Acceder"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-[11px] text-slate-400 text-center">
            Uso interno · No compartas tus credenciales.
          </p>
        </div>
      </section>
    </main>
  );
}