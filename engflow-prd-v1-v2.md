# EngFlow PRD

## Problem Statement

The user wants to improve their written technical English **inside their real development workflow**, without switching apps, breaking focus, or opening a separate study tool.

The immediate goal is to receive **fast, contextual English correction and translation feedback** right after sending prompts while working with an AI coding tool. The user has already validated that a **floating desktop widget** works well as the feedback surface, and wants that interaction model in the first real version.

The product must be built for a **personal Linux-first workflow**, with the explicit assumption of **Arch Linux** as the main operating environment. It should feel native to an Arch + Hyprland desktop setup and run as a lightweight local system rather than as a heavy standalone desktop application.

The user does **not** want the product to be modeled as a single-tool plugin tied forever to OpenCode. Instead, the product should be designed as a **reusable local core** with **tool-specific adapters**. The first adapter will target **OpenCode**, but the architecture must preserve a clean path for future adapters such as **Zed** and potentially **Cursor**.

The first version should focus on the real-time correction loop:

**prompt submitted → event captured → prompt analyzed → immediate widget feedback shown**

At this stage, the main value is the real-time feedback experience itself. The user wants to validate whether the product is actually helpful during daily work before investing in a richer history and review experience.

## Solution

Build a local tool in **TypeScript**, running on **Bun**, designed as a **background daemon** with a small CLI and a **Quickshell** widget for immediate visual feedback.

The system will be split into four main blocks:

1. **Tool Adapter Layer**
   - Captures prompt submission events from external tools
   - Translates raw tool-specific payloads into a shared internal event contract
   - Sends normalized events to the local daemon

2. **Daemon Core**
   - Runs in the background on the local machine
   - Receives normalized prompt events over a **Unix domain socket**
   - Calls the correction engine
   - Emits widget-facing feedback events
   - Remains fully independent from any single editor or AI tool

3. **Correction Engine**
   - Internal abstraction used by the daemon
   - First implementation uses **OpenAI** as the external provider
   - Returns structured feedback validated against internal contracts

4. **Presentation Layer**
   - Built with **Quickshell**
   - Displays a compact floating widget immediately after analysis
   - Prioritizes fast reading and minimal interruption

The system will follow an **event-driven architecture**.

Adapters will send **normalized JSON events** over a **Unix domain socket**.
The daemon will validate incoming data, analyze the prompt, and emit a lightweight feedback event to the widget.

The first implementation will target **OpenCode** as the initial adapter. However, the architecture is intentionally designed so that future adapters for **Zed** and **Cursor** can reuse the same daemon, correction engine, and widget pipeline.

## Version Scope

### V1

V1 is responsible for proving the core product loop and making the tool usable in the user's real workflow.

V1 includes:

- OpenCode as the first adapter target
- A local background daemon
- Unix domain socket as the real-time IPC mechanism
- Normalized internal prompt events
- OpenAI as the first correction provider behind a `CorrectionEngine` interface
- Quickshell widget as the immediate feedback surface
- Three visual states:
  - `Correct`
  - `Small issue`
  - `Strong issue`
- Widget content:
  - state
  - short correction diff or “correct” message
  - short tip
  - error or tip category
- A short neutral fallback card when analysis fails
- Minimal CLI commands for operational control such as daemon status and diagnostics

V1 does **not** include:

- persistent history
- progress tracking
- OpenTUI-based history/review UI
- Zed adapter
- Cursor adapter
- advanced analytics or spaced repetition

### V2

V2 is responsible exclusively for **history, tracking, and TUI-based review**.

V2 includes:

- persistent history storage
- tracking of recurring mistakes
- progress-oriented review features
- OpenTUI-based terminal experience for reviewing prior feedback

## User Stories

1. As a developer writing prompts in English while coding, I want immediate correction feedback after sending a prompt, so that I can improve without breaking my development flow.
2. As a developer on Arch Linux, I want the tool to feel native to my setup, so that it behaves like a natural extension of my desktop environment.
3. As a developer, I want the first real version to work with OpenCode, so that I can validate the product inside the workflow I already intend to use.
4. As a developer, I want the product core to be reusable beyond OpenCode, so that future adapters for tools such as Zed or Cursor do not require a product rewrite.
5. As a developer, I want adapters to translate tool-specific payloads into one internal event model, so that the daemon remains independent from external tool details.
6. As a developer, I want prompt events to be sent to the daemon in real time, so that I receive feedback with minimal delay.
7. As a developer, I want the system to be event-driven instead of polling-based, so that it avoids unnecessary checks and feels more immediate.
8. As a developer, I want the widget to open automatically when feedback is ready, so that I do not need to manually request corrections.
9. As a developer, I want the widget to be compact and glanceable, so that I can understand feedback in a few seconds.
10. As a developer, I want the widget to show whether the prompt is correct, has a small issue, or has a strong issue, so that I can understand severity at a glance.
11. As a developer, I want the widget to show only the most relevant problematic fragment instead of the full prompt, so that the card remains visually clean.
12. As a developer, I want the widget to show a corrected fragment when the prompt is wrong, so that I can learn the better phrasing immediately.
13. As a developer, I want the widget to show a short message when the prompt is already acceptable, so that I get positive confirmation without noise.
14. As a developer, I want the widget to show a short tip, so that I understand the main reason behind the correction.
15. As a developer, I want the widget to show the type of issue or tip, so that I can identify what kind of mistake happened.
16. As a developer, I want the widget to support pinning, so that I can keep it open when I want to inspect it more carefully.
17. As a developer, I want the widget to support dismissal, so that I stay in control of interruptions.
18. As a developer, I want analysis failures to show a short neutral card, so that the system fails gracefully instead of feeling broken.
19. As a developer, I want the daemon to run in the background, so that the product feels ambient rather than like a foreground terminal app I must keep open manually.
20. As a developer, I want a minimal CLI for operational control, so that I can inspect status or diagnose issues locally.
21. As a developer, I want the correction provider to be abstracted behind an internal interface, so that I can change providers later without rewriting the system.
22. As a developer, I want V1 to stay focused on real-time correction, so that the product proves usefulness before expanding into review and tracking.
23. As a developer, I want V2 to add history and OpenTUI later, so that I can evolve the tool into a fuller learning companion after validating the core loop.

