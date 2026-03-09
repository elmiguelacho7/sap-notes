"use client";

import Link from "next/link";

export default function RegisterSuccessPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <div className="rounded-full bg-emerald-100 w-12 h-12 flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Cuenta creada
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Tu cuenta ha sido creada y está pendiente de activación por un administrador.
            Recibirás acceso cuando tu cuenta sea activada.
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
