import { NextRequest, NextResponse } from "next/server";
import { utils, write } from "xlsx";

/**
 * Genere un fichier Excel du pre-devis cote serveur,
 * l'envoie a n8n pour upload dans Google Drive,
 * puis sauvegarde le lien Drive dans le Dossier Airtable.
 */
export async function POST(request: NextRequest) {
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const WEBHOOK_URL = process.env.WEBHOOK_N8N_SAVE_DEVIS_URL;

  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return NextResponse.json(
      { success: false, error: "Configuration Airtable manquante" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { dossier_id, dossier_numero, client, devis } = body;

    if (!dossier_id || !devis?.pieces) {
      return NextResponse.json(
        { success: false, error: "dossier_id et devis requis" },
        { status: 400 }
      );
    }

    // ── 1) Generer le fichier Excel ──
    const rows: (string | number)[][] = [];

    rows.push(["PRE-DEVIS"]);
    rows.push(["Client", client || ""]);
    rows.push(["Dossier", dossier_numero || ""]);
    rows.push(["Date", new Date().toLocaleDateString("fr-FR")]);
    rows.push([]);
    rows.push(["Piece", "Prestation", "Unite", "Quantite", "Prix unitaire HT", "Total HT"]);

    interface DevisLigne {
      intitule: string;
      unite: string;
      quantite: number;
      prix_unitaire_ht: number;
      total_ht: number;
    }

    interface DevisPiece {
      nom: string;
      lignes: DevisLigne[];
      sous_total_ht: number;
    }

    for (const piece of devis.pieces as DevisPiece[]) {
      for (const ligne of piece.lignes) {
        rows.push([
          piece.nom,
          ligne.intitule,
          ligne.unite,
          ligne.quantite,
          ligne.prix_unitaire_ht,
          ligne.total_ht,
        ]);
      }
      rows.push(["", "", "", "", "Sous-total " + piece.nom, piece.sous_total_ht]);
    }

    rows.push([]);
    rows.push(["", "", "", "", "TOTAL HT", devis.total_ht]);

    if (devis.notes) {
      rows.push([]);
      rows.push(["Notes :", devis.notes]);
    }

    const ws = utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 45 },
      { wch: 8 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
    ];

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Pre-devis");

    const excelBuffer: Buffer = write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `pre-devis_${dossier_numero || "sans-numero"}_${client || "client"}.xlsx`
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "");

    // ── 2) Envoyer a n8n pour upload Google Drive (JSON + base64) ──
    let driveUrl: string | null = null;

    if (WEBHOOK_URL) {
      try {
        const base64File = Buffer.from(excelBuffer).toString("base64");

        const webhookRes = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dossier_id,
            dossier_numero: dossier_numero || "",
            client: client || "",
            filename,
            file_base64: base64File,
          }),
        });

        if (webhookRes.ok) {
          const responseText = await webhookRes.text();
          if (responseText) {
            try {
              const webhookData = JSON.parse(responseText);
              driveUrl = webhookData.file_url || webhookData.webViewLink || webhookData.url || null;
            } catch {
              console.error("n8n response not JSON:", responseText);
            }
          }
        } else {
          const errText = await webhookRes.text();
          console.error("Erreur n8n save-devis:", webhookRes.status, errText);
        }
      } catch (e) {
        console.error("Erreur appel n8n save-devis:", e);
      }
    }

    // ── 3) Mettre a jour le Dossier Airtable avec le lien Drive ──
    if (driveUrl) {
      try {
        await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Dossiers/${dossier_id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${AIRTABLE_PAT}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fields: {
                "Devis / Pre-devis": driveUrl,
              },
            }),
          }
        );
      } catch (e) {
        console.error("Erreur update Airtable Dossier:", e);
      }
    }

    return NextResponse.json({
      success: true,
      drive_url: driveUrl,
      filename,
      message: driveUrl
        ? "Pre-devis sauvegarde dans Google Drive"
        : "Pre-devis genere (webhook Google Drive non configure)",
    });
  } catch (error) {
    console.error("Erreur save-devis:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
