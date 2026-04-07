import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sendNdjsonToSocketAsync } from "./send-line.ts";

describe("sendNdjsonToSocketAsync", () => {
  let socketPath: string;
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "engflow-adapter-"));
    socketPath = join(baseDir, "sock");
  });

  afterEach(() => {
    try {
      rmSync(baseDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test("writes one NDJSON line the server can read", async () => {
    const lines: string[] = [];
    let gotLine!: () => void;
    const linePromise = new Promise<void>((resolve) => {
      gotLine = resolve;
    });

    const server = createServer((socket) => {
      let buf = "";
      socket.on("data", (chunk) => {
        buf += String(chunk);
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const line of parts) {
          if (line.length) {
            lines.push(line);
            gotLine();
          }
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      const emitter = server as unknown as EventEmitter;
      emitter.once("error", reject);
      server.listen(socketPath, () => {
        emitter.off("error", reject);
        resolve();
      });
    });

    const payload = {
      event_type: "message.part.updated",
      source: "opencode",
      session_id: "s-test",
      project_path: "/tmp",
      prompt_text: "integration",
      timestamp: "2026-04-06T12:00:00.000Z",
    };

    await Promise.all([
      sendNdjsonToSocketAsync(socketPath, payload),
      linePromise,
    ]);

    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(lines.length).toBe(1);
    expect(JSON.parse(lines[0]!)).toEqual(payload);
  });
});
