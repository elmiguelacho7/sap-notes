"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Project = {
  id: string;
  name: string;
  description: string | null;
  environment_type: "on_premise" | "cloud_public";
  created_at: string | null;
};

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/");
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, environment_type, created_at")
        .eq("created_by", userData.user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProjects(data as Project[]);
      }
      setLoading(false);
    };

    void load();
  }, [router]);

  const envLabel = (env: Project["environment_type"]) =>
    env === "cloud_public" ? "S/4HANA Cloud Public Edition" : "On Premise";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">
            Cargando tus proyectos SAP…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 md:px-8 py-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-sky-600 mb-1">
              Proyectos SAP
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              Tus implementaciones registradas
            </h1>
            <p className="text-[11px] text-slate-500 mt-1">
              Desde aquí podrás entrar al detalle de cada rollout o cliente.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/projects/new")}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white px-4 py-2.5"
          >
            + Nuevo proyecto
          </button>
        </header>

        {projects.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-xl px-4 py-6 text-sm text-slate-600">
            Aún no tienes proyectos creados. Empieza dando de alta tu primer
            proyecto SAP desde el botón{" "}
            <span className="font-semibold">“Nuevo proyecto”</span>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <article
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 hover:border-sky-200 hover:shadow-sm cursor-pointer"
                onClick={() => router.push(`/projects/${p.id}`)}
              >
                <h2 className="text-sm font-semibold text-slate-900">
                  {p.name}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {p.description || "Sin descripción todavía."}
                </p>
                <p className="text-[11px] text-sky-600 mt-1">
                  {envLabel(p.environment_type)}
                </p>
                <p className="text-[10px] text-slate-400 mt-auto">
                  Creado el{" "}
                  {p.created_at
                    ? new Date(p.created_at).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })
                    : "-"}
                </p>
              </article>
            ))}
          </div>
        )}

        <div className="text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => router.push("/notes")}
            className="underline underline-offset-2 hover:text-slate-600"
          >
            ← Volver al panel de notas
          </button>
        </div>
      </div>
    </main>
  );
}