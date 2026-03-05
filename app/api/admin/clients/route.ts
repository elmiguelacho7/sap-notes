import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClientRow = {
  id: string;
  name: string;
  created_at?: string;
  created_by?: string | null;
};

/**
 * GET /api/admin/clients
 * List all clients. Superadmin only.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("id, name, created_at, created_by")
      .order("name", { ascending: true });

    if (error) {
      console.error("admin/clients GET error", error);
      return NextResponse.json(
        { error: "Error al cargar los clientes." },
        { status: 500 }
      );
    }

    return NextResponse.json({ clients: (data ?? []) as ClientRow[] });
  } catch (err) {
    console.error("admin/clients GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los clientes." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/clients
 * Create a client. Body: { name }. Superadmin only.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { name?: string };
    const name =
      typeof body.name === "string" && body.name.trim() !== ""
        ? body.name.trim()
        : null;

    if (!name) {
      return NextResponse.json(
        { error: "Se requiere el nombre del cliente." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert({ name, created_by: userId })
      .select("id, name, created_at, created_by")
      .single();

    if (error) {
      console.error("admin/clients POST error", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese nombre." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Error al crear el cliente." },
        { status: 500 }
      );
    }

    return NextResponse.json({ client: data as ClientRow });
  } catch (err) {
    console.error("admin/clients POST error", err);
    return NextResponse.json(
      { error: "Error al crear el cliente." },
      { status: 500 }
    );
  }
}
