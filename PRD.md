## Problem Statement

The user wants to improve their written technical English **during their real development workflow**, without leaving the terminal, opening another app, or interrupting their train of thought. The immediate goal is to receive timely, contextual English feedback right after submitting prompts while working with an AI coding tool.

The user has already validated the desktop interaction model and confirmed that the UI direction works well: a lightweight desktop widget appears after prompt submission and provides correction-style feedback. The next step is to formalize the product direction around a real integration path.

The user’s preferred near-term workflow is based on **OpenCode TUI**, and they want the product to integrate with that environment first. They may later use **Zed with the OpenCode extension**, but that should be treated as a separate future validation step rather than a requirement for the first implementation.

The product must work well in the context of **Arch Linux + Hyprland + Waybar**, using a floating widget approach that complements the existing desktop setup instead of replacing it. The first real version should focus on **OpenCode TUI prompt submission events**, persistent storage of feedback history, and lightweight real-time feedback surfaces, while postponing editor-specific integration concerns until later.

## Solution

Build a local tool in **TypeScript**, running on **Bun**, with **SQLite** as the source of truth. The tool will integrate first with **OpenCode TUI**, capturing prompt submission events and using them to trigger a lightweight desktop feedback flow.

The solution will be composed of four main blocks:

1. **OpenCode Adapter**: captures prompt submission events from OpenCode TUI and normalizes them into an internal event format.
2. **Analysis Worker**: produces a correction, a short tip, a severity level, and a main error category.
3. **Storage Layer**: persists prompt feedback history and metadata in SQLite.
4. **Presentation Layer**: shows immediate feedback through a **Quickshell floating widget**, while optionally exposing a minimal state indicator in the existing Waybar setup.

The primary interaction will be:

**prompt submitted in OpenCode TUI → adapter captures event → feedback is generated → result is persisted → widget opens with feedback**

The widget will continue to be the main UX surface:

* it opens automatically on new feedback
* it shows original prompt, corrected prompt, short tip, and severity
* it can be pinned/fixed open
* it can be dismissed manually
* it may auto-dismiss if not pinned

Waybar remains part of the desktop environment and may show a secondary lightweight signal, but it is not the main interaction surface.

**Zed integration is explicitly a future feature**, not part of the first implementation milestone. If the user later adopts Zed with the OpenCode extension, that path should be revalidated as a separate compatibility and UX step, while reusing as much of the core architecture as possible.

## User Stories

