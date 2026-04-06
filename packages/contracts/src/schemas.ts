import { z } from "zod";

/** Aligns with PRD widget severity / engine state (internal enum). */
export const feedbackStateSchema = z.enum([
  "correct",
  "small_issue",
  "strong_issue",
]);

export const normalizedPromptEventSchema = z.object({
  event_type: z.string(),
  source: z.string(),
  session_id: z.string(),
  project_path: z.string(),
  prompt_text: z.string(),
  timestamp: z.string(),
});

export const promptFeedbackSchema = z.object({
  state: feedbackStateSchema,
  fragment_before: z.string(),
  fragment_after: z.string(),
  tip: z.string(),
  category: z.string(),
});

export const widgetFeedbackEventSchema = z.object({
  state: feedbackStateSchema,
  display_text: z.string(),
  tip: z.string(),
  category: z.string(),
  can_pin: z.boolean(),
  auto_open: z.boolean(),
});

export type NormalizedPromptEvent = z.infer<typeof normalizedPromptEventSchema>;
export type PromptFeedback = z.infer<typeof promptFeedbackSchema>;
export type WidgetFeedbackEvent = z.infer<typeof widgetFeedbackEventSchema>;

export function parseNormalizedPromptEvent(
  raw: unknown,
): z.SafeParseReturnType<unknown, NormalizedPromptEvent> {
  return normalizedPromptEventSchema.safeParse(raw);
}
