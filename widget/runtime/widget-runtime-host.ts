import { createConnection } from "node:net";
import { resolveSocketPath } from "../../packages/contracts/src/socket-path.ts";

type ClientSocket = {
  send: (message: string) => void;
  readyState: number;
};

type CliOptions = {
  host: string;
  port: number;
};

function parseCliOptions(argv: string[]): CliOptions {
  let host = "127.0.0.1";
  let port = 4242;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--host=")) {
      host = arg.slice("--host=".length);
      continue;
    }
    if (arg === "--host" && i + 1 < argv.length) {
      host = argv[i + 1]!;
      i += 1;
      continue;
    }
    if (arg.startsWith("--port=")) {
      port = Number(arg.slice("--port=".length)) || port;
      continue;
    }
    if (arg === "--port" && i + 1 < argv.length) {
      port = Number(argv[i + 1]) || port;
      i += 1;
    }
  }
  return { host, port };
}

function nowIso(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const daemonSocketPath = resolveSocketPath();
  const clients = new Set<ClientSocket>();
  let shuttingDown = false;

  const broadcast = (line: string): void => {
    for (const client of clients) {
      try {
        if (client.readyState === 1) {
          client.send(line);
        }
      } catch {
        clients.delete(client);
      }
    }
  };

  const server = Bun.serve({
    hostname: options.host,
    port: options.port,
    fetch(req, server_) {
      if (server_.upgrade(req)) {
        return;
      }
      return new Response("widget runtime host ok", { status: 200 });
    },
    websocket: {
      open(ws) {
        clients.add(ws as unknown as ClientSocket);
      },
      close(ws) {
        clients.delete(ws as unknown as ClientSocket);
      },
    },
  });

  process.stderr.write(
    `[widget-runtime-host] listening ${nowIso()} ws=ws://${options.host}:${options.port} daemon_socket=${daemonSocketPath}\n`,
  );

  const connectLoop = async (): Promise<void> => {
    let reconnectAttempt = 0;
    while (!shuttingDown) {
      await new Promise<void>((resolve) => {
        const client = createConnection(daemonSocketPath);
        let buffer = "";
        let resolved = false;

        const finish = () => {
          if (resolved) return;
          resolved = true;
          resolve();
        };

        client.once("connect", () => {
          reconnectAttempt = 0;
          client.write(
            `${JSON.stringify({ type: "subscribe_widget", payload: {} })}\n`,
            "utf8",
          );
          process.stderr.write(
            `[widget-runtime-host] connected ${nowIso()} daemon=${daemonSocketPath}\n`,
          );
        });

        client.on("data", (chunk: Buffer | string) => {
          buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const line of parts) {
            if (line.length > 0) {
              broadcast(line);
            }
          }
        });

        client.once("error", (err) => {
          process.stderr.write(
            `[widget-runtime-host] daemon socket error ${nowIso()} ${err.message}\n`,
          );
          finish();
        });

        client.once("close", () => {
          process.stderr.write(
            `[widget-runtime-host] daemon disconnected ${nowIso()}\n`,
          );
          finish();
        });
      });

      if (shuttingDown) return;
      reconnectAttempt += 1;
      const backoffMs = Math.min(3000, reconnectAttempt * 500);
      await delay(backoffMs);
    }
  };

  const shutdown = () => {
    shuttingDown = true;
    server.stop(true);
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await connectLoop();
}

void main().catch((err: unknown) => {
  process.stderr.write(
    `[widget-runtime-host] fatal ${nowIso()} ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
