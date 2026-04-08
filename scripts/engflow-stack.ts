import { stat } from "node:fs/promises";
import { join } from "node:path";
import { resolveSocketPath } from "../packages/contracts/src/socket-path.ts";

const repoRoot = join(import.meta.dir, "..");
const DAEMON_ENTRY = join(repoRoot, "packages/daemon/src/main.ts");
const HOST_ENTRY = join(repoRoot, "widget/runtime/widget-runtime-host.ts");

const SOCKET_WAIT_MS = 15_000;
const POLL_MS = 50;

function parseHostArgv(argv: string[]): string[] {
  return argv.slice(2);
}

async function pipeStreamWithPrefix(
  stream: ReadableStream<Uint8Array> | undefined,
  prefix: string,
): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      process.stderr.write(`${prefix}${line}\n`);
    }
  }
  if (buffer.length > 0) {
    process.stderr.write(`${prefix}${buffer}\n`);
  }
}

async function waitForSocketFile(
  socketPath: string,
  timeoutMs: number,
  isDaemonAlive: () => boolean,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isDaemonAlive()) {
      throw new Error("daemon exited before the socket was ready");
    }
    try {
      const st = await stat(socketPath);
      if (st.isSocket()) {
        return;
      }
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`timeout after ${timeoutMs}ms waiting for socket: ${socketPath}`);
}

async function main(): Promise<void> {
  const hostArgv = parseHostArgv(process.argv);
  const socketPath = resolveSocketPath();

  let shuttingDown = false;
  let host: Bun.Subprocess | undefined;

  const daemon = Bun.spawn({
    cmd: ["bun", "run", DAEMON_ENTRY],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      host?.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    try {
      daemon.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    await Promise.race([
      Promise.allSettled([
        host ? host.exited : Promise.resolve(0),
        daemon.exited,
      ]),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    process.exit(0);
  };

  const shutdownFromError = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      host?.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    try {
      daemon.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    await Promise.race([
      Promise.allSettled([
        host ? host.exited : Promise.resolve(0),
        daemon.exited,
      ]),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    process.exit(1);
  };

  let daemonDead = false;
  void daemon.exited.then((code) => {
    daemonDead = true;
    if (!shuttingDown) {
      process.stderr.write(
        `[stack] daemon exited unexpectedly (code ${code ?? "?"})\n`,
      );
      void shutdownFromError();
    }
  });

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  void pipeStreamWithPrefix(daemon.stdout, "[daemon] ");
  void pipeStreamWithPrefix(daemon.stderr, "[daemon] ");

  try {
    await waitForSocketFile(socketPath, SOCKET_WAIT_MS, () => !daemonDead);
  } catch (err) {
    process.stderr.write(
      `[stack] ${err instanceof Error ? err.message : String(err)}\n`,
    );
    try {
      daemon.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    await daemon.exited;
    process.exit(1);
  }

  process.stderr.write(`[stack] socket ready: ${socketPath}\n`);

  host = Bun.spawn({
    cmd: ["bun", "run", HOST_ENTRY, ...hostArgv],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  void host.exited.then((code) => {
    if (!shuttingDown) {
      process.stderr.write(
        `[stack] widget-runtime-host exited unexpectedly (code ${code ?? "?"})\n`,
      );
      void shutdownFromError();
    }
  });

  void pipeStreamWithPrefix(host.stdout, "[host] ");
  void pipeStreamWithPrefix(host.stderr, "[host] ");

  await Promise.race([daemon.exited, host.exited]);
  await shutdown();
}

void main().catch((err: unknown) => {
  process.stderr.write(
    `[stack] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
