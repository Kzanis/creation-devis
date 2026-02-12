import { NextRequest, NextResponse } from "next/server";

/**
 * Sauvegarde une photo de chantier directement dans le dossier Airtable.
 *
 * Uploade la photo dans le champ "Photos Chantier" (multipleAttachments)
 * du record Dossier existant. Les photos s'accumulent dans le meme champ.
 */
export async function POST(request: NextRequest) {
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const ATTACHMENT_FIELD_ID = "fld0xy4E42TP6l96P"; // "Photos Chantier" dans Dossiers

  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return NextResponse.json(
      { success: false, error: "Configuration Airtable manquante" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    const dossierId = (formData.get("dossier_id") as string) || "";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Aucune photo recue" },
        { status: 400 }
      );
    }

    if (!dossierId) {
      return NextResponse.json(
        { success: false, error: "Aucun dossier selectionne" },
        { status: 400 }
      );
    }

    // Upload la photo via l'API Content Airtable (JSON + base64)
    // Les photos s'accumulent dans le champ multipleAttachments
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "image/jpeg";
    const base64Content = fileBuffer.toString("base64");

    const uploadRes = await fetch(
      `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${dossierId}/${ATTACHMENT_FIELD_ID}/uploadAttachment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType,
          filename: file.name || `photo_${Date.now()}.jpg`,
          file: base64Content,
        }),
      }
    );

    if (!uploadRes.ok) {
      const uploadErr = await uploadRes.text();
      console.error("Erreur upload photo:", uploadRes.status, uploadErr);
      return NextResponse.json(
        { success: false, error: `Erreur upload: ${uploadRes.status}` },
        { status: 502 }
      );
    }

    const uploadData = await uploadRes.json();
    const attachments = uploadData.attachments || uploadData;
    const photoUrl =
      Array.isArray(attachments) && attachments.length > 0
        ? attachments[0].url || attachments[0].thumbnails?.large?.url
        : null;

    return NextResponse.json({
      success: true,
      dossier_id: dossierId,
      photo_url: photoUrl,
    });
  } catch (error) {
    console.error("Erreur save-photo:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
