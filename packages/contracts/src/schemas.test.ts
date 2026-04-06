import { describe, expect, test } from "bun:test";
import {
  feedbackStateSchema,
  parseNormalizedPromptEvent,
  promptFeedbackSchema,
  widgetFeedbackEventSchema,
} from "./schemas.ts";

const validEvent = {
  event_type: "prompt_submitted",
  source: "opencode",
  session_id: "sess-1",
  project_path: "/home/user/proj",
  prompt_text: "Fix the bug",
  timestamp: "2026-04-06T12:00:00.000Z",
};

describe("NormalizedPromptEvent", () => {
  test("accepts a valid payload", () => {
    const r = parseNormalizedPromptEvent(validEvent);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prompt_text).toBe("Fix the bug");
  });

  test("rejects missing field", () => {
    const bad = { ...validEvent };
    delete (bad as Record<string, unknown>)["prompt_text"];
    const r = parseNormalizedPromptEvent(bad);
    expect(r.success).toBe(false);
  });
});

describe("PromptFeedback", () => {
  test("accepts valid feedback", () => {
    const r = promptFeedbackSchema.safeParse({
      state: "small_issue",
      fragment_before: "I need learn",
      fragment_after: "I need to learn",
      tip: "Use infinitive after need.",
      category: "grammar",
    });
    expect(r.success).toBe(true);
  });
});

describe("WidgetFeedbackEvent", () => {
  test("accepts valid widget payload", () => {
    const r = widgetFeedbackEventSchema.safeParse({
      state: "correct",
      display_text: "Looks good",
      tip: "",
      category: "none",
      can_pin: true,
      auto_open: true,
    });
    expect(r.success).toBe(true);
  });
});

describe("feedbackStateSchema", () => {
  test("rejects unknown state", () => {
    const r = feedbackStateSchema.safeParse("nope");
    expect(r.success).toBe(false);
  });
});
