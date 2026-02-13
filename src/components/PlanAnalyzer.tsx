"use client";

import { useState, useRef, useCallback } from "react";

// -- Types pour le nouveau format avec source --

type DimSource = "lu" | "calcule" | "non_lisible";

type DimConfiance = "haute" | "moyenne" | "faible";

interface DimValue {
  valeur: number | null;
  source: DimSource;
  confiance?: DimConfiance;
  alternatives?: string;
}

interface PlanOuverture {
  type: string;
  largeur_m?: number | null;
  hauteur_m?: number | null;
  source?: DimSource;
}

interface PlanPiece {
  nom: string;
  fonction?: string;
  longueur_m?: DimValue | number | null;
  largeur_m?: DimValue | number | null;
  hauteur_m?: DimValue | number | null;
  surface_sol_m2?: DimValue | number | null;
  perimetre_m?: DimValue | number | null;
  surface_murale_m2?: DimValue | number | null;
  ouvertures?: PlanOuverture[];
  annotations?: string[];
}

interface PlanAnalyse {
  vue_ensemble?: string;
  echelle?: string | null;
  pieces?: PlanPiece[];
  surface_totale_m2?: DimValue | number | null;
  annotations_generales?: string[];
  notes_analyse?: string;
}

interface PlanAnalyzerProps {
  dossierId?: string;
}

// -- Helpers --

/** Normalise une dimension (ancien format number OU nouveau format {valeur, source, confiance}) */
function parseDim(dim: DimValue | number | null | undefined): { valeur: number | null; source: DimSource; confiance?: DimConfiance; alternatives?: string } {
  if (dim === null || dim === undefined) return { valeur: null, source: "non_lisible" };
  if (typeof dim === "number") return { valeur: dim, source: "lu", confiance: "haute" };
  return { valeur: dim.valeur ?? null, source: dim.source || "lu", confiance: dim.confiance, alternatives: dim.alternatives };
}

const CONFIANCE_STYLE: Record<DimConfiance, string> = {
  haute: "",
  moyenne: "underline decoration-amber-400 decoration-wavy decoration-2 underline-offset-2",
  faible: "underline decoration-red-400 decoration-wavy decoration-2 underline-offset-2",
};

const SOURCE_LABELS: Record<DimSource, string> = {
  lu: "Lu sur le plan",
  calcule: "Calcule",
  non_lisible: "Non lisible",
};

const SOURCE_COLORS: Record<DimSource, string> = {
  lu: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
  calcule: "bg-amber-900/40 text-amber-400 border-amber-700/50",
  non_lisible: "bg-zinc-800/60 text-zinc-500 border-zinc-700/50",
};

const SOURCE_DOT: Record<DimSource, string> = {
  lu: "bg-emerald-400",
  calcule: "bg-amber-400",
  non_lisible: "bg-zinc-500",
};

