import { EventEmitter } from "node:events";
import { createServer, type Socket } from "node:net";
import { unlink } from "node:fs/promises";
import type { NormalizedPromptEvent } from "@engflow/contracts";
import { parseNormalizedPromptEvent } from "@engflow/contracts";

export type NdjsonSocketHandlers = {
  onValid: (event: NormalizedPromptEvent) => void;
  onInvalid: (error: unknown, line: string) => void;
};

export type NdjsonSocketServer = {
  listen: () => Promise<void>;
  close: () => Promise<void>;
};

export function startNdjsonSocketServer(options: {
  socketPath: string;
} & NdjsonSocketHandlers): NdjsonSocketServer {
  const server = createServer((socket: Socket) => {
    let buffer = "";
    socket.on("data", (chunk: Buffer | string) => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (line.length === 0) continue;
        let raw: unknown;
        try {
          raw = JSON.parse(line) as unknown;
        } catch (e) {
          options.onInvalid(e, line);
          continue;
        }
        const parsed = parseNormalizedPromptEvent(raw);
        if (!parsed.success) {
          options.onInvalid(parsed.error, line);
          continue;
        }
        options.onValid(parsed.data);
      }
    });
  });

  const listen = () =>
    new Promise<void>((resolve, reject) => {
      const emitter = server as unknown as EventEmitter;
      emitter.once("error", reject);
      server.listen(options.socketPath, () => {
        emitter.off("error", reject);
        resolve();
      });
    });

  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      unlink(options.socketPath).catch(() => {});
    });

  return { listen, close };
}
