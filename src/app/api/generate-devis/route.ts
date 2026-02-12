import { NextRequest, NextResponse } from "next/server";

/**
 * Genere un pre-devis structure a partir de la transcription du dossier
 * et du bordereau de prix stocke dans Airtable.
 *
 * 1. Charge la/les transcription(s) du dossier
 * 2. Charge le bordereau de prix complet
 * 3. Envoie au LLM avec un prompt structure
 * 4. Retourne le pre-devis en JSON
 */
export async function POST(request: NextRequest) {
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AI_API_KEY = process.env.AI_API_KEY;
  const AI_BASE_URL = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1";
  const AI_MODEL = process.env.AI_MODEL || "anthropic/claude-3.5-sonnet";

  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return NextResponse.json(
      { success: false, error: "Configuration Airtable manquante" },
      { status: 500 }
    );
  }

  if (!AI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Cle API IA non configuree (AI_API_KEY)" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { dossier_id } = body;

    if (!dossier_id) {
      return NextResponse.json(
        { success: false, error: "dossier_id requis" },
        { status: 400 }
      );
    }

    // ── 1) Charger les transcriptions du dossier ──
    const transcriptionsRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Transcriptions?filterByFormula=${encodeURIComponent(`{Dossier ID}="${dossier_id}"`)}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
      }
    );

    if (!transcriptionsRes.ok) {
      return NextResponse.json(
        { success: false, error: "Erreur lecture transcriptions" },
        { status: 502 }
      );
    }

    const transcriptionsData = await transcriptionsRes.json();
    const transcriptions = transcriptionsData.records || [];

    if (transcriptions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Aucune transcription trouvee pour ce dossier. Dicte d'abord un releve." },
        { status: 400 }
      );
    }

    const texteComplet = transcriptions
      .map((r: { fields: { Texte?: string } }) => r.fields.Texte || "")
      .filter(Boolean)
      .join("\n\n");

    // ── 2) Charger le bordereau de prix ──
    const bordereauRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Bordereau?sort[0][field]=Categorie&sort[0][direction]=asc`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
      }
    );

    if (!bordereauRes.ok) {
      return NextResponse.json(
        { success: false, error: "Erreur lecture bordereau" },
        { status: 502 }
      );
    }

    const bordereauData = await bordereauRes.json();
    const bordereauRecords = bordereauData.records || [];

    if (bordereauRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: "Bordereau vide. Ajoute des prestations dans la table Bordereau." },
        { status: 400 }
      );
    }

    const bordereau = bordereauRecords.map(
      (r: { fields: { Intitule?: string; Unite?: string; "Prix unitaire HT"?: number; Categorie?: string } }) => ({
        intitule: r.fields.Intitule || "",
        unite: r.fields.Unite || "",
        prix_ht: r.fields["Prix unitaire HT"] || 0,
        categorie: r.fields.Categorie || "",
      })
    );

    // Separer les prestations communes (ajoutees automatiquement) du bordereau IA
    const prestationsCommunes = bordereau.filter(
      (b: { categorie: string }) => b.categorie === "Prestations Communes"
    );
    const bordereauIA = bordereau.filter(
      (b: { categorie: string }) => b.categorie !== "Prestations Communes"
    );

    const bordereauTexte = bordereauIA
      .map(
        (b: { intitule: string; unite: string; prix_ht: number; categorie: string }) =>
          `- ${b.intitule} | ${b.unite} | ${b.prix_ht}€ HT | ${b.categorie}`
      )
      .join("\n");

    // ── 3) Appel au LLM ──
    const systemPrompt = `Tu es un assistant specialise dans la generation de pre-devis pour artisans du batiment.

A partir d'une transcription de visite de chantier et d'un bordereau de prix, tu generes un pre-devis structure.

