"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { AssigneeDropdown } from "@/app/components/AssigneeDropdown";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Abierto" },
  { value: "in_progress", label: "En progreso" },
  { value: "resolved", label: "Resuelto" },
  { value: "closed", label: "Cerrado" },
  { value: "cancelled", label: "Cancelado" },
];

const inputClass =
  "w-full rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";

export default function ProjectNewTicketPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = (params?.id ?? "") as string;
  const fromQuick = searchParams?.get("from") === "quick";

  const [showCreandoBanner, setShowCreandoBanner] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeProfileId, setAssigneeProfileId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [status, setStatus] = useState<TicketStatus>("open");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [memberProfiles, setMemberProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);

  const loadMembers = useCallback(async () => {
    if (!projectId) return;
    const { data: membersRes } = await supabase
      .from("project_members")
      .select("profile_id, user_id")
      .eq("project_id", projectId);
    const profileIds = (membersRes ?? [])
      .map((r: { profile_id?: string | null; user_id?: string | null }) => r.profile_id ?? r.user_id)
      .filter((id): id is string => id != null && id !== "");
    if (profileIds.length === 0) {
      setMemberProfiles([]);
      return;
    }
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds);
    setMemberProfiles((profilesData ?? []) as { id: string; full_name: string | null; email: string | null }[]);
  }, [projectId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const assigneeOptions = useMemo(
    () =>
      memberProfiles.map((p) => ({
        value: p.id,
        label: p.full_name || p.email || p.id,
      })),
    [memberProfiles]
  );

  useEffect(() => {
    if (fromQuick) {
      setShowCreandoBanner(true);
      const t = setTimeout(() => setShowCreandoBanner(false), 2000);
      return () => clearTimeout(t);
    }
  }, [fromQuick]);

  useEffect(() => {
    if (fromQuick && titleInputRef.current) {
      const t = setTimeout(() => titleInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [fromQuick]);

  useEffect(() => {
    if (fromQuick && projectId) {
      router.replace(`/projects/${projectId}/tickets/new`);
    }
  }, [fromQuick, projectId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const titleTrim = title.trim();
    if (!titleTrim) {
      setErrorMsg("El título es obligatorio.");
      return;
    }

    if (!projectId) {
      setErrorMsg("Falta el identificador del proyecto.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          title: titleTrim,
          description: description.trim() || null,
          priority,
          status,
          project_id: projectId,
          due_date: dueDate.trim() || null,
          assigned_to: assigneeProfileId,
        })
        .select("id")
        .single();

      if (error) {
        handleSupabaseError("tickets insert", error);
        const code = (error as { code?: string }).code;
        const msg = String((error as { message?: string }).message ?? "");
        if (code === "23514" || msg.includes("tickets_client_or_project_chk")) {
          setErrorMsg("El ticket no puede estar asociado a un proyecto y a un cliente al mismo tiempo.");
        } else {
          setErrorMsg(error.message ?? "No se pudo crear el ticket. Inténtalo de nuevo más tarde.");
        }
        setSubmitting(false);
        return;
      }

      const createdId = data?.id as string | undefined;
      if (createdId) {
        router.push(`/projects/${projectId}/tickets`);
      } else {
        setErrorMsg("El ticket se creó pero no se pudo redirigir. Ve a la lista de tickets.");
      }
    } catch {
      setErrorMsg("No se pudo crear el ticket. Inténtalo de nuevo más tarde.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!projectId) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <p className="text-sm text-slate-400">Identificador de proyecto no válido.</p>
        <Link href="/projects" className="inline-block text-sm text-indigo-400 hover:text-indigo-300">
          Volver a proyectos
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      {showCreandoBanner && (
        <div className="rounded-xl border border-slate-600/60 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
          Creando…
        </div>
      )}
      <header>
        <ProjectPageHeader
          variant="section"
          dark
          title="Nuevo ticket del proyecto"
          subtitle="Crea un ticket vinculado a este proyecto. Quedará visible en la sección Tickets del proyecto."
        />
      </header>

      {errorMsg && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
          {/* Sección 1 — Información principal */}
          <div className="space-y-6">
            <h2 className="text-xs uppercase tracking-wide text-slate-400">
              Información principal
            </h2>
            <div>
              <label className={labelClass}>Título *</label>
              <input
                ref={titleInputRef}
                type="text"
                className={inputClass}
                placeholder="Resumen del ticket"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Descripción (opcional)</label>
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                rows={3}
                placeholder="Detalles del ticket"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Sección 2 — Gestión */}
          <div className="space-y-6">
            <h2 className="text-xs uppercase tracking-wide text-slate-400">
              Gestión
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Asignado a</label>
                <div className="flex items-center gap-2 min-h-[42px]">
                  <AssigneeDropdown
                    options={assigneeOptions}
                    value={assigneeProfileId}
                    onChange={setAssigneeProfileId}
                    placeholder="Sin asignar"
                    variant={assigneeProfileId ? "assigned" : "unassigned"}
                    className="w-full max-w-xs"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Prioridad</label>
                <select
                  className={inputClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                <select
                  className={inputClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Fecha límite (opcional)</label>
                <input
                  type="date"
                  className={inputClass}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-700/60">
            <Link
              href={`/projects/${projectId}/tickets`}
              className="inline-flex items-center rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-xl border border-indigo-500/50 bg-indigo-500/20 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Creando…" : "Crear ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
