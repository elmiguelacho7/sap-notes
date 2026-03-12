import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClientRow = {
  id: string;
  name: string;
  created_at?: string;
  created_by?: string | null;
};

/**
 * GET /api/admin/clients
 * List all clients. Requires manage_clients.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_clients");
    if (auth instanceof NextResponse) return auth;

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
 * Create a client. Body: { name }. Requires manage_clients.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_clients");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

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
