import type { AgentContext } from "@/types/agent";

const STORAGE_KEY = "agent_context";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getAgentContext(): AgentContext | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const ctx: AgentContext = JSON.parse(raw);

    // Check TTL
    if (Date.now() - ctx.timestamp > TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return ctx;
  } catch {
    return null;
  }
}

export function setAgentContext(ctx: AgentContext): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

export function clearAgentContext(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
