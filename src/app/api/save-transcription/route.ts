import { NextRequest, NextResponse } from "next/server";

/**
 * Sauvegarde le releve complet (texte accumule) dans Airtable.
 * Appelee une seule fois quand l'utilisateur clique "Envoyer le releve".
 */
export async function POST(request: NextRequest) {
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return NextResponse.json(
      { success: false, error: "Configuration Airtable manquante" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { text, dossier_id, dossier_numero, dossier_client, client_id } = body;

    if (!text || text.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Texte vide" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Transcriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [
            {
              fields: {
                Titre: dossier_numero && dossier_client
                  ? `${dossier_numero} — ${dossier_client}`
                  : dossier_numero || dossier_client || "Sans dossier",
                Texte: text.trim(),
                "Dossier ID": dossier_id || "",
                "Dossier Numero": dossier_numero || "",
                Client: dossier_client || "",
                Statut: "brouillon",
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Erreur Airtable:", response.status, errText);
      return NextResponse.json(
        { success: false, error: `Erreur Airtable: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const recordId = data.records?.[0]?.id;

    return NextResponse.json({
      success: true,
      transcription_id: recordId,
      message: "Releve enregistre",
    });
  } catch (error) {
    console.error("Erreur save-transcription:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
