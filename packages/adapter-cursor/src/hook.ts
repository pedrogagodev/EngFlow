import { readFileSync } from "node:fs";
import { resolveSocketPath } from "@engflow/contracts/socket-path";
import { sendNdjsonToSocket } from "./send-line.ts";
import { tryNormalizeCursorHookInput } from "./normalize.ts";

export type CursorHookSender = (
  socketPath: string,
  payload: Parameters<typeof sendNdjsonToSocket>[1],
) => void;

/**
 * Handles one Cursor hook payload JSON string.
 * Returns true when a prompt event was normalized and sent.
 */
export function handleCursorHookPayload(
  payloadText: string,
  send: CursorHookSender = sendNdjsonToSocket,
): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadText);
  } catch {
    return false;
  }

  const normalized = tryNormalizeCursorHookInput(parsed);
  if (!normalized) return false;

  send(resolveSocketPath(), normalized);
  return true;
}

/**
 * Reads hook input from stdin (fd 0) and forwards prompt events to the daemon.
 * Never throws: hook execution should not block Cursor flow.
 */
export function runFromStdin(
  send: CursorHookSender = sendNdjsonToSocket,
): boolean {
  try {
    const text = readFileSync(0, "utf8");
    return handleCursorHookPayload(text, send);
  } catch {
    return false;
  }
}
