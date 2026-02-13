"use client";

import { useState, useCallback, useRef } from "react";
import AudioRecorder from "@/components/AudioRecorder";
import PhotoCapture from "@/components/PhotoCapture";
import PlanAnalyzer from "@/components/PlanAnalyzer";
import PreDevis from "@/components/PreDevis";
import AgentResponseCard from "@/components/AgentResponse";
import SubAgentPanel from "@/components/SubAgentPanel";
import DossierSelector, { type Dossier } from "@/components/DossierSelector";
import { getClientConfig } from "@/lib/clientConfig";
import type { AgentResponse } from "@/types/agent";

const config = getClientConfig();

export default function Home() {
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [segments, setSegments] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [agentResponse, setAgentResponse] = useState<AgentResponse | null>(null);
  const [triggerDevis, setTriggerDevis] = useState(0);
  const preDevisRef = useRef<HTMLDivElement>(null);

  const handleTranscription = useCallback((text: string) => {
    if (text.trim()) {
      setSegments((prev) => [...prev, text.trim()]);
      setSent(false);
    }
  }, []);

  const handleAgentResponse = useCallback((response: AgentResponse) => {
    // Dictation intent: text already added to segments via onTranscription
    // For non-dictation intents: show the agent response card
    if (response.intent !== "dictation") {
      setAgentResponse(response);
    }

    // If devis intent: trigger the PreDevis component
    if (response.intent === "devis" && response.data?.trigger === "generate-devis") {
      setTriggerDevis((prev) => prev + 1);
      // Scroll to PreDevis section
      setTimeout(() => {
        preDevisRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, []);

  const removeSegment = useCallback((index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const sendReleve = useCallback(async () => {
    if (segments.length === 0) return;

    setSending(true);
    try {
      const fullText = segments.join("\n\n");
      const res = await fetch("/api/save-transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullText,
          dossier_id: selectedDossier?.id || "",
          dossier_numero: selectedDossier?.numero || "",
          dossier_client: selectedDossier?.client || "",
          client_id: "demo",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSent(true);
        setSegments([]);
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (e) {
      alert(`Erreur reseau: ${e instanceof Error ? e.message : "inconnue"}`);
    } finally {
      setSending(false);
    }
  }, [segments, selectedDossier]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--color-bg)]">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-surface-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {config.logo ? (
            <img src={config.logo} alt={config.name} className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-base font-semibold text-[var(--color-text)]">Dictaphone Chantier</h1>
            <p className="text-xs text-[var(--color-text-muted)]">{config.name}</p>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex flex-1 flex-col px-4 py-4">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5">
          {/* Dossier selector */}
          <section>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Dossier actif
            </label>
            <DossierSelector selected={selectedDossier} onSelect={setSelectedDossier} />
            {!selectedDossier && (
              <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
                Selectionne un dossier pour sauvegarder tes dictees
              </p>
            )}
          </section>

          {/* Micro */}
          <section className="flex flex-col items-center gap-4 py-4">
            <AudioRecorder
              onTranscription={handleTranscription}
              dossierId={selectedDossier?.id}
              onAgentResponse={handleAgentResponse}
            />
            <SubAgentPanel
              dossierId={selectedDossier?.id}
              onAgentResponse={handleAgentResponse}
            />
          </section>

          {/* Agent response */}
          {agentResponse && agentResponse.intent !== "dictation" && (
            <section>
              <AgentResponseCard
                response={agentResponse}
                onDismiss={() => setAgentResponse(null)}
              />
            </section>
          )}

          {/* Segments accumules */}
          {segments.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Releve en cours ({segments.length} segment{segments.length > 1 ? "s" : ""})
                </p>
              </div>

              <ul className="flex flex-col gap-2">
                {segments.map((seg, i) => (
                  <li
                    key={i}
                    className="group relative rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-3 pr-10"
                  >
                    <p className="text-sm leading-relaxed text-[var(--color-text)]">{seg}</p>
                    <button
                      onClick={() => removeSegment(i)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] opacity-60 transition-all hover:bg-red-900/30 hover:text-[var(--color-danger)] hover:opacity-100"
                      aria-label="Supprimer ce segment"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Bouton envoyer */}
              <button
                onClick={sendReleve}
                disabled={sending}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-success)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    Envoyer le releve
                  </>
                )}
              </button>
            </section>
          )}

          {/* Confirmation envoi */}
          {sent && segments.length === 0 && (
            <div className="rounded-xl border border-green-800 bg-green-900/20 p-4 text-center">
              <p className="text-sm font-medium text-[var(--color-success)]">
                Releve enregistre avec succes !
              </p>
            </div>
          )}

          {/* Pre-devis — visible juste apres la dictee, pas besoin de plan */}
          {selectedDossier && (
            <section className="pb-4" ref={preDevisRef}>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Pre-devis
              </label>
              <PreDevis
                key={triggerDevis}
                dossierId={selectedDossier.id}
                dossierNumero={selectedDossier.numero}
                dossierClient={selectedDossier.client}
              />
            </section>
          )}

          {/* Photos */}
          <section>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Photos chantier
            </label>
            <PhotoCapture dossierId={selectedDossier?.id} />
          </section>

          {/* Plans */}
          <section>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Plans
            </label>
            <PlanAnalyzer dossierId={selectedDossier?.id} />
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[var(--color-surface-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="mx-auto max-w-lg">
          <a
            href="/dossiers"
            className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            Tous les dossiers
          </a>
        </div>
      </footer>
    </div>
  );
}
