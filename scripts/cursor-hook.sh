#!/bin/bash
# EngFlow Cursor hook
# - forwards beforeSubmitPrompt payloads to @engflow/adapter-cursor
# - auto-approves permission hooks
# - no dependency on external apps

HOOK_PAYLOAD="$(cat 2>/dev/null || true)"
EVENT_TYPE="$1"
HOOK_LOG_FILE="/home/pedro/Projetos/EngFlow/.cursor-hook.log"

NEEDS_RESPONSE=false
case "$EVENT_TYPE" in
  Start|Stop) ;;
  PermissionRequest) NEEDS_RESPONSE=true ;;
  *) exit 0 ;;
esac

if [ "$NEEDS_RESPONSE" = "true" ]; then
  printf '{"continue":true}\n'
fi

if [ "$EVENT_TYPE" = "Start" ] && [ -n "$HOOK_PAYLOAD" ]; then
  # Hook executions often have a minimal PATH. Seed common user paths first.
  export PATH="/home/pedro/.bun/bin:/home/pedro/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

  BUN_BIN="$(command -v bun 2>/dev/null || true)"
  if [ -z "$BUN_BIN" ] && [ -x "/home/pedro/.bun/bin/bun" ]; then
    BUN_BIN="/home/pedro/.bun/bin/bun"
  fi
  if [ -z "$BUN_BIN" ] && [ -x "/home/linuxbrew/.linuxbrew/bin/bun" ]; then
    BUN_BIN="/home/linuxbrew/.linuxbrew/bin/bun"
  fi
  if [ -z "$BUN_BIN" ] && [ -x "/usr/local/bin/bun" ]; then
    BUN_BIN="/usr/local/bin/bun"
  fi
  if [ -z "$BUN_BIN" ] && [ -x "/usr/bin/bun" ]; then
    BUN_BIN="/usr/bin/bun"
  fi

  if [ -z "$BUN_BIN" ]; then
    printf '[%s] adapter failed (exit=127) output=bun not found in hook environment\n' \
      "$(date -Iseconds)" >> "$HOOK_LOG_FILE"
    exit 0
  fi

  ADAPTER_SOCKET="${ENGFLOW_SOCKET:-${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/engflow.sock}"
  printf '[%s] start event: socket=%s payload_bytes=%s\n' \
    "$(date -Iseconds)" "$ADAPTER_SOCKET" "${#HOOK_PAYLOAD}" >> "$HOOK_LOG_FILE"

  ADAPTER_OUT="$(printf '%s' "$HOOK_PAYLOAD" \
    | ENGFLOW_SOCKET="$ADAPTER_SOCKET" "$BUN_BIN" run --cwd "/home/pedro/Projetos/EngFlow/packages/adapter-cursor" hook 2>&1)"
  ADAPTER_STATUS=$?
  if [ "$ADAPTER_STATUS" -eq 0 ]; then
    printf '[%s] adapter ok\n' "$(date -Iseconds)" >> "$HOOK_LOG_FILE"
  else
    printf '[%s] adapter failed (exit=%s) output=%s\n' \
      "$(date -Iseconds)" "$ADAPTER_STATUS" "$ADAPTER_OUT" >> "$HOOK_LOG_FILE"
  fi
fi

exit 0
