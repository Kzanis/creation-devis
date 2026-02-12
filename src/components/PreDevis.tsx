"use client";

import { useState, useCallback, useMemo } from "react";
import { utils, writeFileXLSX } from "xlsx";

interface Ligne {
  intitule: string;
  unite: string;
  quantite: number;
  prix_unitaire_ht: number;
  total_ht: number;
}

interface Piece {
  nom: string;
  lignes: Ligne[];
  sous_total_ht: number;
}

interface Devis {
  pieces: Piece[];
  total_ht: number;
  notes?: string;
}

interface PreDevisProps {
  dossierId?: string;
  dossierNumero?: string;
  dossierClient?: string;
}

export default function PreDevis({ dossierId, dossierNumero, dossierClient }: PreDevisProps) {
  const [devis, setDevis] = useState<Devis | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!dossierId) return;
    setLoading(true);
    setError(null);
    setDevis(null);
    setDriveUrl(null);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/generate-devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossier_id: dossierId }),
      });

      const data = await res.json();

      if (data.success) {
        setDevis(data.devis);
      } else {
        setError(data.error || "Erreur inconnue");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  const saveDevis = useCallback(async () => {
    if (!devis || !dossierId) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/save-devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossier_id: dossierId,
          dossier_numero: dossierNumero || "",
          client: dossierClient || "",
          devis,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSaveMessage(data.message);
        if (data.drive_url) {
          setDriveUrl(data.drive_url);
        }
      } else {
        setError(data.error || "Erreur sauvegarde");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur reseau");
    } finally {
      setSaving(false);
    }
  }, [devis, dossierId, dossierNumero, dossierClient]);

  const downloadExcel = useCallback(() => {
    if (!devis) return;

    const rows: (string | number)[][] = [];

    rows.push(["PRE-DEVIS"]);
    rows.push(["Client", dossierClient || ""]);
    rows.push(["Dossier", dossierNumero || ""]);
    rows.push(["Date", new Date().toLocaleDateString("fr-FR")]);
    rows.push([]);
    rows.push(["Piece", "Prestation", "Unite", "Quantite", "Prix unitaire HT", "Total HT"]);

    for (const piece of devis.pieces) {
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

    const filename = `pre-devis_${dossierNumero || "sans-numero"}_${dossierClient || "client"}.xlsx`
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "");

    writeFileXLSX(wb, filename, { compression: true });
  }, [devis, dossierNumero, dossierClient]);

  // ── Fonctions de modification du devis (calculette) ──

  const recalcDevis = useCallback((d: Devis): Devis => {
    let totalGeneral = 0;
    const pieces = d.pieces.map((piece) => {
      let sousTotalPiece = 0;
      const lignes = piece.lignes.map((ligne) => {
        const qte = Number(ligne.quantite) || 0;
        const pu = Number(ligne.prix_unitaire_ht) || 0;
        const total = Math.round(qte * pu * 100) / 100;
        sousTotalPiece += total;
        return { ...ligne, total_ht: total };
      });
      sousTotalPiece = Math.round(sousTotalPiece * 100) / 100;
      totalGeneral += sousTotalPiece;
      return { ...piece, lignes, sous_total_ht: sousTotalPiece };
    });
    return { ...d, pieces, total_ht: Math.round(totalGeneral * 100) / 100 };
  }, []);

  const updateLigne = useCallback(
    (pieceIdx: number, ligneIdx: number, field: "quantite" | "prix_unitaire_ht", value: number) => {
      setDevis((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          pieces: prev.pieces.map((piece, pi) =>
            pi !== pieceIdx
              ? piece
              : {
                  ...piece,
                  lignes: piece.lignes.map((ligne, li) =>
                    li !== ligneIdx ? ligne : { ...ligne, [field]: value }
                  ),
                }
          ),
        };
        return recalcDevis(updated);
      });
    },
    [recalcDevis]
  );

  const deleteLigne = useCallback(
    (pieceIdx: number, ligneIdx: number) => {
      setDevis((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          pieces: prev.pieces
            .map((piece, pi) =>
              pi !== pieceIdx
                ? piece
                : { ...piece, lignes: piece.lignes.filter((_, li) => li !== ligneIdx) }
            )
            .filter((piece) => piece.lignes.length > 0),
        };
        return recalcDevis(updated);
      });
    },
    [recalcDevis]
  );

  const formatEur = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  // Compter le nombre total de lignes pour savoir si le devis est vide
  const totalLignes = useMemo(
    () => devis?.pieces.reduce((acc, p) => acc + p.lignes.length, 0) ?? 0,
    [devis]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Bouton generer */}
      <button
        onClick={generate}
        disabled={loading || !dossierId}
        className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? (
          <>
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generation en cours...
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Generer le pre-devis
          </>
        )}
      </button>

      {/* Erreur */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-3">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Resultat — Calculette editable */}
      {devis && totalLignes > 0 && (
        <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text)]">
            Pre-devis
          </h3>

          {devis.pieces.map((piece, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[var(--color-surface-border)] pb-1">
                <h4 className="text-sm font-semibold text-[var(--color-primary)]">
                  {piece.nom}
                </h4>
                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                  {formatEur(piece.sous_total_ht)}
                </span>
              </div>

              {/* Lignes editables */}
              <div className="flex flex-col gap-2">
                {piece.lignes.map((ligne, j) => (
                  <div
                    key={j}
                    className="flex items-center gap-2 rounded-lg bg-[var(--color-bg)] p-2"
                  >
                    {/* Prestation + total */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text)] truncate">
                        {ligne.intitule}
                      </p>
                      <p className="text-xs font-bold text-[var(--color-primary)] mt-0.5">
                        = {formatEur(ligne.total_ht)}
                      </p>
                    </div>

                    {/* Quantite */}
                    <div className="flex flex-col items-center">
                      <label className="text-[10px] text-[var(--color-text-muted)]">Qte</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={ligne.quantite}
                        onChange={(e) =>
                          updateLigne(i, j, "quantite", parseFloat(e.target.value) || 0)
                        }
                        className="w-16 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-2 py-2 text-center text-xs font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                      />
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {ligne.unite}
                      </span>
                    </div>

                    {/* Prix unitaire */}
                    <div className="flex flex-col items-center">
                      <label className="text-[10px] text-[var(--color-text-muted)]">P.U.</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={ligne.prix_unitaire_ht}
                        onChange={(e) =>
                          updateLigne(
                            i,
                            j,
                            "prix_unitaire_ht",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-16 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-2 py-2 text-center text-xs font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                      />
                      <span className="text-[10px] text-[var(--color-text-muted)]">EUR</span>
                    </div>

                    {/* Bouton supprimer */}
                    <button
                      onClick={() => deleteLigne(i, j)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-red-900/30 hover:text-[var(--color-danger)] active:scale-95"
                      title="Supprimer cette ligne"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between border-t border-[var(--color-surface-border)] pt-2">
            <span className="text-sm font-bold text-[var(--color-text)]">TOTAL HT</span>
            <span className="text-base font-bold text-[var(--color-success)]">
              {formatEur(devis.total_ht)}
            </span>
          </div>

          {/* Notes */}
          {devis.notes && (
            <p className="text-xs italic text-[var(--color-text-muted)]">{devis.notes}</p>
          )}

          {/* Boutons action */}
          <div className="flex flex-col gap-2">
            {/* Sauvegarder (Drive + Airtable) */}
            <button
              onClick={saveDevis}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-success)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sauvegarde en cours...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Sauvegarder le devis
                </>
              )}
            </button>

            {/* Telecharger local */}
            <button
              onClick={downloadExcel}
              className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-6 py-3 text-sm font-medium text-[var(--color-text-muted)] transition-all hover:text-[var(--color-text)] active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Telecharger Excel
            </button>
          </div>

          {/* Message de confirmation */}
          {saveMessage && (
            <div className="rounded-xl border border-green-800 bg-green-900/20 p-3">
              <p className="text-sm font-medium text-[var(--color-success)]">{saveMessage}</p>
              {driveUrl && (
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] underline"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Ouvrir dans Google Drive
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
