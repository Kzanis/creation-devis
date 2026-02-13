import type { IntentResult, AgentContext } from "@/types/agent";

/**
 * Classifies user intent from transcribed text using a fast LLM.
 * Server-side only (called from /api/agent).
 */
export async function classifyIntent(
  text: string,
  context: AgentContext | null
): Promise<IntentResult> {
  const AI_API_KEY = process.env.AI_API_KEY;
  const AI_BASE_URL = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1";

  if (!AI_API_KEY) {
    // No API key — default to dictation
    return {
      intent: "dictation",
      confidence: 1,
      entity: null,
      reasoning: "Pas de cle API configuree, fallback dictation",
    };
  }

  const contextHint = context?.lastIntent
    ? `\nCONTEXTE PRECEDENT: L'utilisateur vient de faire une action "${context.lastIntent}" sur "${context.lastEntity || "non specifie"}". Sa derniere transcription etait: "${context.lastTranscription || ""}"`
    : "";

  const systemPrompt = `Tu es un classifieur d'intention pour un assistant vocal de chantier BTP.
L'utilisateur est un artisan peintre qui dicte sur le terrain.

INTENTIONS POSSIBLES :
- "dictation" : L'utilisateur dicte des mesures, des observations, un releve de chantier. C'est le cas PAR DEFAUT.
- "readback" : L'utilisateur demande de relire ou rappeler ce qui a ete dicte. Mots-cles : "relis", "rappelle", "qu'est-ce que j'ai dit", "resume".
- "correction" : L'utilisateur corrige une info precedente. Mots-cles : "non c'est", "corrige", "en fait", "rectification". NECESSITE un contexte precedent.
- "devis" : L'utilisateur demande de generer un devis ou pre-devis. Mots-cles : "fais un devis", "genere le devis", "pre-devis", "chiffre-moi".
- "info" : L'utilisateur pose une question sur les donnees du dossier. Mots-cles : "combien", "est-ce que", "quel est", "donne-moi".
${contextHint}

REGLES :
- Si le texte contient des mesures (dimensions, surfaces) sans demande explicite → "dictation"
- "correction" UNIQUEMENT si contexte precedent existe ET le texte corrige clairement quelque chose
- En cas de doute → "dictation" (on ne perd jamais de donnees)
- L'entite est le sujet principal mentionne (nom de piece, element, etc.)

Reponds UNIQUEMENT en JSON valide :
{"intent": "...", "confidence": 0.0-1.0, "entity": "..." ou null, "reasoning": "..."}`;

  const userPrompt = `Texte transcrit : "${text}"`;

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-haiku",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      console.error("Classifier LLM error:", res.status);
      return fallbackDictation(text);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON response
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const result: IntentResult = JSON.parse(cleaned);

    // Confidence threshold — below 0.7 falls back to dictation
    if (result.confidence < 0.7) {
      return {
        ...result,
        intent: "dictation",
        reasoning: `Confiance trop basse (${result.confidence}), fallback dictation. Original: ${result.reasoning}`,
      };
    }

    // Correction requires context
    if (result.intent === "correction" && !context?.lastIntent) {
      return {
        ...result,
        intent: "dictation",
        reasoning: "Correction detectee mais pas de contexte precedent, fallback dictation",
      };
    }

    return result;
  } catch (error) {
    console.error("Classifier error:", error);
    return fallbackDictation(text);
  }
}

function fallbackDictation(text: string): IntentResult {
  return {
    intent: "dictation",
    confidence: 1,
    entity: null,
    reasoning: `Erreur classification, fallback dictation pour: "${text.substring(0, 50)}..."`,
  };
}
