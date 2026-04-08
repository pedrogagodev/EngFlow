import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { connect } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { WidgetFeedbackEvent } from "@engflow/contracts";
import { startNdjsonSocketServer } from "./ndjson-socket.ts";

describe("startNdjsonSocketServer", () => {
  let socketPath: string;
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "engflow-daemon-"));
    socketPath = join(baseDir, "test.sock");
  });

  afterEach(() => {
    try {
      rmSync(baseDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  function sendLine(line: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const c = connect(socketPath, () => {
        c.write(line.endsWith("\n") ? line : `${line}\n`, () => {
          c.end();
          resolve();
        });
      });
      c.on("error", reject);
    });
  }

  function connectClient(): Promise<import("node:net").Socket> {
    return new Promise((resolve, reject) => {
      const c = connect(socketPath, () => resolve(c));
      c.on("error", reject);
    });
  }

  test("calls onValid for one valid prompt_event envelope", async () => {
    const valids: string[] = [];
    const invalids: number[] = [];
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: (e) => valids.push(e.prompt_text),
      onInvalid: () => invalids.push(1),
    });
    await s.listen();
    await sendLine(
      JSON.stringify({
        type: "prompt_event",
        payload: {
          event_type: "prompt_submitted",
          source: "opencode",
          session_id: "s1",
          project_path: "/p",
          prompt_text: "hello",
          timestamp: "2026-04-06T12:00:00.000Z",
        },
      }),
    );
    await s.close();
    expect(valids).toEqual(["hello"]);
    expect(invalids).toEqual([]);
  });

  test("accepts legacy prompt payload without envelope", async () => {
    const valids: string[] = [];
    let invalid = 0;
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: (e) => valids.push(e.prompt_text),
      onInvalid: () => {
        invalid += 1;
      },
    });
    await s.listen();
    await sendLine(
      JSON.stringify({
        event_type: "prompt_submitted",
        source: "opencode",
        session_id: "s1",
        project_path: "/p",
        prompt_text: "legacy still works",
        timestamp: "2026-04-06T12:00:00.000Z",
      }),
    );
    await s.close();
    expect(valids).toEqual(["legacy still works"]);
    expect(invalid).toBe(0);
  });

  test("calls onInvalid for invalid JSON and keeps server usable", async () => {
    let invalid = 0;
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: () => {},
      onInvalid: () => {
        invalid += 1;
      },
    });
    await s.listen();
    await sendLine("not-json{{{");
    await sendLine(
      JSON.stringify({
        type: "prompt_event",
        payload: {
          event_type: "prompt_submitted",
          source: "opencode",
          session_id: "s1",
          project_path: "/p",
          prompt_text: "second",
          timestamp: "2026-04-06T12:00:00.000Z",
        },
      }),
    );
    await s.close();
    expect(invalid).toBe(1);
  });

  test("calls onInvalid for JSON that fails Zod", async () => {
    let invalid = 0;
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: () => {},
      onInvalid: () => {
        invalid += 1;
      },
    });
    await s.listen();
    await sendLine(
      JSON.stringify({
        type: "prompt_event",
        payload: { foo: 1 },
      }),
    );
    await s.close();
    expect(invalid).toBe(1);
  });

  test("reports unknown envelope type without stopping server", async () => {
    let invalid = 0;
    const valids: string[] = [];
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: (e) => valids.push(e.prompt_text),
      onInvalid: () => {
        invalid += 1;
      },
    });
    await s.listen();
    await sendLine(
      JSON.stringify({
        type: "noop",
        payload: {},
      }),
    );
    await sendLine(
      JSON.stringify({
        type: "prompt_event",
        payload: {
          event_type: "prompt_submitted",
          source: "opencode",
          session_id: "s1",
          project_path: "/p",
          prompt_text: "still works",
          timestamp: "2026-04-06T12:00:00.000Z",
        },
      }),
    );
    await s.close();
    expect(invalid).toBe(1);
    expect(valids).toEqual(["still works"]);
  });

  test("subscribed widget client receives widget_feedback broadcast", async () => {
    let subscribed!: () => void;
    const subscribedPromise = new Promise<void>((resolve) => {
      subscribed = resolve;
    });
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: () => {},
      onInvalid: () => {},
      onSubscribeWidget: () => subscribed(),
    });
    await s.listen();

    const client = await connectClient();
    let buffer = "";
    let received!: (line: string) => void;
    const linePromise = new Promise<string>((resolve) => {
      received = resolve;
    });

    client.on("data", (chunk) => {
      buffer += String(chunk);
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (line.length > 0) received(line);
      }
    });

    client.write(`${JSON.stringify({ type: "subscribe_widget", payload: {} })}\n`);
    await subscribedPromise;

    const payload: WidgetFeedbackEvent = {
      state: "small_issue",
      display_text: "I need learn -> I need to learn",
      tip: "Use to + verb.",
      category: "grammar",
      can_pin: true,
      auto_open: true,
    };
    s.broadcastWidgetFeedback(payload);

    const line = await linePromise;
    client.end();
    await s.close();

    expect(JSON.parse(line)).toEqual({
      type: "widget_feedback",
      payload,
    });
  });

  test("removes disconnected subscribers and continues broadcasting", async () => {
    let subscribedCount = 0;
    let resolveSecondSubscribe!: () => void;
    const secondSubscribePromise = new Promise<void>((resolve) => {
      resolveSecondSubscribe = resolve;
    });
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: () => {},
      onInvalid: () => {},
      onSubscribeWidget: () => {
        subscribedCount += 1;
        if (subscribedCount === 2) {
          resolveSecondSubscribe();
        }
      },
    });
    await s.listen();

    const disconnectedClient = await connectClient();
    const disconnectedClosedPromise = new Promise<void>((resolve) => {
      disconnectedClient.once("close", () => resolve());
    });
    disconnectedClient.write(
      `${JSON.stringify({ type: "subscribe_widget", payload: {} })}\n`,
    );
    disconnectedClient.end();
    await disconnectedClosedPromise;

    const activeClient = await connectClient();
    let buffer = "";
    let resolveLine!: (line: string) => void;
    const linePromise = new Promise<string>((resolve) => {
      resolveLine = resolve;
    });

    activeClient.on("data", (chunk) => {
      buffer += String(chunk);
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (line.length > 0) resolveLine(line);
      }
    });
    activeClient.write(
      `${JSON.stringify({ type: "subscribe_widget", payload: {} })}\n`,
    );
    await secondSubscribePromise;

    const payload: WidgetFeedbackEvent = {
      state: "strong_issue",
      display_text: "bad -> good",
      tip: "tip",
      category: "grammar",
      can_pin: true,
      auto_open: true,
    };
    s.broadcastWidgetFeedback(payload);

    const line = await linePromise;
    activeClient.end();
    await s.close();

    expect(JSON.parse(line)).toEqual({
      type: "widget_feedback",
      payload,
    });
  });
});
