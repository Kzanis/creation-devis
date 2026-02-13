import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tts
 * Proxy vers le webhook n8n TTS ou fallback OpenAI TTS direct.
 * Body: { text: string, voice?: string }
 * Returns: { success: boolean, audioBase64?: string, audioUrl?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { text, voice } = await request.json();

    if (!text || text.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Texte vide" },
        { status: 400 }
      );
    }

    // Try n8n webhook first
    const n8nTtsUrl = process.env.NEXT_PUBLIC_WEBHOOK_N8N_TTS_URL;

    if (n8nTtsUrl) {
      try {
        const res = await fetch(n8nTtsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), voice: voice || "alloy" }),
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";

          if (contentType.includes("audio")) {
            // n8n returned raw audio
            const buffer = await res.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            return NextResponse.json({
              success: true,
              audioBase64: base64,
              mimeType: contentType,
            });
          }

          // n8n returned JSON
          const data = await res.json();
          return NextResponse.json({
            success: true,
            audioUrl: data.audioUrl || data.url,
            audioBase64: data.audioBase64 || data.audio,
            mimeType: data.mimeType || "audio/mpeg",
          });
        }

        console.warn("n8n TTS failed, trying OpenAI direct:", res.status);
      } catch (e) {
        console.warn("n8n TTS unreachable, trying OpenAI direct:", e);
      }
    }

    // Fallback: OpenAI TTS direct via OpenRouter
    const AI_API_KEY = process.env.AI_API_KEY;
    if (!AI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Aucun service TTS disponible" },
        { status: 503 }
      );
    }

    // Use OpenAI TTS directly (not through OpenRouter)
    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text.trim().substring(0, 4096),
        voice: voice || "alloy",
        response_format: "mp3",
      }),
    });

    if (!ttsRes.ok) {
      console.error("OpenAI TTS error:", ttsRes.status);
      return NextResponse.json(
        { success: false, error: "Erreur TTS" },
        { status: 502 }
      );
    }

    const buffer = await ttsRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return NextResponse.json({
      success: true,
      audioBase64: base64,
      mimeType: "audio/mpeg",
    });
  } catch (error) {
    console.error("TTS route error:", error);
    return NextResponse.json(
      { success: false, error: "Erreur TTS" },
      { status: 500 }
    );
  }
}
