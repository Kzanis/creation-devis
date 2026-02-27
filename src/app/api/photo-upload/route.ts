import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

/**
 * Upload photo vers Airtable directement (fallback quand n8n echoue).
 * Utilise l'API classique PATCH avec URL attachment.
 *
 * Airtable accepte des URLs publiques pour les attachments —
 * on convertit la photo en data URL temporaire via un upload multipart.
 * Alternative: utiliser l'API Content pour upload direct.
 */
async function uploadToAirtableDirect(
  file: File,
  dossierId: string
): Promise<{ success: boolean; error?: string }> {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return { success: false, error: "Configuration Airtable manquante" };
  }

  if (!dossierId) {
    return { success: false, error: "Aucun dossier selectionne" };
  }

  try {
    // Methode 1: Airtable Content API (upload direct binaire)
    // D'abord, on doit trouver le field ID de "Photos Chantier"
    // On utilise l'approche PATCH avec un upload binaire base64

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "image/jpeg";
    const base64Content = fileBuffer.toString("base64");
    const filename = file.name || `photo_${Date.now()}.jpg`;

    // Essayer l'upload via Content API
    // On doit d'abord recuperer le field ID dynamiquement
    const metaRes = await fetch(
      `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
      }
    );

    if (!metaRes.ok) {
      console.error("[Photo] Airtable meta API failed:", metaRes.status);
      return { success: false, error: "Impossible de lire la structure Airtable" };
    }

    const metaData = await metaRes.json();
    const dossiersTable = metaData.tables?.find(
      (t: { name: string }) =>
        t.name === "Dossiers" || t.name === "dossiers"
    );

    if (!dossiersTable) {
      return { success: false, error: "Table Dossiers introuvable dans Airtable" };
    }

    const photoField = dossiersTable.fields?.find(
      (f: { name: string; type: string }) =>
        (f.name === "Photos Chantier" || f.name === "Photos chantier") &&
        f.type === "multipleAttachments"
    );

    if (!photoField) {
      console.error("[Photo] Champ 'Photos Chantier' introuvable. Champs disponibles:",
        dossiersTable.fields?.map((f: { name: string }) => f.name).join(", ")
      );
      return { success: false, error: "Champ 'Photos Chantier' introuvable" };
    }

    const fieldId = photoField.id;
    console.log(`[Photo] Upload direct Airtable: dossier=${dossierId}, field=${fieldId}`);

    const uploadRes = await fetch(
      `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${dossierId}/${fieldId}/uploadAttachment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType,
          filename,
          file: base64Content,
        }),
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("[Photo] Airtable Content API error:", uploadRes.status, errText);
      return { success: false, error: `Erreur Airtable upload: ${uploadRes.status}` };
    }

    console.log("[Photo] Upload direct Airtable reussi");
    return { success: true };
  } catch (error) {
    console.error("[Photo] Airtable direct upload error:", error);
    return {
      success: false,
      error: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * POST /api/photo-upload
 *
 * Strategie: essayer n8n d'abord (Google Drive + Airtable),
 * sinon fallback sur upload direct Airtable Content API.
 */
export async function POST(request: NextRequest) {
  const webhookUrl = process.env.WEBHOOK_N8N_PHOTO_UPLOAD_URL;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "FormData invalide" },
      { status: 400 }
    );
  }

  const file = formData.get("photo") as File | null;
  const dossierId = (formData.get("dossier_id") as string) || "";

  if (!file) {
    return NextResponse.json(
      { success: false, error: "Aucune photo recue" },
      { status: 400 }
    );
  }

  // --- Strategie 1: n8n webhook (Google Drive + Airtable) ---
  if (webhookUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);

      // Reconstruire le FormData pour n8n (on ne peut pas re-utiliser le même)
      const n8nFormData = new FormData();
      n8nFormData.append("photo", file, file.name || `photo_${Date.now()}.jpg`);
      n8nFormData.append("dossier_id", dossierId);
      n8nFormData.append("dossier_numero", (formData.get("dossier_numero") as string) || "");
      n8nFormData.append("dossier_client", (formData.get("dossier_client") as string) || "");

      const response = await fetch(webhookUrl, {
        method: "POST",
        body: n8nFormData,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.ok) {
        const responseText = await response.text();
        if (responseText && responseText.trim()) {
          try {
            const data = JSON.parse(responseText);
            if (data.success) {
              console.log("[Photo] n8n upload reussi");
              return NextResponse.json(data);
            }
            console.warn("[Photo] n8n returned success=false:", data.error);
          } catch {
            console.warn("[Photo] n8n returned non-JSON:", responseText.substring(0, 100));
          }
        }
      } else {
        console.warn(`[Photo] n8n returned ${response.status}, trying Airtable direct`);
      }
    } catch (error) {
      console.warn("[Photo] n8n unreachable, trying Airtable direct:", error);
    }
  }

  // --- Strategie 2: Upload direct Airtable Content API ---
  console.log("[Photo] Fallback: upload direct Airtable");
  const result = await uploadToAirtableDirect(file, dossierId);

  return NextResponse.json(result, {
    status: result.success ? 200 : 502,
  });
}
