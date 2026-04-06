import { describe, expect, test } from "bun:test";
import { promptFeedbackSchema } from "@engflow/contracts";
import { neutralFallbackFeedback } from "./fallback.ts";
import { parsePromptFeedbackOutput } from "./parse-feedback.ts";

describe("neutralFallbackFeedback", () => {
  test("is valid PromptFeedback", () => {
    const r = promptFeedbackSchema.safeParse(neutralFallbackFeedback());
    expect(r.success).toBe(true);
  });
});

describe("parsePromptFeedbackOutput", () => {
  test("accepts valid object", () => {
    const out = parsePromptFeedbackOutput({
      state: "correct",
      fragment_before: "",
      fragment_after: "",
      tip: "Looks good",
      category: "none",
    });
    expect(out.state).toBe("correct");
  });

  test("accepts valid JSON string", () => {
    const out = parsePromptFeedbackOutput(
      JSON.stringify({
        state: "strong_issue",
        fragment_before: "a",
        fragment_after: "b",
        tip: "t",
        category: "grammar",
      }),
    );
    expect(out.state).toBe("strong_issue");
  });

  test("returns fallback on invalid JSON string", () => {
    const out = parsePromptFeedbackOutput("{");
    expect(out).toEqual(neutralFallbackFeedback());
  });

  test("returns fallback on schema mismatch", () => {
    const out = parsePromptFeedbackOutput({ state: "nope" });
    expect(out).toEqual(neutralFallbackFeedback());
  });
});
