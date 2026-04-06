import type { NormalizedPromptEvent, PromptFeedback } from "@engflow/contracts";
import OpenAI from "openai";
import type { CorrectionEngine } from "./correction-engine.ts";
import { neutralFallbackFeedback } from "./fallback.ts";
import { parsePromptFeedbackOutput } from "./parse-feedback.ts";

const SYSTEM = `You are an English writing assistant for developers using AI coding tools.
Analyze the user's prompt text for grammar, clarity, and natural phrasing.
Respond with a single JSON object only (no markdown), with keys:
- state: one of "correct" | "small_issue" | "strong_issue" (match severity to the PRD: correct = acceptable; small_issue = minor fix; strong_issue = clearly wrong or confusing)
- fragment_before: shortest substring of the prompt that needs changing, or empty if correct
- fragment_after: the improved fragment, or empty if correct or if there is no single replacement
- tip: one short sentence explaining the main point
- category: short label like "grammar", "clarity", "word_choice", "none"

Prefer "correct" when the prompt is good enough for real use; avoid nitpicking naturalness alone.`;

export type OpenAICorrectionEngineOptions = {
  apiKey: string;
  /** @default "gpt-4o-mini" */
  model?: string;
  /** Injected for tests */
  fetch?: typeof fetch;
};

export class OpenAICorrectionEngine implements CorrectionEngine {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAICorrectionEngineOptions) {
    this.model = options.model ?? "gpt-4o-mini";
    this.client = new OpenAI({
      apiKey: options.apiKey,
      fetch: options.fetch,
    });
  }

  async correct(event: NormalizedPromptEvent): Promise<PromptFeedback> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Prompt to analyze:\n${event.prompt_text}`,
          },
        ],
      });
      const text = completion.choices[0]?.message?.content;
      if (text == null || text === "") {
        return neutralFallbackFeedback();
      }
      return parsePromptFeedbackOutput(text);
    } catch {
      return neutralFallbackFeedback();
    }
  }
}

/** Engine that skips the network (missing or empty API key). */
export class NoOpCorrectionEngine implements CorrectionEngine {
  async correct(_event: NormalizedPromptEvent): Promise<PromptFeedback> {
    return neutralFallbackFeedback();
  }
}

export function createDefaultCorrectionEngine(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): CorrectionEngine {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) {
    return new NoOpCorrectionEngine();
  }
  return new OpenAICorrectionEngine({ apiKey: key });
}
