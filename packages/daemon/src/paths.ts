import { homedir } from "node:os";

/**
 * Socket path: `ENGFLOW_SOCKET`, else `${XDG_RUNTIME_DIR}/engflow.sock`,
 * else `~/.config/engflow/socket` (PRD / plan: XDG config).
 */
export function resolveSocketPath(): string {
  const fromEnv = process.env.ENGFLOW_SOCKET?.trim();
  if (fromEnv) return fromEnv;
  const runtime = process.env.XDG_RUNTIME_DIR?.trim();
  if (runtime) return `${runtime}/engflow.sock`;
  return `${homedir()}/.config/engflow/socket`;
}
