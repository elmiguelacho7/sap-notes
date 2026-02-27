import { NextResponse } from "next/server";
import { handleSupabaseError } from "@/lib/supabaseError";

const N8N_WEBHOOK_URL =
  "https://magm77.app.n8n.cloud/webhook/e767a640-3154-4e24-b575-4d292b2e0db5";

// Lo que tú le envías a n8n desde el frontend
type N8nRequestBody = {
  message: string;
  projectId?: string;
  sessionId?: string;
  scope?: string;
};

// Lo que esperas de vuelta de n8n
type N8nResponseBody = {
  reply?: string;
  [key: string]: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as N8nRequestBody;

    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    let data: N8nResponseBody;

    try {
      data = JSON.parse(text) as N8nResponseBody;
    } catch {
      // Si n8n devuelve texto plano, lo envolvemos en un objeto
      data = { reply: text };
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    handleSupabaseError("api/n8n", error);
    return NextResponse.json(
      { reply: "Error conectando con n8n desde el servidor." },
      { status: 500 }
    );
  }
}