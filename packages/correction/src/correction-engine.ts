import type { NormalizedPromptEvent, PromptFeedback } from "@engflow/contracts";

/**
 * Pluggable English prompt correction (PRD). Implementations must return a
 * Zod-valid {@link PromptFeedback}; failures should map to a safe fallback.
 */
export type CorrectionEngine = {
  correct(event: NormalizedPromptEvent): Promise<PromptFeedback>;
};