## Widget UX Decisions

The V1 widget should follow a compact, dark, card-based design inspired by the reference that was validated during brainstorming.

The top decorative area from the original reference is not part of scope. The source of truth for the V1 widget is the **card layout and information hierarchy**, not the exact platform-specific visual shell.

The widget should prioritize information in this order:

1. **State**
2. **Short correction diff or correct message**
3. **Short tip**
4. **Issue category**

The widget should use exactly **three states**:

- **Correct**
  - Used when the prompt is acceptable for the MVP, including cases that could be more natural but are still good enough
- **Small issue**
  - Used when there is a minor but real issue in grammar, structure, word choice, or clarity
- **Strong issue**
  - Used when the problem is clearly wrong, confusing, or requires stronger correction

Naturalness-only improvements should be treated as **Correct** in V1 to avoid unnecessary noise.

The correction block should display the **smallest useful fragment**, not the full original prompt.
Examples:

- `I need learn → I need to learn`
- `on the another hand → on the other hand`

When no correction is needed, the widget should show a short confirmation such as:

- `No issues here`
- `Looks good`

The widget should support:

- automatic opening when new feedback arrives
- pin/fix behavior
- manual dismissal

## Architecture Decisions

- The project will be implemented in **TypeScript** on **Bun**.
- The product will be Linux-first and optimized for the user's **Arch Linux** environment.
- The product will run as a **background daemon**.
- The system will use a **Unix domain socket** as the primary local IPC mechanism.
- Communication over the socket will use **simple JSON payloads**, not JSON-RPC.
- Adapters will send **already normalized internal events** to the daemon.
- The daemon will accept only the internal normalized event contract.
- The first adapter will target **OpenCode**.
- Future adapters such as **Zed** and **Cursor** should be added as compatibility layers, not as reasons to redesign the core system.
- The correction provider will be abstracted behind an internal **`CorrectionEngine`** interface.
- The first provider implementation will use **OpenAI**.
- Internal contracts will be validated with **Zod**.
- The immediate feedback surface will be a **Quickshell** widget.
- The daemon and widget will remain separate concerns.
- The system will be designed so that failure in one component does not crash the entire flow.
- V1 will avoid storage and tracking complexity in order to keep the first shipped version focused.
- V2 will introduce persistent history and an **OpenTUI** review surface.

## Suggested Internal Contracts

### NormalizedPromptEvent

The daemon should receive a normalized event with fields such as:

- `event_type`
- `source`
- `session_id`
- `project_path`
- `prompt_text`
- `timestamp`

### PromptFeedback

The correction engine should return a stable internal contract with fields such as:

- `state`
- `fragment_before`
- `fragment_after`
- `tip`
- `category`

### WidgetFeedbackEvent

The daemon should emit a UI-facing payload with fields such as:

- `state`
- `display_text`
- `tip`
- `category`
- `can_pin`
- `auto_open`

## Testing Decisions

Good tests should validate **external behavior and stable contracts**, not implementation details.

The most important tests for V1 are:

- OpenCode adapter correctly normalizes raw tool payloads into `NormalizedPromptEvent`
- invalid adapter events are rejected safely without crashing the daemon
- `CorrectionEngine` returns a valid `PromptFeedback` contract
- widget-facing feedback state is generated correctly for:
  - `Correct`
  - `Small issue`
  - `Strong issue`
- analysis failures generate the agreed neutral fallback card
- widget behavior works correctly for:
  - auto-open
  - pin
  - dismiss

Testing should stay focused on user-visible outcomes and stable boundaries.

## Out of Scope

### Out of Scope for V1

- persistent history storage
- tracking of recurring mistakes
- OpenTUI-based history or review flows
- progress analytics
- dashboards
- spaced repetition logic
- Zed adapter in the first milestone
- Cursor adapter in the first milestone
- multi-tool orchestration beyond the first adapter
- deep personalization or gamification
- cloud sync
- multi-device storage

### Out of Scope for the Product for Now

- replacing the desktop environment
- building a full editor plugin ecosystem from day one
- turning the product into a heavy standalone desktop app

## Further Notes

- The central product idea is not “an OpenCode plugin” but rather **a reusable local correction system with adapters**.
- OpenCode is the first adapter because it matches the workflow the user wants to validate first.
- The architecture is intentionally shaped so that future adapters can reuse the same daemon, correction engine, and widget.
- V1 should be treated as the loop-validation version: does the user actually benefit from immediate English correction during real development work?
- V2 should be treated as the memory-and-review version: once the core loop proves useful, add history, tracking, and OpenTUI for reflection and progress.
