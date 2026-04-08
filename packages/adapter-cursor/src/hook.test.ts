import { describe, expect, test } from "bun:test";
import { handleCursorHookPayload } from "./hook.ts";

describe("handleCursorHookPayload", () => {
  test("sends normalized payload when hook input is valid", () => {
    const sent: unknown[] = [];
    const payload = {
      hook_event_name: "beforeSubmitPrompt",
      prompt: "Analisa este prompt",
      session_id: "sess-1",
      workspace_roots: ["/tmp/repo"],
    };

    const result = handleCursorHookPayload(JSON.stringify(payload), (_socket, p) => {
      sent.push(p);
    });

    expect(result).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      source: "cursor",
      session_id: "sess-1",
      project_path: "/tmp/repo",
      prompt_text: "Analisa este prompt",
    });
  });

  test("returns false for invalid json", () => {
    const result = handleCursorHookPayload("{broken json}");
    expect(result).toBe(false);
  });

  test("returns false when payload is not a supported hook event", () => {
    const payload = {
      hook_event_name: "stop",
      prompt: "ignored",
      session_id: "sess-1",
    };
    const sent: unknown[] = [];
    const result = handleCursorHookPayload(JSON.stringify(payload), (_socket, p) => {
      sent.push(p);
    });
    expect(result).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
