import { EventEmitter } from "node:events";
import { createServer, type Socket } from "node:net";
import { unlink } from "node:fs/promises";
import type { NormalizedPromptEvent, WidgetFeedbackEvent } from "@engflow/contracts";
import { parseNormalizedPromptEvent } from "@engflow/contracts";

export type NdjsonSocketHandlers = {
  onValid: (event: NormalizedPromptEvent) => void;
  onSubscribeWidget?: () => void;
  onInvalid: (error: unknown, line: string) => void;
};

export type NdjsonSocketServer = {
  listen: () => Promise<void>;
  close: () => Promise<void>;
  broadcastWidgetFeedback: (event: WidgetFeedbackEvent) => void;
};

type Envelope = {
  type: string;
  payload: unknown;
};

export function startNdjsonSocketServer(options: {
  socketPath: string;
} & NdjsonSocketHandlers): NdjsonSocketServer {
  const widgetSubscribers = new Set<Socket>();
  const unsubscribeSocket = (socket: Socket): void => {
    widgetSubscribers.delete(socket);
  };

  const server = createServer((socket: Socket) => {
    socket.once("error", () => unsubscribeSocket(socket));
    socket.once("close", () => unsubscribeSocket(socket));

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
        if (!raw || typeof raw !== "object") {
          options.onInvalid(new Error("invalid envelope"), line);
          continue;
        }

        const envelope = raw as Partial<Envelope>;
        if (typeof envelope.type !== "string") {
          // Backward compatibility: accept legacy non-enveloped prompt_event payloads.
          const legacyParsed = parseNormalizedPromptEvent(raw);
          if (!legacyParsed.success) {
            options.onInvalid(new Error("missing envelope type"), line);
            continue;
          }
          options.onValid(legacyParsed.data);
          continue;
        }

        if (envelope.type === "subscribe_widget") {
          widgetSubscribers.add(socket);
          options.onSubscribeWidget?.();
          continue;
        }

        if (envelope.type !== "prompt_event") {
          options.onInvalid(
            new Error(`unknown envelope type: ${envelope.type}`),
            line,
          );
          continue;
        }

        const parsed = parseNormalizedPromptEvent(envelope.payload);
        if (!parsed.success) {
          options.onInvalid(parsed.error, line);
          continue;
        }
        options.onValid(parsed.data);
      }
    });
  });

  const broadcastWidgetFeedback = (event: WidgetFeedbackEvent): void => {
    const line = `${JSON.stringify({ type: "widget_feedback", payload: event })}\n`;
    for (const socket of widgetSubscribers) {
      socket.write(line, "utf8", (err) => {
        if (err) {
          unsubscribeSocket(socket);
          try {
            socket.destroy();
          } catch {
            /* ignore */
          }
        }
      });
    }
  };

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
      widgetSubscribers.clear();
      unlink(options.socketPath).catch(() => {});
    });

  return { listen, close, broadcastWidgetFeedback };
}
