"use client";

import { useState } from "react";
import { getAgentContext, setAgentContext } from "@/lib/agentContext";
import type { AgentResponse } from "@/types/agent";

interface SubAgentPanelProps {
  dossierId?: string;
  onAgentResponse: (response: AgentResponse) => void;
}

interface SubAgent {
  id: string;
  label: string;
  icon: React.ReactNode;
  triggerText: string; // text sent to /api/agent to trigger this intent
  requiresDossier: boolean;
}

const subAgents: SubAgent[] = [
  {
    id: "readback",
    label: "Relecture",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    ),
    triggerText: "Relis tout ce qui a ete dicte",
    requiresDossier: true,
  },
  {
    id: "devis",
    label: "Pre-devis",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    triggerText: "Genere un pre-devis",
    requiresDossier: true,
  },
  {
    id: "info",
    label: "Question",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    triggerText: "Combien de pieces et transcriptions dans ce dossier",
    requiresDossier: true,
  },
];

export default function SubAgentPanel({ dossierId, onAgentResponse }: SubAgentPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleTap = async (agent: SubAgent) => {
    if (agent.requiresDossier && !dossierId) {
      onAgentResponse({
        success: false,
        intent: agent.id as AgentResponse["intent"],
        action: "erreur_pas_de_dossier",
        message: "Selectionne un dossier d'abord.",
        tts: "Selectionne un dossier d'abord.",
      });
      return;
    }

    setLoading(agent.id);
    try {
      const context = getAgentContext();
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: agent.triggerText,
          dossierId: dossierId || "",
          context,
        }),
      });

      const data: AgentResponse = await res.json();

      if (data.context) {
        setAgentContext(data.context);
      }

      onAgentResponse(data);
    } catch {
      onAgentResponse({
        success: false,
        intent: agent.id as AgentResponse["intent"],
        action: "erreur",
        message: "Erreur de communication avec l'agent.",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {subAgents.map((agent) => {
        const disabled = agent.requiresDossier && !dossierId;
        const isLoading = loading === agent.id;

        return (
          <button
            key={agent.id}
            onClick={() => handleTap(agent)}
            disabled={disabled || isLoading}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all active:scale-95
              ${disabled
                ? "border border-[var(--color-surface-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] opacity-40"
                : "border border-[var(--color-surface-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              }
              ${isLoading ? "animate-pulse" : ""}
            `}
          >
            {isLoading ? (
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              agent.icon
            )}
            {agent.label}
          </button>
        );
      })}
    </div>
  );
}
