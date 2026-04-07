import { describe, expect, test } from "bun:test";
import { createEventHandler } from "./plugin.ts";

describe("createEventHandler", () => {
  test("forwards user prompt when role comes from message.updated cache", async () => {
    const sent: unknown[] = [];
    const handler = createEventHandler(
      { directory: "/tmp/proj" },
      (_socketPath, payload) => sent.push(payload),
    );

    await handler({
      event: {
        type: "message.updated",
        properties: {
          info: { id: "msg-user-1", role: "user" },
        },
      },
    });

    await handler({
      event: {
        type: "message.part.updated",
        properties: {
          sessionID: "ses-1",
          part: {
            type: "text",
            text: "need learn Rust",
            messageID: "msg-user-1",
          },
        },
      },
    });

    expect(sent).toHaveLength(1);
  });

  test("does not forward assistant response inferred from cache", async () => {
    const sent: unknown[] = [];
    const handler = createEventHandler(
      { directory: "/tmp/proj" },
      (_socketPath, payload) => sent.push(payload),
    );

    await handler({
      event: {
        type: "message.updated",
        properties: {
          info: { id: "msg-assistant-1", role: "assistant" },
        },
      },
    });

    await handler({
      event: {
        type: "message.part.updated",
        properties: {
          sessionID: "ses-1",
          part: {
            type: "text",
            text: "Here are the best resources...",
            messageID: "msg-assistant-1",
          },
        },
      },
    });

    expect(sent).toHaveLength(0);
  });

  test("forwards when part.role is explicitly user", async () => {
    const sent: unknown[] = [];
    const handler = createEventHandler(
      { directory: "/tmp/proj" },
      (_socketPath, payload) => sent.push(payload),
    );

    await handler({
      event: {
        type: "message.part.updated",
        properties: {
          sessionID: "ses-1",
          part: {
            type: "text",
            role: "user",
            text: "Write tests",
            messageID: "msg-user-2",
          },
        },
      },
    });

    expect(sent).toHaveLength(1);
  });

  test("drops event when role cannot be resolved", async () => {
    const sent: unknown[] = [];
    const handler = createEventHandler(
      { directory: "/tmp/proj" },
      (_socketPath, payload) => sent.push(payload),
    );

    await handler({
      event: {
        type: "message.part.updated",
        properties: {
          sessionID: "ses-1",
          part: {
            type: "text",
            text: "Ambiguous role",
            messageID: "msg-unknown",
          },
        },
      },
    });

    expect(sent).toHaveLength(0);
  });
});
