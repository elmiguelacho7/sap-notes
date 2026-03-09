"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PendingActivationPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/");
      }
    });
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <div className="rounded-full bg-amber-100 w-12 h-12 flex items-center justify-center mx-auto mb-4 text-amber-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Cuenta pendiente de activación
          </h1>
          <p className="text-sm text-slate-600 mb-3">
            Tu correo ha sido confirmado correctamente.
          </p>
          <p className="text-sm text-slate-600 mb-3">
            Tu cuenta sigue pendiente de aprobación por un administrador. El acceso a la plataforma no está habilitado hasta que un administrador active tu cuenta.
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Si crees que es un error, contacta con el administrador de la plataforma.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-block rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  );
}
