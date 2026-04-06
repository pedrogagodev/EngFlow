import { promptFeedbackSchema, type PromptFeedback } from "@engflow/contracts";
import { neutralFallbackFeedback } from "./fallback.ts";

/**
 * Parses model JSON (object or JSON string) into {@link PromptFeedback}.
 * On any failure returns {@link neutralFallbackFeedback}.
 */
export function parsePromptFeedbackOutput(raw: unknown): PromptFeedback {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return neutralFallbackFeedback();
    }
  }
  const parsed = promptFeedbackSchema.safeParse(value);
  return parsed.success ? parsed.data : neutralFallbackFeedback();
}
