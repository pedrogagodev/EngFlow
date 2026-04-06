import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { NormalizedPromptEvent } from "@engflow/contracts";
import { logStructured } from "./log.ts";
import { resolveSocketPath } from "./paths.ts";
import { startNdjsonSocketServer } from "./ndjson-socket.ts";

function classifyInvalid(error: unknown): { stage: string; detail: string } {
  if (error && typeof error === "object" && "issues" in error) {
    return { stage: "schema", detail: String(error) };
  }
  if (error instanceof Error) {
    return { stage: "json", detail: error.message };
  }
  return { stage: "unknown", detail: String(error) };
}

function stubPipeline(event: NormalizedPromptEvent): void {
  logStructured("info", "pipeline_stub", {
    event_type: event.event_type,
    session_id: event.session_id,
    source: event.source,
    prompt_preview: event.prompt_text.slice(0, 120),
  });
}

async function main(): Promise<void> {
  const socketPath = resolveSocketPath();
  await mkdir(dirname(socketPath), { recursive: true });

  const server = startNdjsonSocketServer({
    socketPath,
    onValid: (event) => {
      stubPipeline(event);
    },
    onInvalid: (error, line) => {
      const { stage, detail } = classifyInvalid(error);
      const linePreview =
        line.length > 500 ? `${line.slice(0, 500)}…` : line;
      logStructured("warn", "event_rejected", {
        stage,
        detail,
        line_preview: linePreview,
      });
    },
  });

  await server.listen();
  logStructured("info", "daemon_listening", { socket_path: socketPath });

  const shutdown = async (signal: string) => {
    logStructured("info", "shutdown", { signal });
    await server.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logStructured("error", "daemon_fatal", {
    detail: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
