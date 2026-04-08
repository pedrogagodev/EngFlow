import { describe, expect, test } from "bun:test";
import {
  CURSOR_BEFORE_SUBMIT_PROMPT_EVENT_TYPE,
  tryNormalizeCursorHookInput,
} from "./normalize.ts";
import fixture from "./fixtures/cursor-before-submit-prompt.json";

describe("tryNormalizeCursorHookInput", () => {
  test("maps beforeSubmitPrompt payload to NormalizedPromptEvent", () => {
    const result = tryNormalizeCursorHookInput(fixture);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.source).toBe("cursor");
    expect(result.event_type).toBe(CURSOR_BEFORE_SUBMIT_PROMPT_EVENT_TYPE);
    expect(result.session_id).toBe("sess-abc");
    expect(result.project_path).toBe("/home/dev/EngFlow");
    expect(result.prompt_text).toBe("Quero melhorar este prompt");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("returns null for non beforeSubmitPrompt events", () => {
    expect(
      tryNormalizeCursorHookInput({
        hook_event_name: "stop",
        prompt: "hello",
      }),
    ).toBeNull();
  });

  test("returns null when prompt is empty", () => {
    expect(
      tryNormalizeCursorHookInput({
        hook_event_name: CURSOR_BEFORE_SUBMIT_PROMPT_EVENT_TYPE,
        prompt: "   ",
      }),
    ).toBeNull();
  });

  test("falls back to conversation_id when session_id is missing", () => {
    const result = tryNormalizeCursorHookInput({
      hook_event_name: CURSOR_BEFORE_SUBMIT_PROMPT_EVENT_TYPE,
      prompt: "Use fallback session",
      conversation_id: "conv-fallback",
      workspace_roots: ["/tmp/proj"],
    });
    expect(result?.session_id).toBe("conv-fallback");
  });

  test("defaults project path when workspace roots are missing", () => {
    const result = tryNormalizeCursorHookInput({
      hook_event_name: CURSOR_BEFORE_SUBMIT_PROMPT_EVENT_TYPE,
      prompt: "No workspace roots",
      session_id: "s-1",
    });
    expect(result?.project_path).toContain(".config/Cursor");
  });
});
