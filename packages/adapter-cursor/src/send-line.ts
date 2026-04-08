import { createConnection } from "node:net";
import type { NormalizedPromptEvent } from "@engflow/contracts";

/**
 * Writes one NDJSON line to the EngFlow daemon UNIX socket.
 * Errors are swallowed so hook execution never blocks Cursor prompt submission.
 */
export function sendNdjsonToSocket(
  socketPath: string,
  payload: NormalizedPromptEvent,
): void {
  const line = `${JSON.stringify({ type: "prompt_event", payload })}\n`;
  const client = createConnection(socketPath);

  const onError = (): void => {
    try {
      client.destroy();
    } catch {
      /* ignore */
    }
  };

  client.once("error", onError);
  client.once("connect", () => {
    client.write(line, "utf8", (err) => {
      if (err) onError();
      else client.end();
    });
  });
}

/**
 * Promise-based variant useful for tests.
 */
export function sendNdjsonToSocketAsync(
  socketPath: string,
  payload: NormalizedPromptEvent,
): Promise<void> {
  return new Promise((resolve) => {
    const line = `${JSON.stringify({ type: "prompt_event", payload })}\n`;
    const client = createConnection(socketPath);
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      try {
        client.destroy();
      } catch {
        /* ignore */
      }
      resolve();
    };

    client.once("error", finish);
    client.once("connect", () => {
      client.write(line, "utf8", (err) => {
        if (err) finish();
        else client.end();
      });
    });
    client.once("close", finish);
  });
}
