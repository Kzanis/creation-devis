import { NextResponse } from "next/server";
import { getClientConfig } from "@/lib/clientConfig";
import type { DossierFormat } from "@/lib/clientConfig";

const AIRTABLE_PAT = process.env.AIRTABLE_PAT!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appq8i4WpuMe5gvWj";
const AIRTABLE_TABLE_NAME = "Dossiers";
const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

const DEFAULT_FORMAT: DossierFormat = {
  prefix: "",
  date_part: "YYYY",
  separator: "-",
  padding: 3,
};

function buildDatePart(format: string): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const yy = yyyy.slice(2);
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");

  switch (format) {
    case "YYYY":
      return yyyy;
    case "YYMM":
      return yy + mm;
    case "YYYYMM":
      return yyyy + mm;
    default:
      return "";
  }
}

function buildNextNumero(
  lastNumero: string | null,
  fmt: DossierFormat
): string {
  const sep = fmt.separator;
  const datePart = buildDatePart(fmt.date_part);

  // Build the prefix portion (everything before the counter)
  const parts: string[] = [];
  if (fmt.prefix) parts.push(fmt.prefix);
  if (datePart) parts.push(datePart);
  const prefixStr = parts.join(sep);

  // Try to extract counter from last numero
  let nextCount = 1;

  if (lastNumero) {
    // Remove the prefix portion to find the counter
    let remainder = lastNumero;
    if (prefixStr && remainder.startsWith(prefixStr)) {
      remainder = remainder.slice(prefixStr.length);
      // Remove leading separator
      if (remainder.startsWith(sep)) {
        remainder = remainder.slice(sep.length);
      }
    }

    // Extract trailing digits
    const match = remainder.match(/(\d+)$/);
    if (match) {
      nextCount = parseInt(match[1], 10) + 1;
    }
  }

  const counterStr = nextCount.toString().padStart(fmt.padding, "0");

  return prefixStr ? `${prefixStr}${sep}${counterStr}` : counterStr;
}

/**
 * GET /api/airtable/dossiers/next-numero
 * Returns the next auto-generated dossier number based on client config format.
 */
export async function GET() {
  if (!AIRTABLE_PAT) {
    return NextResponse.json(
      { error: "AIRTABLE_PAT non configuré" },
      { status: 500 }
    );
  }

  const config = getClientConfig();
  const fmt = config.dossier_format || DEFAULT_FORMAT;

  try {
    // Fetch the most recent dossier (sorted by numero desc, limit 1)
    const url =
      AIRTABLE_API +
      "?pageSize=1&sort%5B0%5D%5Bfield%5D=Num%C3%A9ro%20de%20dossier&sort%5B0%5D%5Bdirection%5D=desc";

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Airtable error (next-numero):", err);
      return NextResponse.json(
        { error: "Erreur Airtable" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const lastRecord = data.records?.[0];
    const lastNumero = lastRecord
      ? (lastRecord.fields["Numéro de dossier"] as string) || null
      : null;

    const nextNumero = buildNextNumero(lastNumero, fmt);

    return NextResponse.json({
      next_numero: nextNumero,
      last_numero: lastNumero,
      format: fmt,
    });
  } catch (e) {
    console.error("next-numero failed:", e);
    return NextResponse.json(
      { error: "Impossible de calculer le prochain numéro" },
      { status: 500 }
    );
  }
}
