import type { PromptFeedback } from "@engflow/contracts";

/** Stable payload when the model or API fails — PRD “neutral fallback” path. */
export function neutralFallbackFeedback(): PromptFeedback {
  return {
    state: "small_issue",
    fragment_before: "",
    fragment_after: "",
    tip: "Could not analyze this prompt right now.",
    category: "system",
  };
}
