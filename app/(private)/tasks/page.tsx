"use client";

import TasksBoard from "../../components/TasksBoard";

export default function GeneralTasksPage() {
  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Actividades generales
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tareas y actividades que no pertenecen a un proyecto específico
            (roadmap general, ideas, tareas internas, etc.).
          </p>
        </header>

        {/* Tablero de actividades generales */}
        <section>
          <TasksBoard projectId={null} />
        </section>
      </div>
    </main>
  );
}