REGLES :
- Structure le devis piece par piece
- Pour chaque piece, identifie les travaux a effectuer
- Matche chaque travail avec la ligne du bordereau la plus appropriee (utilise l'intitule EXACT du bordereau)
- Estime les quantites a partir de la transcription (si mentionnees) ou mets 0 si pas d'info
- Si un travail decrit ne correspond a aucune ligne du bordereau, utilise l'intitule "Hors bordereau" avec un prix a 0
- Retourne UNIQUEMENT du JSON valide, sans markdown, sans commentaire

FORMAT DE SORTIE (JSON) :
{
  "pieces": [
    {
      "nom": "Salle de bain",
      "lignes": [
        {
          "intitule": "Grattage enduit / decroutage",
          "unite": "m2",
          "quantite": 12,
          "prix_unitaire_ht": 12,
          "total_ht": 144
        }
      ],
      "sous_total_ht": 144
    }
  ],
  "total_ht": 144,
  "notes": "Remarques ou precisions utiles"
}`;

    const userPrompt = `TRANSCRIPTION DU RELEVE DE CHANTIER :
${texteComplet}

BORDEREAU DE PRIX DISPONIBLE :
${bordereauTexte}

Genere le pre-devis en JSON.`;

    const aiRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!aiRes.ok) {
      const aiErr = await aiRes.text();
      console.error("Erreur LLM:", aiRes.status, aiErr);
      return NextResponse.json(
        { success: false, error: `Erreur IA: ${aiRes.status}` },
        { status: 502 }
      );
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parser le JSON de la reponse IA
    let devis;
    try {
      // Nettoyer le contenu (enlever d'eventuels ```json ... ```)
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      devis = JSON.parse(cleaned);
    } catch {
      console.error("Reponse IA non parseable:", content);
      return NextResponse.json(
        { success: false, error: "L'IA n'a pas retourne un JSON valide", raw: content },
        { status: 502 }
      );
    }

    // ── 4) Forcer les prix du bordereau + recalculer tous les montants ──
    // Construire un index intitule -> prix reel du bordereau
    const prixBordereau = new Map<string, number>();
    for (const b of bordereau) {
      prixBordereau.set(b.intitule.toLowerCase().trim(), b.prix_ht);
    }

    let totalGeneral = 0;
    for (const piece of devis.pieces || []) {
      let sousTotalPiece = 0;
      for (const ligne of piece.lignes || []) {
        // Forcer le prix du bordereau si l'intitule correspond
        const key = (ligne.intitule || "").toLowerCase().trim();
        if (prixBordereau.has(key)) {
          ligne.prix_unitaire_ht = prixBordereau.get(key)!;
        }
        const qte = Number(ligne.quantite) || 0;
        const pu = Number(ligne.prix_unitaire_ht) || 0;
        ligne.total_ht = Math.round(qte * pu * 100) / 100;
        sousTotalPiece += ligne.total_ht;
      }
      piece.sous_total_ht = Math.round(sousTotalPiece * 100) / 100;
      totalGeneral += piece.sous_total_ht;
    }

    // ── 5) Ajouter les prestations communes (1 ligne chacune, qte=1) ──
    if (prestationsCommunes.length > 0) {
      let sousTotalCommunes = 0;
      const lignesCommunes = prestationsCommunes.map(
        (b: { intitule: string; unite: string; prix_ht: number }) => {
          const total = Math.round(b.prix_ht * 100) / 100;
          sousTotalCommunes += total;
          return {
            intitule: b.intitule,
            unite: b.unite,
            quantite: 1,
            prix_unitaire_ht: b.prix_ht,
            total_ht: total,
          };
        }
      );
      sousTotalCommunes = Math.round(sousTotalCommunes * 100) / 100;
      totalGeneral += sousTotalCommunes;

      devis.pieces.push({
        nom: "Prestations communes",
        lignes: lignesCommunes,
        sous_total_ht: sousTotalCommunes,
      });
    }

    devis.total_ht = Math.round(totalGeneral * 100) / 100;

    return NextResponse.json({
      success: true,
      devis,
      transcription_utilisee: texteComplet.substring(0, 200) + "...",
      bordereau_lignes: bordereau.length,
    });
  } catch (error) {
    console.error("Erreur generate-devis:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
