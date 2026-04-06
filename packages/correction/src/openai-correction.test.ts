import { describe, expect, mock, test } from "bun:test";
import type { NormalizedPromptEvent } from "@engflow/contracts";
import {
  NoOpCorrectionEngine,
  OpenAICorrectionEngine,
  createDefaultCorrectionEngine,
} from "./openai-correction.ts";
import { neutralFallbackFeedback } from "./fallback.ts";

const sampleEvent: NormalizedPromptEvent = {
  event_type: "prompt_submitted",
  source: "test",
  session_id: "s1",
  project_path: "/tmp",
  prompt_text: "Fix the typo",
  timestamp: "2026-04-06T12:00:00.000Z",
};

describe("NoOpCorrectionEngine", () => {
  test("returns neutral fallback", async () => {
    const engine = new NoOpCorrectionEngine();
    const out = await engine.correct(sampleEvent);
    expect(out).toEqual(neutralFallbackFeedback());
  });
});

describe("createDefaultCorrectionEngine", () => {
  test("uses NoOp when OPENAI_API_KEY is missing", () => {
    const engine = createDefaultCorrectionEngine({});
    expect(engine).toBeInstanceOf(NoOpCorrectionEngine);
  });

  test("uses OpenAI when key is set", () => {
    const engine = createDefaultCorrectionEngine({
      OPENAI_API_KEY: "sk-test",
    });
    expect(engine).toBeInstanceOf(OpenAICorrectionEngine);
  });
});

describe("OpenAICorrectionEngine", () => {
  test("maps API JSON response to PromptFeedback", async () => {
    const body = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              state: "correct",
              fragment_before: "",
              fragment_after: "",
              tip: "No issues",
              category: "none",
            }),
          },
        },
      ],
    };
    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const engine = new OpenAICorrectionEngine({
      apiKey: "sk-test",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const out = await engine.correct(sampleEvent);
    expect(out.state).toBe("correct");
    expect(out.tip).toBe("No issues");
    expect(fetchMock).toHaveBeenCalled();
  });

  test("returns fallback on HTTP error", async () => {
    const fetchMock = mock(
      async () =>
        new Response("err", {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const engine = new OpenAICorrectionEngine({
      apiKey: "sk-test",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const out = await engine.correct(sampleEvent);
    expect(out).toEqual(neutralFallbackFeedback());
  });
});
