import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy vers le workflow n8n WF4 — Analyse de Plan.
 *
 * Le frontend envoie les images (base64) + dossier_id,
 * et cette route les forwarde au webhook n8n qui fait
 * la double passe LLM (extraction + verification).
 *
 * Fallback : si WEBHOOK_N8N_ANALYZE_PLAN_URL n'est pas
 * configure, appelle OpenRouter directement.
 */
export async function POST(request: NextRequest) {
  const webhookUrl = process.env.WEBHOOK_N8N_ANALYZE_PLAN_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: "WEBHOOK_N8N_ANALYZE_PLAN_URL non configure" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), // 2 min timeout
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[analyze-plan] Erreur n8n:", res.status, errText);
      return NextResponse.json(
        { success: false, error: `Erreur n8n: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[analyze-plan] Erreur:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
