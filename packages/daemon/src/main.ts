import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { NormalizedPromptEvent } from "@engflow/contracts";
import { resolveSocketPath } from "@engflow/contracts/socket-path";
import { createDefaultCorrectionEngine } from "@engflow/correction";
import { logStructured } from "./log.ts";
import { startNdjsonSocketServer } from "./ndjson-socket.ts";

const correctionEngine = createDefaultCorrectionEngine();

function classifyInvalid(error: unknown): { stage: string; detail: string } {
  if (error && typeof error === "object" && "issues" in error) {
    return { stage: "schema", detail: String(error) };
  }
  if (error instanceof Error) {
    return { stage: "json", detail: error.message };
  }
  return { stage: "unknown", detail: String(error) };
}

function runCorrectionPipeline(event: NormalizedPromptEvent): void {
  logStructured("info", "correction_queued", {
    event_type: event.event_type,
    session_id: event.session_id,
    source: event.source,
    prompt_preview: event.prompt_text.slice(0, 120),
  });
  void correctionEngine.correct(event).then(
    (feedback) => {
      logStructured("info", "correction_result", {
        event_type: event.event_type,
        session_id: event.session_id,
        state: feedback.state,
        category: feedback.category,
        tip_preview: feedback.tip.slice(0, 200),
      });
    },
    (err: unknown) => {
      logStructured("error", "correction_unexpected_rejection", {
        detail: err instanceof Error ? err.message : String(err),
      });
    },
  );
}

async function main(): Promise<void> {
  const socketPath = resolveSocketPath();
  await mkdir(dirname(socketPath), { recursive: true });

  const server = startNdjsonSocketServer({
    socketPath,
    onValid: (event) => {
      runCorrectionPipeline(event);
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
