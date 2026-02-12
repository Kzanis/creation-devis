import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_PAT = process.env.AIRTABLE_PAT!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appq8i4WpuMe5gvWj";
const AIRTABLE_TABLE_NAME = "Dossiers";

const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

/**
 * GET /api/airtable/dossiers
 * Liste les dossiers avec recherche optionnelle.
 * Query params: ?search=dupont
 */
export async function GET(req: NextRequest) {
  if (!AIRTABLE_PAT) {
    return NextResponse.json(
      { error: "AIRTABLE_PAT non configuré" },
      { status: 500 }
    );
  }

  const search = req.nextUrl.searchParams.get("search") || "";

  // Construire la formule de filtre Airtable si recherche
  let url = AIRTABLE_API + "?pageSize=50&sort%5B0%5D%5Bfield%5D=Num%C3%A9ro%20de%20dossier&sort%5B0%5D%5Bdirection%5D=desc";

  if (search.trim()) {
    const formula = `OR(FIND(LOWER("${search}"), LOWER({Numéro de dossier})), FIND(LOWER("${search}"), LOWER({Client})), FIND(LOWER("${search}"), LOWER({Nom du dossier})))`;
    url += `&filterByFormula=${encodeURIComponent(formula)}`;
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Airtable error:", err);
      return NextResponse.json(
        { error: "Erreur Airtable" },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Transformer les records en format simple
    interface AirtableAttachment {
      url?: string;
      thumbnails?: { large?: { url?: string } };
    }
    const dossiers = data.records.map(
      (r: { id: string; fields: Record<string, unknown> }) => {
        const photosChantier = (r.fields["Photos Chantier"] || []) as AirtableAttachment[];
        const firstPhoto = photosChantier[0];
        return {
          id: r.id,
          numero: (r.fields["Numéro de dossier"] as string) || "",
          nom: (r.fields["Nom du dossier"] as string) || "",
          client: (r.fields["Client"] as string) || "",
          photo: firstPhoto?.thumbnails?.large?.url || firstPhoto?.url || "",
          photos_count: photosChantier.length,
          devis: (r.fields["Devis / Pré-devis"] as string) || "",
          description: (r.fields["Description / Relevé"] as string) || "",
        };
      }
    );

    return NextResponse.json({ dossiers });
  } catch (e) {
    console.error("Fetch Airtable failed:", e);
    return NextResponse.json(
      { error: "Impossible de contacter Airtable" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/airtable/dossiers
 * Crée un nouveau dossier.
 * Body: { numero, nom, client }
 */
export async function POST(req: NextRequest) {
  if (!AIRTABLE_PAT) {
    return NextResponse.json(
      { error: "AIRTABLE_PAT non configuré" },
      { status: 500 }
    );
  }

  try {
    const { numero, nom, client } = await req.json();

    if (!numero || !client) {
      return NextResponse.json(
        { error: "Numéro et client sont obligatoires" },
        { status: 400 }
      );
    }

    const res = await fetch(AIRTABLE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              "Numéro de dossier": numero,
              "Nom du dossier": nom || "",
              "Client": client,
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Airtable POST error:", err);
      return NextResponse.json(
        { error: "Erreur création Airtable" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const record = data.records[0];

    return NextResponse.json({
      success: true,
      dossier: {
        id: record.id,
        numero: record.fields["Numéro de dossier"] || "",
        nom: record.fields["Nom du dossier"] || "",
        client: record.fields["Client"] || "",
        photo: "",
        photos_count: 0,
        devis: record.fields["Devis / Pré-devis"] || "",
        description: record.fields["Description / Relevé"] || "",
      },
    });
  } catch (e) {
    console.error("POST Airtable failed:", e);
    return NextResponse.json(
      { error: "Impossible de créer le dossier" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/airtable/dossiers
 * Met à jour un champ d'un dossier existant.
 * Body: { recordId, fields: { "Photo": "https://..." } }
 */
export async function PATCH(req: NextRequest) {
  if (!AIRTABLE_PAT) {
    return NextResponse.json(
      { error: "AIRTABLE_PAT non configuré" },
      { status: 500 }
    );
  }

  try {
    const { recordId, fields } = await req.json();

    const res = await fetch(`${AIRTABLE_API}/${recordId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Airtable PATCH error:", err);
      return NextResponse.json(
        { error: "Erreur mise à jour Airtable" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, record: data });
  } catch (e) {
    console.error("PATCH Airtable failed:", e);
    return NextResponse.json(
      { error: "Impossible de mettre à jour le dossier" },
      { status: 500 }
    );
  }
}