/** Affiche une dimension avec son badge source + confiance */
function DimDisplay({ label, dim }: { label: string; dim: DimValue | number | null | undefined }) {
  const { valeur, source, confiance, alternatives } = parseDim(dim);
  if (valeur === null && source === "non_lisible") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[var(--color-text-muted)]">{label} :</span>
        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_COLORS.non_lisible}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${SOURCE_DOT.non_lisible}`} />
          non lisible
        </span>
      </div>
    );
  }

  const hasDoute = confiance && confiance !== "haute";
  const confianceStyle = confiance ? CONFIANCE_STYLE[confiance] : "";

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[var(--color-text)]">
          {label} : <strong className={confianceStyle}>{valeur}</strong>
        </span>
        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_COLORS[source]}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${SOURCE_DOT[source]}`} />
          {source === "lu" ? "lu" : "calcule"}
        </span>
        {hasDoute && (
          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${confiance === "faible" ? "bg-red-900/40 text-red-400 border-red-700/50" : "bg-orange-900/40 text-orange-400 border-orange-700/50"}`}>
            {confiance === "faible" ? "a verifier" : "doute"}
          </span>
        )}
      </div>
      {hasDoute && alternatives && (
        <p className="ml-0.5 text-[10px] text-orange-400/80">
          Autre lecture possible : {alternatives}
        </p>
      )}
    </div>
  );
}

// -- Image preprocessing (contrast + sharpen for better OCR) --

/** Augmente le contraste et la nettete d'une image pour ameliorer la lecture IA */
function enhanceImageForOCR(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Light contrast boost — gentle to not degrade clear plans
      ctx.filter = "contrast(1.15) brightness(1.02)";
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = "none";

      // Unsharp mask (sharpen) — draw a slightly blurred version and subtract
      const sharpCanvas = document.createElement("canvas");
      sharpCanvas.width = img.width;
      sharpCanvas.height = img.height;
      const sharpCtx = sharpCanvas.getContext("2d");
      if (sharpCtx) {
        sharpCtx.filter = "blur(1px)";
        sharpCtx.drawImage(canvas, 0, 0);
        sharpCtx.filter = "none";

        // Blend: overlay sharpened on original for edge enhancement
        const origData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const blurData = sharpCtx.getImageData(0, 0, canvas.width, canvas.height);
        const amount = 0.5; // sharpening strength

        for (let i = 0; i < origData.data.length; i += 4) {
          origData.data[i] = Math.min(255, Math.max(0, origData.data[i] + amount * (origData.data[i] - blurData.data[i])));
          origData.data[i + 1] = Math.min(255, Math.max(0, origData.data[i + 1] + amount * (origData.data[i + 1] - blurData.data[i + 1])));
          origData.data[i + 2] = Math.min(255, Math.max(0, origData.data[i + 2] + amount * (origData.data[i + 2] - blurData.data[i + 2])));
        }
        ctx.putImageData(origData, 0, 0);
      }

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// -- PDF conversion --

async function pdfToImages(file: File): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];
  const maxPages = Math.min(pdf.numPages, 5);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    // Enhance each page for better readability
    const enhanced = await enhanceImageForOCR(canvas.toDataURL("image/png"));
    images.push(enhanced);
  }
  return images;
}

function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      // Enhance photo for better OCR
      const enhanced = await enhanceImageForOCR(reader.result as string);
      resolve(enhanced);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// -- Composant principal --

export default function PlanAnalyzer({ dossierId }: PlanAnalyzerProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyse, setAnalyse] = useState<PlanAnalyse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setAnalyse(null);

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPDF) {
      setConverting(true);
      try {
        const pdfImages = await pdfToImages(file);
        if (pdfImages.length === 0) {
          setError("Impossible de lire ce PDF.");
          return;
        }
        setPreviews(pdfImages);
        setImages(pdfImages);
      } catch (e) {
        console.error("Erreur conversion PDF:", e);
        setError("Erreur lors de la lecture du PDF.");
      } finally {
        setConverting(false);
      }
    } else {
      try {
        const dataUrl = await imageToBase64(file);
        setPreviews([dataUrl]);
        setImages([dataUrl]);
      } catch {
        setError("Erreur lors de la lecture de l'image.");
      }
    }
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleAnalyze = useCallback(async () => {
    if (images.length === 0) return;
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, dossier_id: dossierId || "" }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalyse(data.analyse);
      } else {
        setError(data.error || "Erreur lors de l'analyse");
      }
    } catch (e) {
      setError(`Erreur reseau: ${e instanceof Error ? e.message : "inconnue"}`);
    } finally {
      setAnalyzing(false);
    }
  }, [images, dossierId]);

  const handleReset = useCallback(() => {
    setPreviews([]);
    setImages([]);
    setAnalyse(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Inputs caches */}
      <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileInput} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput} />

      {/* Boutons upload */}
      {images.length === 0 && !converting && (
        <div className="flex gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--color-surface-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-muted)] transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-[0.98]"
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-sm font-medium">PDF ou Image</span>
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--color-surface-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-muted)] transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-[0.98]"
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <span className="text-sm font-medium">Photo du plan</span>
          </button>
        </div>
      )}

      {/* Conversion PDF */}
      {converting && (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-[var(--color-surface)] p-6">
          <svg className="h-6 w-6 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-[var(--color-text-muted)]">Lecture du PDF...</span>
        </div>
      )}

      {/* Preview */}
      {previews.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Plan charge ({previews.length} page{previews.length > 1 ? "s" : ""})
            </p>
            <button onClick={handleReset} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-danger)]">
              Changer
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {previews.map((preview, i) => (
              <img key={i} src={preview} alt={`Plan page ${i + 1}`} className="h-40 w-auto rounded-xl border border-[var(--color-surface-border)] object-contain" />
            ))}
          </div>
          {!analyse && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyse + verification...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analyser le plan
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Resultats */}
      {analyse && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-success)]">
              Analyse terminee
            </p>
            <button onClick={handleReset} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]">
              Nouveau plan
            </button>
          </div>

          {/* Legende sources */}
          <div className="flex flex-wrap gap-2">
            {(["lu", "calcule", "non_lisible"] as DimSource[]).map((src) => (
              <span key={src} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${SOURCE_COLORS[src]}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${SOURCE_DOT[src]}`} />
                {SOURCE_LABELS[src]}
              </span>
            ))}
          </div>

          {/* Vue d'ensemble */}
          {analyse.vue_ensemble && (
            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Vue d&apos;ensemble
              </p>
              <p className="text-sm leading-relaxed text-[var(--color-text)]">{analyse.vue_ensemble}</p>
              {analyse.echelle && (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">Echelle : {analyse.echelle}</p>
              )}
              {analyse.surface_totale_m2 != null && (
                <div className="mt-2">
                  <DimDisplay label="Surface totale" dim={analyse.surface_totale_m2} />
                </div>
              )}
            </div>
          )}

          {/* Pieces */}
          {analyse.pieces && analyse.pieces.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Pieces ({analyse.pieces.length})
              </p>
              {analyse.pieces.map((piece, i) => {
                const surfSol = parseDim(piece.surface_sol_m2);
                return (
                  <div key={i} className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[var(--color-text)]">{piece.nom}</h3>
                      {surfSol.valeur != null && (
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${SOURCE_COLORS[surfSol.source]}`}>
                          {surfSol.valeur} m2
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${SOURCE_DOT[surfSol.source]}`} />
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {(piece.longueur_m != null || piece.largeur_m != null) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <DimDisplay label="Longueur" dim={piece.longueur_m} />
                          <DimDisplay label="Largeur" dim={piece.largeur_m} />
                        </div>
                      )}
                      {piece.hauteur_m != null && <DimDisplay label="Hauteur" dim={piece.hauteur_m} />}
                      {piece.perimetre_m != null && <DimDisplay label="Perimetre" dim={piece.perimetre_m} />}
                      {piece.surface_murale_m2 != null && <DimDisplay label="Surface murs" dim={piece.surface_murale_m2} />}
                    </div>

                    {/* Ouvertures */}
                    {piece.ouvertures && piece.ouvertures.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {piece.ouvertures.map((ouv, j) => (
                          <span key={j} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${ouv.source ? SOURCE_COLORS[ouv.source] : "bg-[var(--color-bg)] text-[var(--color-text-muted)] border-transparent"}`}>
                            {ouv.type}
                            {ouv.largeur_m != null ? ` ${ouv.largeur_m}x${ouv.hauteur_m}m` : ""}
                            {ouv.source && <span className={`inline-block h-1.5 w-1.5 rounded-full ${SOURCE_DOT[ouv.source]}`} />}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Annotations */}
                    {piece.annotations && piece.annotations.length > 0 && (
                      <div className="mt-2 border-t border-[var(--color-surface-border)] pt-2">
                        {piece.annotations.map((note, j) => (
                          <p key={j} className="text-xs italic text-[var(--color-text-muted)]">{note}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Annotations generales */}
          {analyse.annotations_generales && analyse.annotations_generales.length > 0 && (
            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Notes du plan
              </p>
              <ul className="flex flex-col gap-1">
                {analyse.annotations_generales.map((note, i) => (
                  <li key={i} className="text-xs text-[var(--color-text-muted)]">{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes d'analyse */}
          {analyse.notes_analyse && (
            <div className="rounded-xl border border-amber-800/50 bg-amber-900/10 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400">Remarques</p>
              <p className="text-xs leading-relaxed text-amber-200/80">{analyse.notes_analyse}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
