import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { resolveSocketPath } from "../../packages/contracts/src/socket-path.ts";

type CliOptions = {
  legacyOutputFilePath: string | null;
};

const daemonSocketPath = resolveSocketPath();

function parseCliOptions(argv: string[]): CliOptions {
  let legacyOutputFilePath: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--legacy-output-file=")) {
      legacyOutputFilePath = resolve(arg.slice("--legacy-output-file=".length));
      continue;
    }
    if (arg === "--legacy-output-file" && i + 1 < argv.length) {
      legacyOutputFilePath = resolve(argv[i + 1]);
      i += 1;
      continue;
    }

    // Backward compatibility for previous positional output file.
    if (!arg.startsWith("-") && legacyOutputFilePath === null) {
      legacyOutputFilePath = resolve(arg);
    }
  }
  return { legacyOutputFilePath };
}

async function ensureOutputFile(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "");
}

function nowIso(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSerializedAppender(path: string): {
  append: (chunk: string) => Promise<void>;
  flush: () => Promise<void>;
} {
  let queue = Promise.resolve();
  return {
    append: (chunk: string) => {
      queue = queue
        .catch(() => {})
        .then(() => appendFile(path, chunk));
      return queue;
    },
    flush: () => queue,
  };
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const appender = options.legacyOutputFilePath
    ? createSerializedAppender(options.legacyOutputFilePath)
    : null;
  if (options.legacyOutputFilePath) {
    await ensureOutputFile(options.legacyOutputFilePath);
    process.stderr.write(
      `[widget-runtime-bridge] legacy file output enabled ${nowIso()} path=${options.legacyOutputFilePath}\n`,
    );
  } else {
    process.stderr.write(
      `[widget-runtime-bridge] stdout-only mode ${nowIso()} (host should ingest stdout/chunks directly)\n`,
    );
  }
  let shuttingDown = false;
  let currentClient: ReturnType<typeof createConnection> | null = null;
  let reconnectAttempt = 0;

  const connectLoop = async (): Promise<void> => {
    while (!shuttingDown) {
      await new Promise<void>((resolve) => {
        const client = createConnection(daemonSocketPath);
        currentClient = client;
        let resolved = false;

        const finish = () => {
          if (resolved) return;
          resolved = true;
          resolve();
        };

        client.once("connect", () => {
          reconnectAttempt = 0;
          const subscribeLine = `${JSON.stringify({ type: "subscribe_widget", payload: {} })}\n`;
          client.write(subscribeLine, "utf8");
          process.stderr.write(
            `[widget-runtime-bridge] connected ${nowIso()} socket=${daemonSocketPath} legacy_output=${options.legacyOutputFilePath ?? "disabled"}\n`,
          );
        });

        client.on("data", (chunk: Buffer | string) => {
          const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
          if (appender) {
            void appender.append(text).catch((err: unknown) => {
              process.stderr.write(
                `[widget-runtime-bridge] append error ${nowIso()} ${err instanceof Error ? err.message : String(err)}\n`,
              );
            });
          }
          process.stdout.write(text);
        });

        client.once("error", (err) => {
          process.stderr.write(
            `[widget-runtime-bridge] socket error ${nowIso()} ${err.message}\n`,
          );
          finish();
        });

        client.once("close", () => {
          process.stderr.write(`[widget-runtime-bridge] disconnected ${nowIso()}\n`);
          finish();
        });
      });

      if (shuttingDown) {
        return;
      }

      reconnectAttempt += 1;
      const backoffMs = Math.min(3000, reconnectAttempt * 500);
      process.stderr.write(
        `[widget-runtime-bridge] reconnecting ${nowIso()} in ${backoffMs}ms\n`,
      );
      await delay(backoffMs);
    }
  };

  const shutdown = () => {
    shuttingDown = true;
    if (currentClient) {
      try {
        currentClient.destroy();
      } catch {
        /* ignore */
      }
    }
    const flushPromise = appender
      ? appender.flush().catch((err: unknown) => {
          process.stderr.write(
            `[widget-runtime-bridge] flush error ${nowIso()} ${err instanceof Error ? err.message : String(err)}\n`,
          );
        })
      : Promise.resolve();
    void flushPromise.finally(() => {
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await connectLoop();
}

void main().catch((err: unknown) => {
  process.stderr.write(
    `[widget-runtime-bridge] fatal ${nowIso()} ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
