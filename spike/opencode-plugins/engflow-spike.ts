/**
 * EngFlow — OpenCode hook discovery (spike).
 *
 * Copy this file to:
 * - `~/.config/opencode/plugins/engflow-spike.ts` (global), or
 * - `<project>/.opencode/plugins/engflow-spike.ts` (project).
 *
 * OpenCode loads plugins at startup. Restart the TUI after adding or changing this file.
 *
 * Logging: every hook also appends one NDJSON line to:
 *   ~/.config/opencode/engflow-spike.log
 * (so you can `tail -f` in a second terminal while the TUI uses the first).
 * Plus `client.app.log` when available; otherwise stderr.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type PluginContext = {
  project?: unknown;
  directory?: string;
  worktree?: string;
  client?: {
    app?: {
      log: (args: { body: Record<string, unknown> }) => Promise<void>;
    };
  };
  $?: unknown;
};

const SERVICE = "engflow-spike";

const SPIKE_LOG = join(homedir(), ".config/opencode/engflow-spike.log");

async function appendFileLog(
  hook: string,
  payload: unknown,
  directory: string | undefined,
  worktree: string | undefined,
): Promise<void> {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: SERVICE,
    hook,
    directory,
    worktree,
    payload: safeSerialize(payload),
  });
  try {
    await mkdir(join(homedir(), ".config/opencode"), { recursive: true });
    await appendFile(SPIKE_LOG, `${line}\n`, "utf8");
  } catch (e) {
    console.error(`[${SERVICE}] failed to write ${SPIKE_LOG}`, e);
  }
}

/** Avoid circular refs and huge payloads breaking logging. */
function safeSerialize(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[MaxDepth]";
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  if (t === "bigint") return value.toString();
  if (t === "function") return `[Function ${(value as { name?: string }).name || "anonymous"}]`;
  if (Array.isArray(value)) {
    const max = 80;
    return value.slice(0, max).map((v) => safeSerialize(v, depth + 1));
  }
  if (t === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(o);
    const maxKeys = 60;
    for (let i = 0; i < keys.length && i < maxKeys; i++) {
      const k = keys[i]!;
      try {
        out[k] = safeSerialize(o[k], depth + 1);
      } catch {
        out[k] = "[unserializable]";
      }
    }
    if (keys.length > maxKeys) {
      out["..."] = `[${keys.length - maxKeys} more keys]`;
    }
    return out;
  }
  return String(value);
}

export const EngflowSpike = async (ctx: PluginContext) => {
  const log = async (hook: string, payload: unknown) => {
    await appendFileLog(hook, payload, ctx.directory, ctx.worktree);
    const body = {
      service: SERVICE,
      level: "info" as const,
      message: `${SERVICE}:${hook}`,
      hook,
      extra: { payload: safeSerialize(payload) },
    };
    try {
      if (ctx.client?.app?.log) {
        await ctx.client.app.log({ body });
      } else {
        console.error(`[${SERVICE}]`, JSON.stringify(body, null, 2));
      }
    } catch (e) {
      console.error(`[${SERVICE}] log failed for ${hook}`, e);
    }
  };

  const wrap =
    (hook: string) =>
    async (...args: unknown[]) => {
      try {
        await log(hook, { args, directory: ctx.directory, worktree: ctx.worktree });
      } catch (e) {
        console.error(`[${SERVICE}] handler error for ${hook}`, e);
      }
    };

  return {
    "tui.command.execute": wrap("tui.command.execute"),
    "tui.prompt.append": wrap("tui.prompt.append"),
    "message.updated": wrap("message.updated"),
    "session.updated": wrap("session.updated"),

    event: async (arg: unknown) => {
      try {
        await log("event", { arg, directory: ctx.directory, worktree: ctx.worktree });
      } catch (e) {
        console.error(`[${SERVICE}] handler error for event`, e);
      }
    },
  };
};
