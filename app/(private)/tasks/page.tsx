"use client";

import TasksBoard from "../../components/TasksBoard";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function GeneralTasksPage() {
  return (
    <PageShell>
      <PageHeader
        title="Tareas generales"
        description="Tareas generales que no pertenecen a un proyecto específico (roadmap general, ideas, tareas internas, etc.)."
      />
      <section>
        <TasksBoard
          projectId={null}
          title="Tablero de tareas"
          subtitle="Tareas generales que no pertenecen a un proyecto específico (roadmap general, ideas, tareas internas, etc.)."
        />
      </section>
    </PageShell>
  );
}