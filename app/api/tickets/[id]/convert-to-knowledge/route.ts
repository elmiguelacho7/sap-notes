import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

const DEFAULT_SPACE_NAME = "Ticket solutions";

/**
 * POST /api/tickets/[id]/convert-to-knowledge
 * Creates a knowledge page from the ticket (title + solution_markdown/description) and links it.
 * Requires manage_project_tickets on the ticket's project.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: ticketId } = await params;
    if (!ticketId?.trim()) {
      return NextResponse.json({ error: "Se requiere el id del ticket." }, { status: 400 });
    }

    const { data: ticketRow, error: fetchErr } = await supabaseAdmin
      .from("tickets")
      .select("id, title, description, solution_markdown, knowledge_page_id, project_id")
      .eq("id", ticketId)
      .single();

    if (fetchErr || !ticketRow) {
      return NextResponse.json({ error: "Ticket no encontrado." }, { status: 404 });
    }

    const projectId = (ticketRow.project_id as string | null) ?? null;
    if (!projectId) {
      return NextResponse.json(
        { error: "Solo se pueden convertir tickets vinculados a un proyecto." },
        { status: 400 }
      );
    }

    if (ticketRow.knowledge_page_id) {
      return NextResponse.json(
        { error: "Este ticket ya tiene una página de conocimiento vinculada.", knowledge_page_id: ticketRow.knowledge_page_id },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(request, projectId, "manage_project_tickets");
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const title = String((ticketRow.title as string) ?? "Sin título").trim() || "Ticket";
    const summary =
      (ticketRow.solution_markdown as string | null) ?? (ticketRow.description as string | null) ?? null;

    let spaceId: string;

    const { data: existingSpace } = await supabaseAdmin
      .from("knowledge_spaces")
      .select("id")
      .eq("project_id", projectId)
      .eq("name", DEFAULT_SPACE_NAME)
      .maybeSingle();

    if (existingSpace?.id) {
      spaceId = existingSpace.id;
    } else {
      const { data: newSpace, error: spaceErr } = await supabaseAdmin
        .from("knowledge_spaces")
        .insert({
          project_id: projectId,
          owner_profile_id: userId,
          name: DEFAULT_SPACE_NAME,
          description: "Páginas creadas desde tickets resueltos.",
          visibility: "private",
          sort_order: 0,
        })
        .select("id")
        .single();

      if (spaceErr || !newSpace?.id) {
        console.error("convert-to-knowledge create space", spaceErr);
        return NextResponse.json(
          { error: "No se pudo crear el espacio de conocimiento." },
          { status: 500 }
        );
      }
      spaceId = newSpace.id;
    }

    const slug =
      title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") || "page";
    const slugUnique = `${slug}-${Date.now().toString(36)}`;

    const { data: page, error: pageErr } = await supabaseAdmin
      .from("knowledge_pages")
      .insert({
        space_id: spaceId,
        owner_profile_id: userId,
        title,
        slug: slugUnique,
        page_type: "troubleshooting",
        summary: summary?.trim() || null,
      })
      .select("id, title, space_id")
      .single();

    if (pageErr || !page?.id) {
      console.error("convert-to-knowledge create page", pageErr);
      return NextResponse.json(
        { error: "No se pudo crear la página de conocimiento." },
        { status: 500 }
      );
    }

    const { error: updateErr } = await supabaseAdmin
      .from("tickets")
      .update({ knowledge_page_id: page.id, updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    if (updateErr) {
      console.error("convert-to-knowledge update ticket", updateErr);
      return NextResponse.json(
        { error: "Página creada pero no se pudo vincular al ticket." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      knowledge_page_id: page.id,
      page: { id: page.id, title: page.title, space_id: page.space_id },
    });
  } catch (err) {
    console.error("convert-to-knowledge error", err);
    return NextResponse.json(
      { error: "No se pudo convertir el ticket en página de conocimiento." },
      { status: 500 }
    );
  }
}
