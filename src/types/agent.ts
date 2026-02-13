// Types for the vocal agent system

export type Intent = "dictation" | "readback" | "correction" | "devis" | "info";

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entity: string | null; // e.g. "chambre 1", piece name, etc.
  reasoning: string;
}

export interface AgentResponse {
  success: boolean;
  intent: Intent;
  action: string; // short description of what was done
  message: string; // message to show the user
  tts?: string; // text to read aloud (may differ from message)
  data?: Record<string, unknown>; // any extra data (transcription_id, devis, etc.)
  context?: AgentContext; // updated context for next turn
}

export interface AgentContext {
  lastIntent: Intent | null;
  lastEntity: string | null;
  lastTranscription: string | null;
  timestamp: number;
  dossierId: string | null;
}
