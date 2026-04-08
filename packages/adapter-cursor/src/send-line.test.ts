import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sendNdjsonToSocketAsync } from "./send-line.ts";

describe("sendNdjsonToSocketAsync", () => {
  let socketPath: string;
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "engflow-cursor-adapter-"));
    socketPath = join(baseDir, "sock");
  });

  afterEach(() => {
    try {
      rmSync(baseDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test("writes one NDJSON prompt_event envelope", async () => {
    const lines: string[] = [];
    let gotLine!: () => void;
    const linePromise = new Promise<void>((resolve) => {
      gotLine = resolve;
    });

    const server = createServer((socket) => {
      let buffer = "";
      socket.on("data", (chunk) => {
        buffer += String(chunk);
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          if (!line) continue;
          lines.push(line);
          gotLine();
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
      event_type: "beforeSubmitPrompt",
      source: "cursor",
      session_id: "s-test",
      project_path: "/tmp",
      prompt_text: "integration",
      timestamp: "2026-04-08T12:00:00.000Z",
    };

    await Promise.all([
      sendNdjsonToSocketAsync(socketPath, payload),
      linePromise,
    ]);

    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      type: "prompt_event",
      payload,
    });
  });

  test("resolves when socket is unavailable", async () => {
    const payload = {
      event_type: "beforeSubmitPrompt",
      source: "cursor",
      session_id: "s-test",
      project_path: "/tmp",
      prompt_text: "integration",
      timestamp: "2026-04-08T12:00:00.000Z",
    };

    await expect(
      sendNdjsonToSocketAsync(join(baseDir, "missing.sock"), payload),
    ).resolves.toBeUndefined();
  });
});