1. As a developer writing prompts in English inside OpenCode TUI, I want immediate feedback after submitting a prompt, so that I can improve my English without interrupting my coding flow.
2. As a developer, I want the first implementation to integrate directly with OpenCode TUI, so that the product is built on the workflow I intend to use in practice.
3. As a developer, I want the system to react to prompt submission events, so that the feedback feels directly connected to what I just wrote.
4. As a developer, I want the feedback to appear on my desktop rather than in a separate heavy app, so that it fits naturally into my workflow.
5. As a developer on Arch Linux, I want the interface to work naturally with Hyprland and Waybar, so that the tool feels native to my setup.
6. As a developer, I want the feedback to happen close to real time, so that the correction is still mentally connected to the prompt I just sent.
7. As a developer, I want the floating widget to open automatically after prompt submission, so that I do not need to trigger it manually.
8. As a developer, I want the widget to show the original prompt, so that I can compare the feedback with what I actually wrote.
9. As a developer, I want the widget to show a corrected version, so that I can learn better phrasing immediately.
10. As a developer, I want the widget to show a short tip, so that I understand the reason behind the correction.
11. As a developer, I want the widget to show a severity or signal level, so that I can quickly judge whether the issue deserves attention.
12. As a developer, I want the widget to be pin-able, so that I can keep it visible when I want to inspect it more carefully.
13. As a developer, I want the widget to be dismissible, so that I remain in control of the interruption level.
14. As a developer, I want the widget to optionally auto-dismiss when not pinned, so that it does not clutter the screen.
15. As a developer, I want the widget to feel lightweight and glanceable, so that it augments my workflow rather than competing with it.
16. As a developer, I want the first real version to use persistent local storage, so that I can inspect my mistakes later instead of losing them after the popup disappears.
17. As a developer, I want every analyzed prompt to be saved, so that I can review my learning history over time.
18. As a developer, I want the original prompt and corrected prompt to be persisted together, so that I can compare what I wrote with what I should have written.
19. As a developer, I want each record to include a short tip, so that the feedback remains useful during later review.
20. As a developer, I want each record to include an error category, so that I can identify recurring weaknesses.
21. As a developer, I want each record to include a severity level, so that I can differentiate style nits from more important issues.
22. As a developer, I want each record to have a timestamp, so that I can understand how my writing evolves over time.
23. As a developer, I want the tool to store the source agent context, so that I can distinguish OpenCode-based feedback from future integrations.
24. As a developer, I want the tool to store project or repository context when available, so that I can understand where certain writing patterns happen more often.
25. As a developer, I want the storage layer to be local-first, so that I keep ownership of my learning data.
26. As a developer, I want SQLite from the start, so that I do not need to migrate from temporary file-based storage later.
27. As a developer, I want the system to be built in TypeScript on Bun, so that it matches the stack I actually want to maintain.
28. As a developer, I want the widget layer to be implemented with Quickshell, so that it fits naturally into my desktop environment.
29. As a developer, I want Waybar to remain in my setup, so that I do not need to replace my main bar to use this product.
30. As a developer, I want Waybar to optionally show a small status indicator, so that I can keep a persistent lightweight signal without depending on the widget alone.
31. As a developer, I want the system to keep widget rendering separate from core logic, so that UI changes do not force rewrites of storage or integration behavior.
32. As a developer, I want the OpenCode integration to be isolated behind an adapter, so that future support for other tools remains possible.
33. As a developer, I want the event format to be normalized internally, so that downstream modules do not depend on raw OpenCode event payloads.
34. As a developer, I want the analysis layer to return a stable feedback object, so that presentation and persistence remain predictable.
35. As a developer, I want the system to degrade gracefully when analysis fails, so that a failed correction does not break my prompt workflow.
36. As a developer, I want the system to be resilient to malformed or missing OpenCode events, so that the tool does not become brittle.
37. As a developer, I want the first version to prioritize practical usefulness over feature completeness, so that I can start learning sooner.
38. As a developer, I want the first version to avoid Zed-specific implementation work, so that effort stays focused on the workflow I already validated.
39. As a developer, I want Zed integration to remain possible later, so that I can revisit it if my workflow changes.
40. As a developer, I want the architecture to be reusable if I later validate OpenCode via Zed, so that I do not throw away the first implementation.
41. As a developer, I want the product to treat Zed integration as a future feature, so that I do not overcomplicate the initial delivery.
42. As a developer, I want the system to remain useful even if I never adopt Zed, so that the core product stands on its own.
43. As a developer, I want the future Zed integration to reuse the same feedback, storage, and widget pipeline whenever possible, so that the editor path becomes an integration problem rather than a product rewrite.
44. As a developer, I want the product to stay focused on real-time English learning through real work, so that the learning experience stays grounded in my actual workflow.
45. As a developer, I want the design to preserve room for later history/review surfaces, so that the product can evolve beyond real-time feedback when appropriate.
46. As a developer, I want the system to remain modular enough to test core behavior in isolation, so that I can trust refactors later.
47. As a developer, I want the initial implementation to avoid unnecessary backend complexity, so that I can ship faster.
48. As a developer, I want the product to answer whether this workflow genuinely improves my English, so that I can justify investing further in it.
49. As a developer, I want this tool to feel like an augmentation of my development environment, so that it becomes part of my daily practice rather than another separate app to manage.
50. As a developer, I want future editor integrations to be treated as compatibility layers rather than the center of the product, so that the core remains stable.

## Implementation Decisions

