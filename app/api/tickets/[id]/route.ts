import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  extractKnowledgeFromTicket,
  storeProjectMemory,
} from "@/lib/ai/projectMemory";

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = ["open", "in_progress", "resolved", "closed", "cancelled"] as const;

/**
 * PATCH /api/tickets/[id]
 * Updates ticket status (e.g. to "closed"). Body: { status: "closed" }.
 * Requires manage_project_tickets on the ticket's project.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: ticketId } = await params;
    if (!ticketId || String(ticketId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del ticket." },
        { status: 400 }
      );
    }

    const { data: ticketRow, error: fetchErr } = await supabaseAdmin
      .from("tickets")
      .select("id, title, description, project_id, assigned_to")
      .eq("id", ticketId)
      .single();

    if (fetchErr || !ticketRow) {
      return NextResponse.json(
        { error: "Ticket no encontrado." },
        { status: 404 }
      );
    }

    const projectId = (ticketRow.project_id as string | null) ?? null;
    if (!projectId) {
      return NextResponse.json(
        { error: "Ticket sin proyecto asociado." },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(request, projectId, "manage_project_tickets");
    if (auth instanceof NextResponse) return auth;
    const user = { userId: auth.userId };

    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : null;
    if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json(
        { error: "Se requiere status válido: open, in_progress, resolved, closed, cancelled." },
        { status: 400 }
      );
    }

    if (status === "closed") {
      if (ticketRow.project_id && (ticketRow.title || ticketRow.description)) {
        const pid = ticketRow.project_id as string;
        const userIdForMemory = (ticketRow.assigned_to as string | null) ?? user.userId ?? null;
        const record = extractKnowledgeFromTicket(
          (ticketRow.title as string) ?? "Issue resolved",
          (ticketRow.description as string) || null
        );
        storeProjectMemory(pid, userIdForMemory, record, "ticket_closed").catch((err) =>
          console.error("[tickets] project memory store failed", err)
        );
      }
    }

    const { error } = await supabaseAdmin
      .from("tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    if (error) {
      console.error("tickets PATCH error", error);
      return NextResponse.json(
        { error: "No se pudo actualizar el ticket." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("tickets PATCH error", err);
    return NextResponse.json(
      { error: "No se pudo actualizar el ticket." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tickets/[id]
 * Hard-deletes a ticket. Requires manage_project_tickets on the ticket's project.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: ticketId } = await params;
    if (!ticketId || String(ticketId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del ticket." },
        { status: 400 }
      );
    }

    const { data: ticketRow, error: fetchErr } = await supabaseAdmin
      .from("tickets")
      .select("project_id")
      .eq("id", ticketId)
      .maybeSingle();

    if (fetchErr || !ticketRow) {
      return NextResponse.json(
        { error: "Ticket no encontrado." },
        { status: 404 }
      );
    }

    const projectId = (ticketRow.project_id as string | null) ?? null;
    if (!projectId) {
      return NextResponse.json(
        { error: "Ticket sin proyecto asociado." },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(request, projectId, "manage_project_tickets");
    if (auth instanceof NextResponse) return auth;

    const { error } = await supabaseAdmin
      .from("tickets")
      .delete()
      .eq("id", ticketId);

    if (error) {
      console.error("tickets DELETE error", error);
      return NextResponse.json(
        { error: "No se pudo eliminar el ticket." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("tickets DELETE error", err);
    return NextResponse.json(
      { error: "No se pudo eliminar el ticket." },
      { status: 500 }
    );
  }
}
