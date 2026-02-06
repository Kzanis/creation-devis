import { NextRequest, NextResponse } from "next/server";

/**
 * API Route proxy pour le workflow n8n Photo Upload.
 * Evite les problemes CORS en faisant transiter la requete par le serveur Next.js.
 */
export async function POST(request: NextRequest) {
  const webhookUrl = process.env.WEBHOOK_N8N_PHOTO_UPLOAD_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: "WEBHOOK_N8N_PHOTO_UPLOAD_URL non configure" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();

    const response = await fetch(webhookUrl, {
      method: "POST",
      body: formData,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Erreur n8n photo:", response.status, responseText);
      return NextResponse.json(
        { success: false, error: `Erreur n8n: ${response.status} - ${responseText}` },
        { status: response.status }
      );
    }

    if (!responseText || responseText.trim() === "") {
      console.error("Reponse vide de n8n photo");
      return NextResponse.json(
        { success: false, error: "Reponse vide du serveur n8n" },
        { status: 502 }
      );
    }

    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch {
      console.error("Reponse non-JSON de n8n photo:", responseText);
      return NextResponse.json(
        { success: false, error: `Reponse invalide de n8n: ${responseText.substring(0, 200)}` },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Erreur proxy photo-upload:", error);
    return NextResponse.json(
      { success: false, error: `Erreur lors de l'appel au webhook: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
