"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Calendar } from "lucide-react";

export default function ProjectPlanningCalendarPage() {
  const params = useParams();
  const projectId = (params?.id ?? "") as string;

  if (!projectId) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <p className="text-sm text-slate-600">No se ha encontrado el identificador del proyecto.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href={`/projects/${projectId}/planning`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a planificación
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <Calendar className="mx-auto h-12 w-12 text-slate-300" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Calendario</h1>
          <p className="mt-2 text-sm text-slate-500">
            Calendario en construcción. Aquí podrás ver las fases y actividades en vista de calendario.
          </p>
          <Link
            href={`/projects/${projectId}/planning`}
            className="mt-6 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Ir a Fases del proyecto
          </Link>
        </div>
      </div>
    </main>
  );
}
