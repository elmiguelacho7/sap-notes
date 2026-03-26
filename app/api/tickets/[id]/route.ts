import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  extractKnowledgeFromTicket,
  storeProjectMemory,
} from "@/lib/ai/projectMemory";

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

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
      .select("id, title, description, solution_markdown, project_id, assigned_to")
      .eq("id", ticketId)
      .single();

    if (fetchErr || !ticketRow) {
      return NextResponse.json(
        { error: "Ticket no encontrado." },
        { status: 404 }
      );
    }

    const projectId = (ticketRow.project_id as string | null) ?? null;
    let userId: string;
    if (projectId) {
      const auth = await requireAuthAndProjectPermission(request, projectId, "manage_project_tickets");
      if (auth instanceof NextResponse) return auth;
      userId = auth.userId;
    } else {
      const globalUserId = await getCurrentUserIdFromRequest(request);
      if (!globalUserId?.trim()) {
        return NextResponse.json({ error: "No autorizado." }, { status: 401 });
      }
      userId = globalUserId;
    }

    const body = (await request.json().catch(() => ({}))) as {
      status?: string;
      assigned_to?: string | null;
      solution_markdown?: string | null;
      root_cause?: string | null;
      resolution_type?: string | null;
    };
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : null;
    const hasStatus = status && ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number]);
    const solutionMarkdown = body.solution_markdown !== undefined ? body.solution_markdown : undefined;
    const rootCause = body.root_cause !== undefined ? body.root_cause : undefined;
    const resolutionType = body.resolution_type !== undefined ? body.resolution_type : undefined;
    const assignedTo = body.assigned_to !== undefined ? body.assigned_to : undefined;
    const hasSolutionFields =
      solutionMarkdown !== undefined || rootCause !== undefined || resolutionType !== undefined || assignedTo !== undefined;

    if (!hasStatus && !hasSolutionFields) {
      return NextResponse.json(
        { error: "Se requiere status o al menos un campo (solution_markdown, root_cause, resolution_type)." },
        { status: 400 }
      );
    }
    if (hasStatus && !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json(
        { error: "Status válido: open, in_progress, resolved, closed." },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (hasStatus) updatePayload.status = status;
    if (assignedTo !== undefined) updatePayload.assigned_to = assignedTo;
    if (solutionMarkdown !== undefined) updatePayload.solution_markdown = solutionMarkdown;
    if (rootCause !== undefined) updatePayload.root_cause = rootCause;
    if (resolutionType !== undefined) updatePayload.resolution_type = resolutionType;

    if (hasStatus && status === "closed") {
      const currentSolution =
        (solutionMarkdown !== undefined ? solutionMarkdown : (ticketRow.solution_markdown as string | null)) ??
        (ticketRow.description as string | null) ??
        null;
      if (
        ticketRow.project_id &&
        ((ticketRow.title as string) || currentSolution)
      ) {
        const pid = ticketRow.project_id as string;
        const userIdForMemory = (ticketRow.assigned_to as string | null) ?? userId ?? null;
        const record = extractKnowledgeFromTicket(
          (ticketRow.title as string) ?? "Issue resolved",
          (ticketRow.description as string) || null,
          (currentSolution as string) || null
        );
        if (record.solution.trim()) {
          storeProjectMemory(pid, userIdForMemory, record, "ticket_closed").catch((err) =>
            console.error("[tickets] project memory store failed", err)
          );
        }
      }
    }

    const { error } = await supabaseAdmin
      .from("tickets")
      .update(updatePayload)
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
