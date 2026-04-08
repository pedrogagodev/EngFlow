import { homedir } from "node:os";
import type { NormalizedPromptEvent } from "@engflow/contracts";
import { parseNormalizedPromptEvent } from "@engflow/contracts";

export const CURSOR_BEFORE_SUBMIT_PROMPT_EVENT_TYPE = "beforeSubmitPrompt";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function firstString(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function firstWorkspaceRoot(input: Record<string, unknown>): string | undefined {
  const roots = input.workspace_roots;
  if (!Array.isArray(roots)) return undefined;
  const first = roots[0];
  if (typeof first !== "string") return undefined;
  const trimmed = first.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveProjectPath(input: Record<string, unknown>): string {
  return (
    firstWorkspaceRoot(input) ??
    firstString(input, ["workspace_root", "workspaceRoot", "cwd"]) ??
    `${homedir()}/.config/Cursor`
  );
}

function resolveSessionId(input: Record<string, unknown>): string {
  return (
    firstString(input, [
      "session_id",
      "sessionId",
      "conversation_id",
      "conversationId",
      "generation_id",
      "generationId",
    ]) ?? "unknown-session"
  );
}

/**
 * Converts Cursor hook payload (`beforeSubmitPrompt`) into NormalizedPromptEvent.
 */
export function tryNormalizeCursorHookInput(
  raw: unknown,
): NormalizedPromptEvent | null {
  if (!isRecord(raw)) return null;
  const hookEventName = raw.hook_event_name;
  if (hookEventName !== CURSOR_BEFORE_SUBMIT_PROMPT_EVENT_TYPE) return null;

  const prompt = raw.prompt;
  if (typeof prompt !== "string") return null;
  const promptText = prompt.trim();
  if (promptText.length === 0) return null;

  const candidate: NormalizedPromptEvent = {
    event_type: CURSOR_BEFORE_SUBMIT_PROMPT_EVENT_TYPE,
    source: "cursor",
    session_id: resolveSessionId(raw),
    project_path: resolveProjectPath(raw),
    prompt_text: promptText,
    timestamp: new Date().toISOString(),
  };

  const parsed = parseNormalizedPromptEvent(candidate);
  if (!parsed.success) return null;
  return parsed.data;
}
