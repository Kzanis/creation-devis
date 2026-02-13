import type { AgentResponse, AgentContext, IntentResult } from "@/types/agent";

const AIRTABLE_PAT = process.env.AIRTABLE_PAT!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_BASE_URL = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1";

// n8n webhook URLs for sub-agents
const N8N_READBACK_URL = process.env.WEBHOOK_N8N_AGENT_READBACK_URL;
const N8N_CORRECTION_URL = process.env.WEBHOOK_N8N_AGENT_CORRECTION_URL;
const N8N_INFO_URL = process.env.WEBHOOK_N8N_AGENT_INFO_URL;

// ── Helper: call n8n webhook ────────────────────────────────────────

async function callN8nWebhook(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs = 15000
): Promise<AgentResponse | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.error(`n8n webhook ${url} returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data as AgentResponse;
  } catch (error) {
    console.error(`n8n webhook ${url} failed:`, error);
    return null;
  }
}

// ── DICTATION handler ──────────────────────────────────────────────

export async function handleDictation(
  text: string,
  dossierId: string,
  classification: IntentResult
): Promise<AgentResponse> {
  // Simply return the text — the client will add it to segments
  return {
    success: true,
    intent: "dictation",
    action: "transcription_ajoutee",
    message: text,
    tts: "Bien recu.",
    data: { entity: classification.entity },
    context: {
      lastIntent: "dictation",
      lastEntity: classification.entity,
      lastTranscription: text,
      timestamp: Date.now(),
      dossierId,
    },
  };
}

// ── READBACK handler ───────────────────────────────────────────────

export async function handleReadback(
  text: string,
  dossierId: string,
  classification: IntentResult
): Promise<AgentResponse> {
  if (!dossierId) {
    return {
      success: false,
      intent: "readback",
      action: "erreur_pas_de_dossier",
      message: "Selectionne un dossier d'abord pour que je puisse relire.",
      tts: "Selectionne un dossier d'abord.",
    };
  }

  // Try n8n webhook first
  if (N8N_READBACK_URL) {
    const n8nResponse = await callN8nWebhook(N8N_READBACK_URL, {
      text,
      dossierId,
      entity: classification.entity,
    });

    if (n8nResponse) {
      // Ensure context is set
      return {
        ...n8nResponse,
        intent: "readback",
        context: n8nResponse.context || {
          lastIntent: "readback",
          lastEntity: classification.entity,
          lastTranscription: text,
          timestamp: Date.now(),
          dossierId,
        },
      };
    }
    console.warn("n8n readback failed, falling back to local handler");
  }

  // Fallback: local TypeScript logic
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Transcriptions?filterByFormula=${encodeURIComponent(`{Dossier ID}="${dossierId}"`)}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } }
    );

    if (!res.ok) {
      return {
        success: false,
        intent: "readback",
        action: "erreur_airtable",
        message: "Erreur de lecture des transcriptions.",
        tts: "Erreur de lecture.",
      };
    }

    const data = await res.json();
    const records = data.records || [];

    if (records.length === 0) {
      return {
        success: true,
        intent: "readback",
        action: "aucune_transcription",
        message: "Aucune transcription trouvee pour ce dossier.",
        tts: "Je n'ai aucune transcription pour ce dossier.",
      };
    }

    const allText = records
      .map((r: { fields: { Texte?: string } }) => r.fields.Texte || "")
      .filter(Boolean)
      .join("\n\n");

    let readbackText = allText;
    if (classification.entity && AI_API_KEY) {
      const extractRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "anthropic/claude-3.5-haiku",
          messages: [
            {
              role: "system",
              content: `Tu es un assistant de chantier. Extrais uniquement la partie du texte qui concerne "${classification.entity}". Si tu ne trouves rien de specifique, retourne le texte complet. Reponds directement avec le texte extrait, sans explication.`,
            },
            { role: "user", content: allText },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (extractRes.ok) {
        const extractData = await extractRes.json();
        readbackText = extractData.choices?.[0]?.message?.content || allText;
      }
    }

    return {
      success: true,
      intent: "readback",
      action: "relecture",
      message: readbackText,
      tts: readbackText.substring(0, 500),
      data: { transcriptions_count: records.length },
      context: {
        lastIntent: "readback",
        lastEntity: classification.entity,
        lastTranscription: text,
        timestamp: Date.now(),
        dossierId,
      },
    };
  } catch (error) {
    console.error("Readback error:", error);
    return {
      success: false,
      intent: "readback",
      action: "erreur",
      message: "Erreur lors de la relecture.",
      tts: "Erreur lors de la relecture.",
    };
  }
}

// ── CORRECTION handler ─────────────────────────────────────────────

export async function handleCorrection(
  text: string,
  dossierId: string,
  classification: IntentResult,
  agentContext: AgentContext | null
): Promise<AgentResponse> {
  if (!dossierId) {
    return {
      success: false,
      intent: "correction",
      action: "erreur_pas_de_dossier",
      message: "Selectionne un dossier pour enregistrer la correction.",
      tts: "Selectionne un dossier d'abord.",
    };
  }

  // Try n8n webhook first
  if (N8N_CORRECTION_URL) {
    const n8nResponse = await callN8nWebhook(N8N_CORRECTION_URL, {
      text,
      dossierId,
      entity: classification.entity,
      lastEntity: agentContext?.lastEntity || null,
      lastTranscription: agentContext?.lastTranscription || null,
    });

    if (n8nResponse) {
      return {
        ...n8nResponse,
        intent: "correction",
        context: n8nResponse.context || {
          lastIntent: "correction",
          lastEntity: classification.entity || agentContext?.lastEntity || null,
          lastTranscription: text,
          timestamp: Date.now(),
          dossierId,
        },
      };
    }
    console.warn("n8n correction failed, falling back to local handler");
  }

  // Fallback: local TypeScript logic
  try {
    const titre = agentContext?.lastEntity
      ? `Correction — ${agentContext.lastEntity}`
      : "Correction";

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Transcriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [
            {
              fields: {
                Titre: titre,
                Texte: text,
                "Dossier ID": dossierId,
                Statut: "correction",
              },
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Correction save error:", errText);
      return {
        success: false,
        intent: "correction",
        action: "erreur_sauvegarde",
        message: "Erreur lors de la sauvegarde de la correction.",
        tts: "Erreur de sauvegarde.",
      };
    }

    const data = await res.json();
    const recordId = data.records?.[0]?.id;

    return {
      success: true,
      intent: "correction",
      action: "correction_enregistree",
      message: `Correction enregistree : "${text}". En attente de validation.`,
      tts: "Correction enregistree. En attente de validation.",
      data: { transcription_id: recordId },
      context: {
        lastIntent: "correction",
        lastEntity: classification.entity || agentContext?.lastEntity || null,
        lastTranscription: text,
        timestamp: Date.now(),
        dossierId,
      },
    };
  } catch (error) {
    console.error("Correction error:", error);
    return {
      success: false,
      intent: "correction",
      action: "erreur",
      message: "Erreur lors de la correction.",
      tts: "Erreur lors de la correction.",
    };
  }
}

// ── DEVIS handler ──────────────────────────────────────────────────

export async function handleDevis(
  text: string,
  dossierId: string
): Promise<AgentResponse> {
  if (!dossierId) {
    return {
      success: false,
      intent: "devis",
      action: "erreur_pas_de_dossier",
      message: "Selectionne un dossier pour generer un devis.",
      tts: "Selectionne un dossier d'abord.",
    };
  }

  // Devis is triggered client-side via PreDevis component
  return {
    success: true,
    intent: "devis",
    action: "lancement_devis",
    message: "Lancement de la generation du pre-devis...",
    tts: "Je lance la generation du pre-devis.",
    data: { trigger: "generate-devis", dossierId },
    context: {
      lastIntent: "devis",
      lastEntity: null,
      lastTranscription: text,
      timestamp: Date.now(),
      dossierId,
    },
  };
}

// ── INFO handler ───────────────────────────────────────────────────

export async function handleInfo(
  text: string,
  dossierId: string,
  classification: IntentResult
): Promise<AgentResponse> {
  if (!dossierId) {
    return {
      success: false,
      intent: "info",
      action: "erreur_pas_de_dossier",
      message: "Selectionne un dossier pour que je puisse repondre.",
      tts: "Selectionne un dossier d'abord.",
    };
  }

  // Try n8n webhook first
  if (N8N_INFO_URL) {
    const n8nResponse = await callN8nWebhook(N8N_INFO_URL, {
      text,
      dossierId,
      entity: classification.entity,
    });

    if (n8nResponse) {
      return {
        ...n8nResponse,
        intent: "info",
        context: n8nResponse.context || {
          lastIntent: "info",
          lastEntity: classification.entity,
          lastTranscription: text,
          timestamp: Date.now(),
          dossierId,
        },
      };
    }
    console.warn("n8n info failed, falling back to local handler");
  }

  // Fallback: local TypeScript logic
  try {
    const [dossierRes, transcriptionsRes] = await Promise.all([
      fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Dossiers/${dossierId}`,
        { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } }
      ),
      fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Transcriptions?filterByFormula=${encodeURIComponent(`{Dossier ID}="${dossierId}"`)}`,
        { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } }
      ),
    ]);

    const dossierData = dossierRes.ok ? await dossierRes.json() : null;
    const transcriptionsData = transcriptionsRes.ok
      ? await transcriptionsRes.json()
      : { records: [] };

    const transcriptions = transcriptionsData.records || [];
    const allText = transcriptions
      .map((r: { fields: { Texte?: string } }) => r.fields.Texte || "")
      .filter(Boolean)
      .join("\n\n");

    if (!AI_API_KEY) {
      const message = `Dossier: ${dossierData?.fields?.["Nom du dossier"] || "?"}\nTranscriptions: ${transcriptions.length}\nPhotos: ${(dossierData?.fields?.["Photos Chantier"] as unknown[])?.length || 0}`;
      return {
        success: true,
        intent: "info",
        action: "info_brute",
        message,
        tts: message,
      };
    }

    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-haiku",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant de chantier. Reponds factuellement et brievement a la question de l'artisan en te basant UNIQUEMENT sur les donnees fournies. Si tu ne trouves pas l'info, dis-le clairement.`,
          },
          {
            role: "user",
            content: `DONNEES DU DOSSIER:\nNom: ${dossierData?.fields?.["Nom du dossier"] || "?"}\nClient: ${dossierData?.fields?.["Client"] || "?"}\nNombre de transcriptions: ${transcriptions.length}\nNombre de photos: ${(dossierData?.fields?.["Photos Chantier"] as unknown[])?.length || 0}\n\nTRANSCRIPTIONS:\n${allText.substring(0, 2000)}\n\nQUESTION: ${text}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      return {
        success: false,
        intent: "info",
        action: "erreur_llm",
        message: "Erreur lors de la recherche d'information.",
        tts: "Erreur lors de la recherche.",
      };
    }

    const aiData = await res.json();
    const answer = aiData.choices?.[0]?.message?.content || "Pas de reponse.";

    return {
      success: true,
      intent: "info",
      action: "reponse_info",
      message: answer,
      tts: answer.substring(0, 500),
      context: {
        lastIntent: "info",
        lastEntity: classification.entity,
        lastTranscription: text,
        timestamp: Date.now(),
        dossierId,
      },
    };
  } catch (error) {
    console.error("Info handler error:", error);
    return {
      success: false,
      intent: "info",
      action: "erreur",
      message: "Erreur lors de la recherche d'information.",
      tts: "Erreur lors de la recherche.",
    };
  }
}
