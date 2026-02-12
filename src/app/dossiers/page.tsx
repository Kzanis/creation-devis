"use client";

import { useState, useEffect, useCallback } from "react";
import { type Dossier } from "@/components/DossierSelector";

type Statut = "all" | "brouillon" | "en_cours" | "valide";

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "var(--color-text-muted)" },
  en_cours: { label: "En cours", color: "var(--color-primary)" },
  valide: { label: "Valide", color: "var(--color-success)" },
};

function getStatut(d: Dossier): string {
  if (d.devis) return "valide";
  if (d.description || d.photo) return "en_cours";
  return "brouillon";
}

export default function DossiersPage() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Statut>("all");
  const [search, setSearch] = useState("");

  const fetchDossiers = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/airtable/dossiers${params}`);
      const data = await res.json();
      setDossiers(data.dossiers || []);
    } catch {
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchDossiers(); }, [fetchDossiers]);

  const filtered = dossiers.filter((d) => {
    if (filter === "all") return true;
    return getStatut(d) === filter;
  });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--color-bg)]">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-surface-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <a
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-[var(--color-text)]">Dossiers</h1>
            <p className="text-xs text-[var(--color-text-muted)]">{dossiers.length} dossier{dossiers.length > 1 ? "s" : ""}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <div className="mx-auto flex max-w-lg flex-col gap-4">
          {/* Recherche */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

          {/* Filtres */}
          <div className="flex gap-2">
            {(["all", "brouillon", "en_cours", "valide"] as Statut[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filter === s
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {s === "all" ? "Tous" : STATUT_LABELS[s].label}
              </button>
            ))}
          </div>

          {/* Liste */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="h-6 w-6 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">Aucun dossier trouve</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtered.map((d) => {
                const statut = getStatut(d);
                const s = STATUT_LABELS[statut];
                return (
                  <li key={d.id}>
                    <a
                      href={`/?dossier=${d.id}`}
                      className="flex items-center gap-4 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-4 py-3 transition-all hover:border-[var(--color-primary)] active:scale-[0.99]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                            {d.numero}
                          </p>
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              color: s.color,
                              backgroundColor: `color-mix(in srgb, ${s.color} 15%, transparent)`,
                            }}
                          >
                            {s.label}
                          </span>
                        </div>
                        <p className="truncate text-xs text-[var(--color-text-muted)]">
                          {d.client}{d.nom ? ` — ${d.nom}` : ""}
                        </p>
                      </div>
                      <svg className="h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
