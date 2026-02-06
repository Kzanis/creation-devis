"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface Dossier {
  id: string;
  numero: string;
  nom: string;
  client: string;
  photo: string;
  devis: string;
  description: string;
}

interface DossierSelectorProps {
  onSelect: (dossier: Dossier) => void;
  selected: Dossier | null;
}

export default function DossierSelector({ onSelect, selected }: DossierSelectorProps) {
  const [query, setQuery] = useState("");
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newNumero, setNewNumero] = useState("");
  const [newNom, setNewNom] = useState("");
  const [newClient, setNewClient] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCreate = async () => {
    if (!newNumero.trim() || !newClient.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/airtable/dossiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: newNumero, nom: newNom, client: newClient }),
      });
      const data = await res.json();
      if (data.success && data.dossier) {
        onSelect(data.dossier);
        setShowCreate(false);
        setNewNumero("");
        setNewNom("");
        setNewClient("");
        setOpen(false);
      }
    } catch {
      // erreur silencieuse pour le MVP
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchDossiers = useCallback(async (search: string) => {
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
  }, []);

  useEffect(() => { fetchDossiers(""); }, [fetchDossiers]);

  const handleSearch = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchDossiers(value), 300);
  };

  const handleSelect = (dossier: Dossier) => { onSelect(dossier); setQuery(""); setOpen(false); };

  return (
    <div ref={containerRef} className="relative w-full">
      {selected ? (
        <div className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">{selected.numero} &mdash; {selected.client}</p>
            <p className="text-xs text-[var(--muted)] truncate">{selected.nom}</p>
          </div>
          <button onClick={() => { onSelect(null as unknown as Dossier); setOpen(true); fetchDossiers(""); }} className="ml-3 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--primary)] bg-[var(--primary-light)] hover:bg-blue-100 transition-colors">Changer</button>
        </div>
      ) : (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" value={query} onChange={(e) => handleSearch(e.target.value)} onFocus={() => setOpen(true)} placeholder="Rechercher un dossier (numéro, client…)" className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] py-3 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all placeholder:text-[var(--muted)]" />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] shadow-lg overflow-hidden">
          {showCreate ? (
            <div className="p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Nouveau dossier</p>
              <input type="text" value={newNumero} onChange={(e) => setNewNumero(e.target.value)} placeholder="Numéro (ex: 2025-004) *" className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
              <input type="text" value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Client *" className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
              <input type="text" value={newNom} onChange={(e) => setNewNom(e.target.value)} placeholder="Nom du dossier (optionnel)" className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border border-[var(--card-border)] py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--muted-light)] transition-colors">Annuler</button>
                <button onClick={handleCreate} disabled={creating || !newNumero.trim() || !newClient.trim()} className="flex-1 rounded-lg bg-[var(--primary)] py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {creating ? "Création…" : "Créer"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => setShowCreate(true)} className="flex w-full items-center gap-2 border-b border-[var(--muted-light)] px-4 py-3 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Nouveau dossier
              </button>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <svg className="h-5 w-5 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                </div>
              ) : dossiers.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--muted)]">Aucun dossier trouvé</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto divide-y divide-[var(--muted-light)]">
                  {dossiers.map((d) => (
                    <li key={d.id}>
                      <button onClick={() => handleSelect(d)} className="flex w-full flex-col px-4 py-3 text-left hover:bg-[var(--primary-light)] transition-colors">
                        <span className="text-sm font-medium text-[var(--foreground)]">{d.numero} &mdash; {d.client}</span>
                        <span className="text-xs text-[var(--muted)]">{d.nom}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
