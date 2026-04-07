/**
 * OpenCode plugin entry — copy or symlink to `~/.config/opencode/plugins/` (or project `.opencode/plugins/`).
 * Restart OpenCode after changes. Requires the EngFlow daemon listening on the same socket as
 * {@link resolveSocketPath} from `@engflow/contracts/socket-path` (see `ENGFLOW_SOCKET` / XDG).
 *
 * OpenCode loads plugins at startup; this export only handles the generic `event` channel.
 */

import { resolveSocketPath } from "@engflow/contracts/socket-path";
import { tryNormalizeOpenCodeEvent } from "./normalize.ts";
import { sendNdjsonToSocket } from "./send-line.ts";

type PluginContext = {
  directory?: string;
  worktree?: string;
  client?: {
    app?: {
      log: (args: { body: Record<string, unknown> }) => Promise<void>;
    };
  };
};

type Sender = (socketPath: string, payload: Parameters<typeof sendNdjsonToSocket>[1]) => void;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function extractEvent(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  if (isRecord(raw.event)) return raw.event;
  return raw;
}

function getMessageIdFromPartUpdated(eventObj: Record<string, unknown>): string | null {
  const properties = eventObj.properties;
  if (!isRecord(properties)) return null;
  const part = properties.part;
  if (!isRecord(part)) return null;
  const messageID = part.messageID;
  return typeof messageID === "string" && messageID.length > 0 ? messageID : null;
}

function getRoleFromPartUpdated(eventObj: Record<string, unknown>): string | null {
  const properties = eventObj.properties;
  if (!isRecord(properties)) return null;
  const part = properties.part;
  if (!isRecord(part)) return null;
  const role = part.role;
  return typeof role === "string" && role.length > 0 ? role : null;
}

function trackMessageRole(
  eventObj: Record<string, unknown>,
  roleByMessageId: Map<string, string>,
): void {
  if (eventObj.type !== "message.updated") return;
  const properties = eventObj.properties;
  if (!isRecord(properties)) return;
  const info = properties.info;
  if (!isRecord(info)) return;

  const id = info.id;
  const role = info.role;
  if (typeof id !== "string" || id.length === 0) return;
  if (typeof role !== "string" || role.length === 0) return;

  roleByMessageId.set(id, role);
}

export function createEventHandler(
  ctx: PluginContext,
  send: Sender = sendNdjsonToSocket,
): (arg: unknown) => Promise<void> {
  const socketPath = resolveSocketPath();
  const roleByMessageId = new Map<string, string>();

  return async (arg: unknown): Promise<void> => {
    try {
      const eventObj = extractEvent(arg);
      if (!eventObj) return;

      trackMessageRole(eventObj, roleByMessageId);

      if (eventObj.type !== "message.part.updated") return;

      const partRole = getRoleFromPartUpdated(eventObj);
      const messageId = getMessageIdFromPartUpdated(eventObj);
      const roleFromCache = messageId ? roleByMessageId.get(messageId) : undefined;
      const effectiveRole = partRole ?? roleFromCache;

      // Strict filter: only forward user-authored prompts.
      if (effectiveRole !== "user") return;

      const normalized = tryNormalizeOpenCodeEvent(arg, {
        directory: ctx.directory,
        worktree: ctx.worktree,
      });
      if (!normalized) return;

      send(socketPath, normalized);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        if (ctx.client?.app?.log) {
          await ctx.client.app.log({
            body: {
              service: "engflow",
              level: "error",
              message: "engflow:adapter",
              extra: { detail: msg },
            },
          });
        } else {
          console.error("[engflow]", msg);
        }
      } catch {
        console.error("[engflow]", msg);
      }
    }
  };
}

export const EngflowAdapter = async (ctx: PluginContext) => {
  const event = createEventHandler(ctx);
  return { event };
};
