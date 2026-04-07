import { describe, expect, test } from "bun:test";
import {
  OPENCODE_USER_PROMPT_EVENT_TYPE,
  tryNormalizeOpenCodeEvent,
} from "./normalize.ts";

import assistantFixture from "./fixtures/opencode-assistant-text.json";
import deltaFixture from "./fixtures/opencode-delta-event.json";
import reasoningFixture from "./fixtures/opencode-reasoning-part.json";
import userFixture from "./fixtures/opencode-user-prompt.json";

describe("tryNormalizeOpenCodeEvent", () => {
  test("maps user text part.updated fixture to NormalizedPromptEvent", () => {
    const r = tryNormalizeOpenCodeEvent(userFixture, {
      directory: "/home/dev/project",
    });
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.source).toBe("opencode");
    expect(r.event_type).toBe(OPENCODE_USER_PROMPT_EVENT_TYPE);
    expect(r.session_id).toBe("sess-fixture-1");
    expect(r.project_path).toBe("/home/dev/project");
    expect(r.prompt_text).toBe("Please review this implementation.");
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("uses directory from context over default", () => {
    const r = tryNormalizeOpenCodeEvent(userFixture, {
      directory: "/tmp/repo",
    });
    expect(r?.project_path).toBe("/tmp/repo");
  });

  test("returns null for reasoning part", () => {
    expect(tryNormalizeOpenCodeEvent(reasoningFixture, {})).toBeNull();
  });

  test("returns null for message.part.delta", () => {
    expect(tryNormalizeOpenCodeEvent(deltaFixture, {})).toBeNull();
  });

  test("returns null for assistant text role", () => {
    expect(tryNormalizeOpenCodeEvent(assistantFixture, {})).toBeNull();
  });

  test("returns null for non-objects", () => {
    expect(tryNormalizeOpenCodeEvent(null, {})).toBeNull();
    expect(tryNormalizeOpenCodeEvent("x", {})).toBeNull();
    expect(tryNormalizeOpenCodeEvent(42, {})).toBeNull();
  });

  test("returns null when part text is empty", () => {
    const raw = {
      event: {
        type: OPENCODE_USER_PROMPT_EVENT_TYPE,
        properties: {
          sessionID: "s",
          part: { type: "text", text: "   " },
        },
      },
    };
    expect(tryNormalizeOpenCodeEvent(raw, {})).toBeNull();
  });

  test("accepts event fields at root without event wrapper", () => {
    const raw = {
      type: OPENCODE_USER_PROMPT_EVENT_TYPE,
      properties: {
        sessionID: "root-sess",
        part: { type: "text", text: "Hello" },
      },
    };
    const r = tryNormalizeOpenCodeEvent(raw, { directory: "/proj" });
    expect(r?.session_id).toBe("root-sess");
    expect(r?.prompt_text).toBe("Hello");
    expect(r?.project_path).toBe("/proj");
  });

  test("defaults session_id when missing", () => {
    const raw = {
      type: OPENCODE_USER_PROMPT_EVENT_TYPE,
      properties: {
        part: { type: "text", text: "Hi" },
      },
    };
    const r = tryNormalizeOpenCodeEvent(raw, {});
    expect(r?.session_id).toBe("unknown-session");
  });
});
