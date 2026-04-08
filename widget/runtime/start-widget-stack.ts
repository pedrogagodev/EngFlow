/**
 * Um único comando para subir daemon + widget-runtime-host (+ UI opcional).
 * Uso:
 *   bun widget/runtime/start-widget-stack.ts
 *   bun widget/runtime/start-widget-stack.ts --ui=none
 *   bun widget/runtime/start-widget-stack.ts --ui=preview
 *   bun widget/runtime/start-widget-stack.ts -- --force-visible=true
 */
import { join } from "node:path";

type UiMode = "qs" | "preview" | "none";

function parseArgs(argv: string[]): {
  host: string;
  port: number;
  ui: UiMode;
  uiExtra: string[];
} {
  let host = "127.0.0.1";
  let port = 4242;
  let ui: UiMode = "qs";
  const rest: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "--") {
      rest.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--host=")) {
      host = a.slice("--host=".length);
      i += 1;
      continue;
    }
    if (a === "--host" && i + 1 < argv.length) {
      host = argv[i + 1]!;
      i += 2;
      continue;
    }
    if (a.startsWith("--port=")) {
      port = Number(a.slice("--port=".length)) || port;
      i += 1;
      continue;
    }
    if (a === "--port" && i + 1 < argv.length) {
      port = Number(argv[i + 1]) || port;
      i += 2;
      continue;
    }
    if (a.startsWith("--ui=")) {
      const v = a.slice("--ui=".length) as UiMode;
      if (v === "qs" || v === "preview" || v === "none") ui = v;
      i += 1;
      continue;
    }
    rest.push(a);
    i += 1;
  }
  return { host, port, ui, uiExtra: rest };
}

const repoRoot = join(import.meta.dir, "../..");

async function main(): Promise<void> {
  const { host, port, ui, uiExtra } = parseArgs(process.argv.slice(2));
  const children: Bun.Subprocess[] = [];

  const pushChild = (proc: Bun.Subprocess) => {
    children.push(proc);
  };

  const shutdown = async (signal: NodeJS.Signals) => {
    for (const c of children) {
      try {
        c.kill(signal);
      } catch {
        /* ignore */
      }
    }
    await Promise.allSettled(children.map((c) => c.exited));
    process.exit(signal === "SIGINT" ? 130 : 143);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  const daemon = Bun.spawn({
    cmd: ["bun", "run", join(repoRoot, "packages/daemon/src/main.ts")],
    cwd: repoRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  pushChild(daemon);

  const bridge = Bun.spawn({
    cmd: [
      "bun",
      "run",
      join(repoRoot, "widget/runtime/widget-runtime-host.ts"),
      `--host=${host}`,
      `--port=${String(port)}`,
    ],
    cwd: repoRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  pushChild(bridge);

  const wsUrl = `ws://${host}:${String(port)}`;
  const commonQmlArgs = [
    "--runtime-ingress=ws",
    `--runtime-ws-url=${wsUrl}`,
    ...uiExtra,
  ];

  if (ui === "qs") {
    const shellQml = join(repoRoot, "widget/quickshell/shell.qml");
    const uiProc = Bun.spawn({
      cmd: ["qs", "-p", shellQml],
      cwd: repoRoot,
      stdout: "inherit",
      stderr: "inherit",
    });
    pushChild(uiProc);
  } else if (ui === "preview") {
    const mainQml = join(repoRoot, "widget/quickshell/Main.qml");
    const uiProc = Bun.spawn({
      cmd: ["qmlscene", mainQml, ...commonQmlArgs],
      cwd: repoRoot,
      stdout: "inherit",
      stderr: "inherit",
    });
    pushChild(uiProc);
  }

  if (ui === "none") {
    process.stderr.write(
      `[start-widget-stack] backend only: daemon + ws bridge (${wsUrl}). Ctrl+C para encerrar.\n`,
    );
  }

  const outcomes = await Promise.allSettled(children.map((c) => c.exited));
  const firstError = outcomes.find((o) => o.status === "rejected");
  if (firstError && firstError.status === "rejected") {
    await shutdown("SIGTERM");
    return;
  }
  const codes = outcomes
    .filter((o): o is PromiseFulfilledResult<number> => o.status === "fulfilled")
    .map((o) => o.value);
  const bad = codes.find((c) => c !== 0);
  process.exit(bad ?? 0);
}

void main().catch((err: unknown) => {
  process.stderr.write(
    `[start-widget-stack] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
