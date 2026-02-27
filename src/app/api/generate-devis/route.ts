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

    // -- 1) Charger les transcriptions du dossier --
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

    const allTexts = transcriptions
      .map((r: { fields: { Texte?: string } }) => r.fields.Texte || "")
      .filter(Boolean);

    // Deduplicate identical texts (correction + save can create duplicates)
    const seen = new Set<string>();
    const uniqueTexts = allTexts.filter((t: string) => {
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });

    const texteComplet = uniqueTexts.join("\n\n");

    // -- 2) Charger le bordereau de prix --
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

    // -- 3) Appel au LLM --
    const systemPrompt = `Tu es un metreur specialise dans la generation de pre-devis pour artisans du batiment (peinture, revetements, second oeuvre).

A partir d'une transcription de visite de chantier et d'un bordereau de prix, tu generes un pre-devis structure avec des QUANTITES CALCULEES.

REGLES :
- Structure le devis piece par piece
- IMPORTANT : chaque piece n'apparait qu'UNE SEULE FOIS, meme si elle a plusieurs prestations (plafond, murs, sol). Regroupe toutes les lignes sous la meme piece.
- Pour chaque piece, identifie les travaux a effectuer
- Matche chaque travail avec la ligne du bordereau la plus appropriee
- Quand le bordereau a une seule ligne generique (ex: "Application peinture complete"), cree des lignes SEPAREES pour chaque surface en ajoutant la precision entre parentheses :
  → "Application peinture complete (impression + 2 couches) — plafond" pour le plafond
  → "Application peinture complete (impression + 2 couches) — murs" pour les murs
  Utilise le MEME prix unitaire du bordereau pour les deux.
- Si un travail decrit ne correspond a aucune ligne du bordereau, utilise l'intitule "Hors bordereau" avec un prix a 0
- Retourne UNIQUEMENT du JSON valide, sans markdown, sans commentaire

CALCUL DES QUANTITES (OBLIGATOIRE) :
Quand la transcription mentionne des dimensions (longueur, largeur, hauteur), tu DOIS calculer les surfaces :
- Plafond = longueur x largeur (en m2)
- Murs = 2 x (longueur + largeur) x hauteur (en m2)
- Sol = longueur x largeur (en m2)
- Si des ouvertures sont mentionnees (portes, fenetres), deduis leur surface des murs (porte standard = 2 m2, fenetre standard = 1.5 m2 si dimensions non precisees)
- Si les dimensions sont en centimetres (ex: "350 par 280"), convertis en metres (3.50 x 2.80)
- Pour les travaux lineaires (plinthes, corniches), calcule le perimetre : 2 x (longueur + largeur) en ml
- Si une seule dimension est donnee pour un mur (ex: "mur de 4 metres"), c'est la longueur du mur. Utilise la hauteur mentionnee ou 2.50m par defaut.
- Si aucune dimension n'est mentionnee pour une piece, mets la quantite a 0

EXEMPLES DE CALCUL :
- "chambre 1, 350 par 280, hauteur 248" → plafond = 3.50 x 2.80 = 9.80 m2, murs = 2 x (3.50 + 2.80) x 2.48 = 31.25 m2
- "salon 5 metres par 4, hauteur 2.50" → plafond = 5.00 x 4.00 = 20.00 m2, murs = 2 x (5.00 + 4.00) x 2.50 = 45.00 m2
- "couloir 6 metres par 1.20" → plafond = 6.00 x 1.20 = 7.20 m2, murs = 2 x (6.00 + 1.20) x 2.50 = 36.00 m2

Si la transcription dit "peinture complete" ou "tout refaire", applique peinture plafond + peinture murs pour cette piece.
Arrondis les quantites a 2 decimales.

FORMAT DE SORTIE (JSON) :
{
  "pieces": [
    {
      "nom": "Chambre 1",
      "lignes": [
        {
          "intitule": "Application peinture acrylique murs 2 couches",
          "unite": "m2",
          "quantite": 31.25,
          "prix_unitaire_ht": 12,
          "total_ht": 375
        },
        {
          "intitule": "Application peinture acrylique plafond 2 couches",
          "unite": "m2",
          "quantite": 9.80,
          "prix_unitaire_ht": 14,
          "total_ht": 137.20
        }
      ],
      "sous_total_ht": 512.20
    }
  ],
  "total_ht": 512.20,
  "notes": "Hauteur sous plafond: 2.48m. Surfaces calculees a partir des cotes relevees."
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

    // -- 4) Forcer les prix du bordereau + recalculer tous les montants --
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
        // Also match variants like "Prestation — plafond" or "Prestation — murs"
        const key = (ligne.intitule || "").toLowerCase().trim();
        const baseKey = key.replace(/\s*[—–-]\s*(plafond|murs|sol|mur)$/i, "").trim();
        if (prixBordereau.has(key)) {
          ligne.prix_unitaire_ht = prixBordereau.get(key)!;
        } else if (prixBordereau.has(baseKey)) {
          ligne.prix_unitaire_ht = prixBordereau.get(baseKey)!;
        }
        const qte = Number(ligne.quantite) || 0;
        const pu = Number(ligne.prix_unitaire_ht) || 0;
        ligne.total_ht = Math.round(qte * pu * 100) / 100;
        sousTotalPiece += ligne.total_ht;
      }
      piece.sous_total_ht = Math.round(sousTotalPiece * 100) / 100;
      totalGeneral += piece.sous_total_ht;
    }

    // -- 5) Ajouter les prestations communes (1 ligne chacune, qte=1) --
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
