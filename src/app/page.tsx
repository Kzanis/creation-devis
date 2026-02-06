"use client";

import { useState, useEffect, useCallback } from "react";
import AudioRecorder from "@/components/AudioRecorder";
import PhotoCapture from "@/components/PhotoCapture";
import DossierSelector, { type Dossier } from "@/components/DossierSelector";

// ─────────────────────────────────────────────────────────────
// Onglets
// ─────────────────────────────────────────────────────────────

type Tab = "dictee" | "photos" | "infos";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "dictee",
    label: "Dictée",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    id: "photos",
    label: "Photos",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
    ),
  },
  {
    id: "infos",
    label: "Infos",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

// ─────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────

export default function Home() {
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dictee");

  // Édition dossier
  const [editNom, setEditNom] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDevis, setEditDevis] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Sync les champs quand un dossier est sélectionné
  const syncEditFields = useCallback((d: Dossier | null) => {
    setEditNom(d?.nom || "");
    setEditClient(d?.client || "");
    setEditDescription(d?.description || "");
    setEditDevis(d?.devis || "");
    setEditPhoto(d?.photo || "");
    setSaveMsg("");
  }, []);

  useEffect(() => { syncEditFields(selectedDossier); }, [selectedDossier, syncEditFields]);

  const handleSave = async () => {
    if (!selectedDossier) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/airtable/dossiers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: selectedDossier.id,
          fields: {
            "Nom du dossier": editNom,
            "Client": editClient,
            "Description / Relevé": editDescription,
            "Devis / Pré-devis": editDevis,
            "Photo": editPhoto,
          },
        }),
      });
      if (res.ok) {
        // Mettre à jour le dossier local
        setSelectedDossier({
          ...selectedDossier,
          nom: editNom,
          client: editClient,
          description: editDescription,
          devis: editDevis,
          photo: editPhoto,
        });
        setSaveMsg("Sauvegardé");
        setTimeout(() => setSaveMsg(""), 2000);
      } else {
        setSaveMsg("Erreur de sauvegarde");
      }
    } catch {
      setSaveMsg("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const pieceId = selectedDossier?.id || "demo-piece-id";
  const chantierId = selectedDossier?.numero || "demo-chantier-id";
  const userId = "demo-user-id";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-[var(--card-border)] bg-[var(--card)] px-4 py-3 shadow-sm">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-base font-semibold text-[var(--foreground)]">Création de Devis</h1>
              <p className="text-xs text-[var(--muted)]">Assistant de chantier</p>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENU */}
      <main className="flex-1 px-4 py-4">
        <div className="mx-auto max-w-lg flex flex-col gap-4">
          {/* Sélecteur de dossier — toujours visible, compact */}
          <section>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Dossier actif</label>
            <DossierSelector selected={selectedDossier} onSelect={setSelectedDossier} />
            {!selectedDossier && (
              <p className="mt-2 text-xs text-[var(--muted)] text-center">Aucun dossier sélectionné — les données ne seront pas sauvegardées</p>
            )}
          </section>

          {/* Onglets — toujours visibles */}
          <nav className="flex rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-1 shadow-sm">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Contenu des onglets — toujours visible */}
          <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
            {activeTab === "dictee" && (
              <div>
                <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Dictée vocale</h2>
                <AudioRecorder
                  pieceId={pieceId}
                  chantierId={chantierId}
                  userId={userId}
                  dossierId={selectedDossier?.id}
                  dossierNumero={selectedDossier?.numero}
                  dossierClient={selectedDossier?.client}
                />
              </div>
            )}
            {activeTab === "photos" && (
              <div>
                <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Photos du chantier</h2>
                <PhotoCapture
                  dossierId={selectedDossier?.id}
                  dossierNumero={selectedDossier?.numero}
                  dossierClient={selectedDossier?.client}
                />
              </div>
            )}
            {activeTab === "infos" && (
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Informations du dossier</h2>
                {selectedDossier ? (
                  <>
                    <div className="rounded-lg bg-[var(--muted-light)] p-3">
                      <p className="text-xs text-[var(--muted)]">Numéro</p>
                      <p className="text-sm font-medium">{selectedDossier.numero || "\u2014"}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--muted)]">Client</label>
                      <input type="text" value={editClient} onChange={(e) => setEditClient(e.target.value)} className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--muted)]">Nom du dossier</label>
                      <input type="text" value={editNom} onChange={(e) => setEditNom(e.target.value)} className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--muted)]">Lien devis / pré-devis</label>
                      <input type="url" value={editDevis} onChange={(e) => setEditDevis(e.target.value)} placeholder="https://..." className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--muted)]">Lien description / relevé</label>
                      <input type="url" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="https://..." className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--muted)]">Lien photo</label>
                      <input type="url" value={editPhoto} onChange={(e) => setEditPhoto(e.target.value)} placeholder="https://..." className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                        {saving ? "Sauvegarde…" : "Sauvegarder"}
                      </button>
                      {saveMsg && (
                        <span className={`text-sm font-medium ${saveMsg === "Sauvegardé" ? "text-green-600" : "text-red-500"}`}>{saveMsg}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-[var(--muted-light)] p-6 text-center">
                    <p className="text-sm text-[var(--muted)]">Sélectionne un dossier pour voir ses informations</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-[var(--card-border)] bg-[var(--card)] px-4 py-3">
        <p className="text-center text-xs text-[var(--muted)]">Création de Devis &mdash; v0.2</p>
      </footer>
    </div>
  );
}
