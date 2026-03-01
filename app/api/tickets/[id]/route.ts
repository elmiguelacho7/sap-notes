import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUserWithRoleFromRequest,
} from "@/lib/auth/serverAuth";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = ["open", "in_progress", "resolved", "closed", "cancelled"] as const;

/**
 * PATCH /api/tickets/[id]
 * Updates ticket status (e.g. to "closed"). Body: { status: "closed" }.
 * Authorization: authenticated user (refine later with project role).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserWithRoleFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión para continuar." },
        { status: 403 }
      );
    }

    const { id: ticketId } = await params;
    if (!ticketId || String(ticketId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del ticket." },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : null;
    if (!status || !ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
      return NextResponse.json(
        { error: "Se requiere status válido: open, in_progress, resolved, closed, cancelled." },
        { status: 400 }
      );
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
 * Hard-deletes a ticket. Authorization: superadmin only.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores pueden eliminar tickets." },
        { status: 403 }
      );
    }

    const { id: ticketId } = await params;
    if (!ticketId || String(ticketId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del ticket." },
        { status: 400 }
      );
    }

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
