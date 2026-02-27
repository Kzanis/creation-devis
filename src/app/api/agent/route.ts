import { NextRequest, NextResponse } from "next/server";
import { classifyIntent } from "@/lib/agentClassifier";
import {
  handleDictation,
  handleReadback,
  handleCorrection,
  handleDevis,
  handleInfo,
} from "./handlers";
import type { AgentContext, AgentResponse } from "@/types/agent";

const N8N_ORCHESTRATOR_URL = process.env.WEBHOOK_N8N_AGENT_ORCHESTRATOR_URL;

// Intents that must bypass n8n orchestrator (use local handlers with real data)
const READBACK_KEYWORDS = /\b(relis|relire|rappelle|rappeler|résumé|resume|qu'est.ce que j'ai dit|relecture|relit)\b/i;

function isReadbackIntent(text: string): boolean {
  return READBACK_KEYWORDS.test(text);
}

/**
 * Try the n8n AI Agent orchestrator first.
 * Returns AgentResponse if successful, null if n8n is unreachable.
 */
async function tryN8nOrchestrator(
  text: string,
  dossierId: string
): Promise<AgentResponse | null> {
  if (!N8N_ORCHESTRATOR_URL) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(N8N_ORCHESTRATOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, dossierId }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[Agent] n8n orchestrator returned ${res.status}, falling back to local`);
      return null;
    }

    const data = await res.json();

    // Validate minimum response shape
    if (data && typeof data.intent === "string" && typeof data.message === "string") {
      // Detect n8n agent errors (max iterations, fallback, tool errors, paraphrased errors)
      const msg = data.message.toLowerCase();
      const isError =
        data.action === "agent_fallback" ||
        data.action === "error" ||
        msg.includes("max iterations") ||
        msg.includes("n'est pas actif") ||
        msg.includes("not active") ||
        msg.includes("erreur est survenue") ||
        msg.includes("error occurred") ||
        (msg.includes("erreur") && msg.includes("vérifier"));
      if (isError) {
        console.warn(`[Agent] n8n error detected (action=${data.action}), falling back to local`);
        return null;
      }

      // Fix: n8n AI Agent sometimes returns the entire JSON response as the message string
      let finalMessage = data.message;
      let finalData = data.data || {};
      let finalTts = data.tts;

      if (finalMessage.startsWith("{") && finalMessage.endsWith("}")) {
        try {
          const parsed = JSON.parse(finalMessage);
          if (parsed && typeof parsed.intent === "string") {
            // The message contains a nested JSON response — extract the real values
            console.log("[Agent] n8n returned nested JSON in message, extracting inner values");
            finalMessage = parsed.message || parsed.tts || "";
            finalTts = parsed.tts || finalTts;
            finalData = { ...finalData, ...(parsed.data || {}) };
          }
        } catch {
          // Not valid JSON — keep original message
        }
      }

      // Fix: if message is empty after parsing, fall back to tts or a default
      if (!finalMessage.trim()) {
        finalMessage = finalTts || data.tts || "Bien recu.";
      }

      return {
        success: data.success ?? true,
        intent: data.intent,
        action: data.action || "n8n_agent",
        message: finalMessage,
        tts: finalTts || finalMessage.substring(0, 200),
        data: finalData,
        context: data.context || {
          lastIntent: data.intent,
          lastEntity: null,
          lastTranscription: text,
          timestamp: Date.now(),
          dossierId,
        },
      } as AgentResponse;
    }

    console.warn("[Agent] n8n response invalid shape, falling back to local");
    return null;
  } catch (error) {
    console.warn("[Agent] n8n orchestrator unreachable, falling back to local:", error);
    return null;
  }
}

/**
 * POST /api/agent
 * Main dispatcher: tries n8n AI Agent first, falls back to local classifier + handlers.
 * Body: { text: string, dossierId?: string, context?: AgentContext }
 * Returns: AgentResponse
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, dossierId, context } = body as {
      text: string;
      dossierId?: string;
      context?: AgentContext | null;
    };

    if (!text || text.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          intent: "dictation",
          action: "erreur",
          message: "Texte vide",
        } as AgentResponse,
        { status: 400 }
      );
    }

    const trimmedText = text.trim();

    // Pre-check: readback intent MUST use local handler (n8n returns conversational
    // response without actual transcription content — useless for TTS readback)
    const forceLocal = isReadbackIntent(trimmedText);

    if (forceLocal) {
      console.log(`[Agent] Readback detected, bypassing n8n → local handler`);
    }

    // Strategy 1: Try n8n AI Agent orchestrator (unless bypassed)
    if (!forceLocal) {
      const n8nResponse = await tryN8nOrchestrator(trimmedText, dossierId || "");
      if (n8nResponse) {
        console.log(`[Agent] n8n → ${n8nResponse.intent}: ${n8nResponse.action}`);
        return NextResponse.json(n8nResponse);
      }

      // n8n failed — log prominently and flag in response
      console.error(
        `[Agent] N8N ORCHESTRATOR INDISPONIBLE — fallback local active pour: "${text.substring(0, 80)}"`
      );
    }

    // Strategy 2: Local classifier + handlers
    const classification = forceLocal
      ? { intent: "readback" as const, confidence: 1, entity: null, reasoning: "Keyword match — bypassed n8n" }
      : await classifyIntent(trimmedText, context || null);

    console.log(
      `[Agent] ${forceLocal ? "forced-local" : "local"} → "${trimmedText.substring(0, 60)}..." → ${classification.intent} (${classification.confidence}) entity=${classification.entity}`
    );

    let response: AgentResponse;

    switch (classification.intent) {
      case "readback":
        response = await handleReadback(trimmedText, dossierId || "", classification);
        break;
      case "correction":
        response = await handleCorrection(trimmedText, dossierId || "", classification, context || null);
        break;
      case "devis":
        response = await handleDevis(trimmedText, dossierId || "");
        break;
      case "info":
        response = await handleInfo(trimmedText, dossierId || "", classification);
        break;
      case "dictation":
      default:
        response = await handleDictation(trimmedText, dossierId || "", classification);
        break;
    }

    // Flag source of response
    response.data = {
      ...response.data,
      _fallback: true,
      _fallback_reason: forceLocal ? "bypass_n8n_readback" : "n8n_orchestrator_indisponible",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Agent] Global error, fallback dictation:", error);

    let text = "";
    try {
      const body = await request.clone().json();
      text = body.text || "";
    } catch {
      // can't parse body
    }

    return NextResponse.json({
      success: true,
      intent: "dictation",
      action: "fallback_erreur",
      message: text,
      tts: "Erreur agent, dictee sauvegardee.",
    } as AgentResponse);
  }
}
