import { homedir } from "node:os";
import type { NormalizedPromptEvent } from "@engflow/contracts";
import { parseNormalizedPromptEvent } from "@engflow/contracts";

/** OpenCode ~1.3.x — user prompt finalized as text part (see docs/plans initial-setup 3.1). */
export const OPENCODE_USER_PROMPT_EVENT_TYPE = "message.part.updated";

export type OpenCodeNormalizeContext = {
  /** Session / project directory from the plugin context (may be ~/.config/opencode for global). */
  directory?: string;
  worktree?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function getNestedEvent(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  if (isRecord(raw.event)) return raw.event;
  return raw;
}

function firstString(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function resolveProjectPath(
  properties: Record<string, unknown>,
  ctx: OpenCodeNormalizeContext,
): string {
  const fromCtx = ctx.directory ?? ctx.worktree;
  if (fromCtx && fromCtx.trim().length > 0) return fromCtx.trim();
  const fromEvent = firstString(properties, ["directory", "projectPath", "cwd"]);
  if (fromEvent) return fromEvent;
  return `${homedir()}/.config/opencode`;
}

function resolveSessionId(properties: Record<string, unknown>): string {
  return (
    firstString(properties, [
      "sessionID",
      "sessionId",
      "session_id",
      "SessionID",
    ]) ?? "unknown-session"
  );
}

/**
 * Maps an OpenCode `event` hook payload to {@link NormalizedPromptEvent}, or `null` if
 * this is not a finalized user text prompt (delta, reasoning, assistant, incomplete, etc.).
 */
export function tryNormalizeOpenCodeEvent(
  raw: unknown,
  ctx: OpenCodeNormalizeContext = {},
): NormalizedPromptEvent | null {
  const eventObj = getNestedEvent(raw);
  if (!eventObj) return null;

  const type = eventObj.type;
  if (type !== OPENCODE_USER_PROMPT_EVENT_TYPE) return null;

  const properties = eventObj.properties;
  if (!isRecord(properties)) return null;

  const part = properties.part;
  if (!isRecord(part)) return null;

  const partType = part.type;
  if (partType !== "text") return null;

  const role = part.role;
  if (role === "assistant" || role === "tool") return null;

  const text = part.text;
  if (typeof text !== "string") return null;
  const promptText = text.trim();
  if (promptText.length === 0) return null;

  const timestamp = new Date().toISOString();
  const sessionId = resolveSessionId(properties);
  const projectPath = resolveProjectPath(properties, ctx);

  const candidate: NormalizedPromptEvent = {
    event_type: OPENCODE_USER_PROMPT_EVENT_TYPE,
    source: "opencode",
    session_id: sessionId,
    project_path: projectPath,
    prompt_text: promptText,
    timestamp,
  };

  const parsed = parseNormalizedPromptEvent(candidate);
  if (!parsed.success) return null;
  return parsed.data;
}
