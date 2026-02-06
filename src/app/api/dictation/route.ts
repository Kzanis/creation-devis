import { NextRequest, NextResponse } from "next/server";

/**
 * API Route proxy pour le workflow n8n Dictation.
 * Évite les problèmes CORS en faisant transiter la requête par le serveur Next.js.
 */
export async function POST(request: NextRequest) {
  const webhookUrl = process.env.WEBHOOK_N8N_DICTATION_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: "WEBHOOK_N8N_DICTATION_URL non configuré" },
      { status: 500 }
    );
  }

  try {
    // Récupérer le FormData de la requête entrante
    const formData = await request.formData();

    // Transférer vers n8n
    const response = await fetch(webhookUrl, {
      method: "POST",
      body: formData,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Erreur n8n:", response.status, responseText);
      return NextResponse.json(
        { success: false, error: `Erreur n8n: ${response.status} - ${responseText}` },
        { status: response.status }
      );
    }

    // Gérer le cas où n8n renvoie une réponse vide
    if (!responseText || responseText.trim() === "") {
      console.error("Réponse vide de n8n");
      return NextResponse.json(
        { success: false, error: "Réponse vide du serveur n8n" },
        { status: 502 }
      );
    }

    // Parser le JSON avec gestion d'erreur
    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch {
      console.error("Réponse non-JSON de n8n:", responseText);
      return NextResponse.json(
        { success: false, error: `Réponse invalide de n8n: ${responseText.substring(0, 200)}` },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Erreur proxy dictation:", error);
    return NextResponse.json(
      { success: false, error: `Erreur lors de l'appel au webhook: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
