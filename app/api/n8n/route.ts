import { NextResponse } from "next/server";

const N8N_WEBHOOK_URL =
  "https://magm77.app.n8n.cloud/webhook/e767a640-3154-4e24-b575-4d292b2e0db5";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { reply: text };
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error en /api/n8n:", error);
    return NextResponse.json(
      { reply: "Error conectando con n8n desde el servidor." },
      { status: 500 }
    );
  }
}