"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import type {
  TicketDetail,
  TicketDetailRow,
  TicketCommentDetail,
  TicketAttachmentDetail,
  ProfileOption,
} from "@/components/tickets/ticketTypes";
import TicketHeader from "@/components/tickets/TicketHeader";
import TicketDetailsCard from "@/components/tickets/TicketDetailsCard";
import TicketDescriptionCard from "@/components/tickets/TicketDescriptionCard";
import TicketCommentsPanel from "@/components/tickets/TicketCommentsPanel";
import TicketAttachmentsPanel from "@/components/tickets/TicketAttachmentsPanel";

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = (params?.id ?? "") as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [comments, setComments] = useState<TicketCommentDetail[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachmentDetail[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const currentTicketIdRef = useRef<string>(ticketId);

  const loadTicket = useCallback(async () => {
    if (!ticketId) return null;

    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (error) {
      handleSupabaseError("tickets", error);
      return null;
    }
    return data as TicketDetailRow;
  }, [ticketId]);

  const loadRelated = useCallback(
    async (row: TicketDetailRow | null): Promise<TicketDetail | null> => {
      if (!row) return null;

      const [clientRes, projectRes, createdByRes, assignedToRes] = await Promise.all([
        row.client_id
          ? supabase.from("clients").select("name").eq("id", row.client_id).single()
          : Promise.resolve({ data: null, error: null }),
        row.project_id
          ? supabase.from("projects").select("name").eq("id", row.project_id).single()
          : Promise.resolve({ data: null, error: null }),
        row.created_by
          ? supabase.from("profiles").select("full_name").eq("id", row.created_by).single()
          : Promise.resolve({ data: null, error: null }),
        row.assigned_to
          ? supabase.from("profiles").select("full_name").eq("id", row.assigned_to).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (clientRes.error && hasLoggableSupabaseError(clientRes.error))
        handleSupabaseError("ticket client", clientRes.error);
      if (projectRes.error && hasLoggableSupabaseError(projectRes.error))
        handleSupabaseError("ticket project", projectRes.error);
      if (createdByRes.error && hasLoggableSupabaseError(createdByRes.error))
        handleSupabaseError("ticket created_by", createdByRes.error);
      if (assignedToRes.error && hasLoggableSupabaseError(assignedToRes.error))
        handleSupabaseError("ticket assigned_to", assignedToRes.error);

      const clientName = clientRes.data ? (clientRes.data as { name: string }).name : null;
      const projectName = projectRes.data ? (projectRes.data as { name: string }).name : null;
      const createdByName = createdByRes.data
        ? (createdByRes.data as { full_name: string | null }).full_name
        : null;
      const assignedToName = assignedToRes.data
        ? (assignedToRes.data as { full_name: string | null }).full_name
        : null;

      return {
        ...row,
        client_name: clientName,
        project_name: projectName,
        created_by_name: createdByName,
        assigned_to_name: assignedToName,
      };
    },
    []
  );

  const loadComments = useCallback(async () => {
    if (!ticketId) return [];

    const { data: commentsData, error } = await supabase
      .from("ticket_comments")
      .select("id, body, is_internal, created_at, created_by")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      handleSupabaseError("ticket_comments", error);
      return [];
    }

    const list = (commentsData ?? []) as {
      id: string;
      body: string;
      is_internal: boolean;
      created_at: string;
      created_by: string | null;
    }[];

    if (list.length === 0) return [];

    const authorIds = Array.from(
      new Set(list.map((c) => c.created_by).filter((id): id is string => Boolean(id)))
    );
    const profilesMap: Record<string, string | null> = {};
    for (const id of authorIds) {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", id).single();
      profilesMap[id] = data ? (data as { full_name: string | null }).full_name : null;
    }

    return list.map(
      (c): TicketCommentDetail => ({
        id: c.id,
        body: c.body,
        is_internal: c.is_internal ?? false,
        created_at: c.created_at,
        created_by_name: c.created_by ? profilesMap[c.created_by] ?? null : null,
      })
    );
  }, [ticketId]);

  const loadAttachments = useCallback(async () => {
    if (!ticketId) return [];

    const { data, error } = await supabase
      .from("ticket_attachments")
      .select("id, file_name, file_url, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      handleSupabaseError("ticket_attachments", error);
      return [];
    }
    return (data ?? []) as TicketAttachmentDetail[];
  }, [ticketId]);

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (error && hasLoggableSupabaseError(error)) {
      handleSupabaseError("ticket detail profiles", error);
    }
    setProfiles((data ?? []) as ProfileOption[]);
  }, []);

  const loadAll = useCallback(async () => {
    if (!ticketId) {
      setLoading(false);
      return;
    }

    const idToLoad = ticketId;
    currentTicketIdRef.current = ticketId;

    setLoading(true);
    setErrorMsg(null);

    const row = await loadTicket();
    if (currentTicketIdRef.current !== idToLoad) {
      setLoading(false);
      return;
    }

    if (!row) {
      setErrorMsg("No se pudo cargar el ticket. Inténtalo de nuevo más tarde.");
      setTicket(null);
      setLoading(false);
      return;
    }

    const [detail, commentsList, attachmentsList] = await Promise.all([
      loadRelated(row),
      loadComments(),
      loadAttachments(),
    ]);

    if (currentTicketIdRef.current !== idToLoad) {
      setLoading(false);
      return;
    }

    setTicket(detail ?? null);
    setComments(commentsList);
    setAttachments(attachmentsList);
    setLoading(false);
  }, [ticketId, loadTicket, loadRelated, loadComments, loadAttachments]);

  useEffect(() => {
    currentTicketIdRef.current = ticketId;
    void loadAll();
  }, [loadAll, ticketId]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      if (!ticketId || !ticket) return;
      const payload: { status: string; closed_at?: string } = { status: newStatus };
      if (newStatus === "resolved" || newStatus === "closed") {
        payload.closed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("tickets").update(payload).eq("id", ticketId);
      if (error) {
        handleSupabaseError("tickets update status", error);
        setUpdateMsg("Error al actualizar el estado.");
        return;
      }
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              closed_at: payload.closed_at ?? prev.closed_at,
              updated_at: new Date().toISOString(),
            }
          : null
      );
      setUpdateMsg("Estado actualizado.");
      setTimeout(() => setUpdateMsg(null), 3000);
    },
    [ticketId, ticket]
  );

  const handlePriorityChange = useCallback(
    async (newPriority: string) => {
      if (!ticketId) return;
      const { error } = await supabase
        .from("tickets")
        .update({ priority: newPriority })
        .eq("id", ticketId);
      if (error) {
        handleSupabaseError("tickets update priority", error);
        setUpdateMsg("Error al actualizar la prioridad.");
        return;
      }
      setTicket((prev) =>
        prev ? { ...prev, priority: newPriority, updated_at: new Date().toISOString() } : null
      );
      setUpdateMsg("Prioridad actualizada.");
      setTimeout(() => setUpdateMsg(null), 3000);
    },
    [ticketId]
  );

  const handleAssignedToChange = useCallback(
    async (profileId: string) => {
      if (!ticketId) return;
      const { error } = await supabase
        .from("tickets")
        .update({ assigned_to: profileId || null })
        .eq("id", ticketId);
      if (error) {
        handleSupabaseError("tickets update assigned_to", error);
        setUpdateMsg("Error al actualizar el asignado.");
        return;
      }
      let name: string | null = null;
      if (profileId) {
        const fromList = profiles.find((p) => p.id === profileId)?.full_name ?? null;
        if (fromList != null) {
          name = fromList;
        } else {
          const { data } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", profileId)
            .single();
          name = data ? (data as { full_name: string | null }).full_name : null;
        }
      }
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              assigned_to: profileId || null,
              assigned_to_name: name,
              updated_at: new Date().toISOString(),
            }
          : null
      );
      setUpdateMsg("Asignado actualizado.");
      setTimeout(() => setUpdateMsg(null), 3000);
    },
    [ticketId, profiles]
  );

  const handleCommentAdded = useCallback(() => {
    void loadComments().then(setComments);
  }, [loadComments]);

  if (!ticketId) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-7">
        <p className="text-sm text-slate-600">No se ha encontrado el identificador del ticket.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-7">
        <p className="text-sm text-slate-500">Cargando ticket...</p>
      </div>
    );
  }

  if (errorMsg && !ticket) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-4">
        <button
          onClick={() => router.push("/tickets")}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Volver a tickets
        </button>
        <p className="text-sm text-red-600">{errorMsg}</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-4">
        <button
          onClick={() => router.push("/tickets")}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Volver a tickets
        </button>
        <p className="text-sm text-slate-600">No se encontró el ticket.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-7 space-y-5">
      <button
        onClick={() => router.push("/tickets")}
        className="text-[11px] text-slate-500 hover:text-slate-700"
      >
        ← Volver a tickets
      </button>

      {updateMsg && (
        <p
          className={
            updateMsg.startsWith("Error")
              ? "text-sm text-red-600"
              : "text-sm text-slate-600"
          }
        >
          {updateMsg}
        </p>
      )}

      <TicketHeader
        ticket={ticket}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TicketDetailsCard
            ticket={ticket}
            profiles={profiles}
            onAssignedToChange={handleAssignedToChange}
          />
          <TicketDescriptionCard ticket={ticket} />
        </div>
        <div className="space-y-6">
          <TicketCommentsPanel
            ticketId={ticketId}
            comments={comments}
            onCommentAdded={handleCommentAdded}
          />
          <TicketAttachmentsPanel attachments={attachments} />
        </div>
      </div>
    </div>
  );
}