* The project will be implemented in **TypeScript** and run on **Bun**.
* The first real integration target will be **OpenCode TUI**.
* The product will use an **OpenCode adapter** as the primary capture mechanism for prompt submission events.
* **Zed integration will not be part of the first implementation milestone**.
* Zed support will be treated as a **future feature**, to be validated separately after the OpenCode TUI path is working and valuable.
* The architecture will be split into four main modules: **OpenCode Adapter**, **Analysis Worker**, **Storage Layer**, and **Presentation Layer**.
* The OpenCode Adapter will transform OpenCode-specific prompt submission data into a normalized internal event format.
* The Analysis Worker will receive normalized prompt events and return a stable feedback object containing at least: original prompt, corrected prompt, tip, error type, severity, and whether the prompt changed.
* The Analysis Worker will not know about Quickshell, Waybar, or storage internals.
* The Storage Layer will use **SQLite as the source of truth from the first real version**.
* The initial persistence model will be centered on a single main table for prompt feedback history.
* Each stored record will include timestamp, source integration, project context when available, session context when available, original prompt, corrected prompt, short tip, error category, severity, review status, and optional metadata.
* The schema will be intentionally simple, but shaped to allow future evolution toward review workflows and lightweight spaced repetition if the product continues.
* The main presentation surface will be a **Quickshell floating widget**.
* Waybar will remain in use and may optionally consume a lightweight secondary status signal.
* The widget must support:

  * automatic opening on new feedback
  * pin/fix behavior
  * manual dismissal
  * optional auto-dismiss when not pinned
* The widget will display at least:

  * original prompt
  * corrected prompt
  * short tip
  * severity or feedback signal
* The widget rendering layer will remain independent from OpenCode event capture logic.
* The design will favor small stable interfaces so that capture, analysis, storage, and UI can evolve independently.
* The implementation should avoid overcommitting to editor-specific assumptions in the core system.
* Future Zed integration should be implemented as a new compatibility layer that reuses the existing feedback pipeline instead of redefining the product’s main architecture.
* OpenTUI and richer history/review interfaces may be added later, but they are not required for the first implementation milestone.

## Testing Decisions

* Good tests should validate **external behavior and stable contracts**, not implementation details.
* The most important tests in this project should focus on normalization, persistence behavior, query behavior, and widget-facing state generation.
* The OpenCode Adapter should be tested to confirm that relevant OpenCode prompt submission payloads are normalized into the correct internal event structure.
* The Analysis Worker should be tested at the contract level, ensuring it always returns the required fields and handles edge cases gracefully.
* The Storage Layer should be tested to confirm that prompt feedback records are inserted, retrieved, filtered, and updated correctly.
* The widget-facing state or payload generation layer should be tested to ensure it produces the correct output for new feedback, pinned state, dismissed state, and severity mapping.
* If a Waybar indicator is implemented, that layer should be tested as a small contract adapter from internal state to lightweight status output.
* UI tests should focus on user-observable widget behavior such as opening, pinning, dismissing, and auto-dismiss behavior rather than internal component structure.
* Tests should assert behaviors such as “given a new OpenCode prompt event with a major correction, the system persists the feedback and opens a widget with the expected visible state.”
* Error-handling tests should verify that malformed OpenCode input or analysis failures do not break the rest of the workflow.
* Future Zed integration should have its own compatibility-focused tests when it is introduced, but those tests are out of scope for the first milestone.

## Out of Scope

* Zed integration in the first implementation milestone
* Validation of Zed-specific event capture behavior
* Multi-agent support beyond the OpenCode-first architecture
* Codex/T3Code compatibility in the first implementation milestone
* Replacing Waybar
* Building a full OpenTUI history or review experience immediately
* A full spaced repetition engine
* Multi-device sync or cloud storage
* Deep learning analytics dashboards
* Advanced gamification features
* Broad editor/plugin support from day one
* Reworking the product around editor-specific UX before the OpenCode TUI path is proven

## Further Notes

* The OpenCode TUI path is the primary implementation path because it aligns with the workflow the user is willing to adopt for the sake of learning English.
* The UI direction has already been validated, so the next implementation should optimize for real integration and usefulness rather than further desktop experimentation.
* Keeping Waybar and adding Quickshell for the floating widget remains a deliberate scoping decision.
* SQLite remains a strategic choice because the user wants durable local history that can later be reviewed or exported.
* Zed integration is intentionally postponed so that the team does not optimize prematurely for an environment that has not yet been revalidated.
* If the product proves useful through the OpenCode TUI workflow, the next likely follow-up is to revisit **Zed + OpenCode extension compatibility** as a future feature validation step rather than as a redesign of the product.
