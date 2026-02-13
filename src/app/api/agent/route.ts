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

      return {
        success: data.success ?? true,
        intent: data.intent,
        action: data.action || "n8n_agent",
        message: data.message,
        tts: data.tts || data.message.substring(0, 200),
        data: data.data || {},
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

    // Strategy 1: Try n8n AI Agent orchestrator
    const n8nResponse = await tryN8nOrchestrator(text.trim(), dossierId || "");
    if (n8nResponse) {
      console.log(`[Agent] n8n → ${n8nResponse.intent}: ${n8nResponse.action}`);
      return NextResponse.json(n8nResponse);
    }

    // n8n failed — log prominently and flag in response
    console.error(
      `[Agent] ⚠️ N8N ORCHESTRATOR INDISPONIBLE — fallback local active pour: "${text.substring(0, 80)}"`
    );

    // Strategy 2: Local classifier + handlers (fallback)
    const classification = await classifyIntent(text.trim(), context || null);

    console.log(
      `[Agent] local → "${text.substring(0, 60)}..." → ${classification.intent} (${classification.confidence}) entity=${classification.entity}`
    );

    let response: AgentResponse;

    switch (classification.intent) {
      case "readback":
        response = await handleReadback(text.trim(), dossierId || "", classification);
        break;
      case "correction":
        response = await handleCorrection(text.trim(), dossierId || "", classification, context || null);
        break;
      case "devis":
        response = await handleDevis(text.trim(), dossierId || "");
        break;
      case "info":
        response = await handleInfo(text.trim(), dossierId || "", classification);
        break;
      case "dictation":
      default:
        response = await handleDictation(text.trim(), dossierId || "", classification);
        break;
    }

    // Flag that this came from local fallback, not n8n
    response.data = {
      ...response.data,
      _fallback: true,
      _fallback_reason: "n8n_orchestrator_indisponible",
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
