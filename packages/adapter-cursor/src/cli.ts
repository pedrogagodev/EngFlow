import { runFromStdin } from "./hook.ts";

// Intentionally never throws: this runs inside Cursor hooks.
runFromStdin();
