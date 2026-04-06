import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { connect } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startNdjsonSocketServer } from "./ndjson-socket.ts";

describe("startNdjsonSocketServer", () => {
  let socketPath: string;
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "engflow-daemon-"));
    socketPath = join(baseDir, "test.sock");
  });

  afterEach(() => {
    try {
      rmSync(baseDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  function sendLine(line: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const c = connect(socketPath, () => {
        c.write(line.endsWith("\n") ? line : `${line}\n`, () => {
          c.end();
          resolve();
        });
      });
      c.on("error", reject);
    });
  }

  test("calls onValid for one valid NDJSON line", async () => {
    const valids: string[] = [];
    const invalids: number[] = [];
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: (e) => valids.push(e.prompt_text),
      onInvalid: () => invalids.push(1),
    });
    await s.listen();
    await sendLine(
      JSON.stringify({
        event_type: "prompt_submitted",
        source: "opencode",
        session_id: "s1",
        project_path: "/p",
        prompt_text: "hello",
        timestamp: "2026-04-06T12:00:00.000Z",
      }),
    );
    await s.close();
    expect(valids).toEqual(["hello"]);
    expect(invalids).toEqual([]);
  });

  test("calls onInvalid for invalid JSON and keeps server usable", async () => {
    let invalid = 0;
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: () => {},
      onInvalid: () => {
        invalid += 1;
      },
    });
    await s.listen();
    await sendLine("not-json{{{");
    await sendLine(
      JSON.stringify({
        event_type: "prompt_submitted",
        source: "opencode",
        session_id: "s1",
        project_path: "/p",
        prompt_text: "second",
        timestamp: "2026-04-06T12:00:00.000Z",
      }),
    );
    await s.close();
    expect(invalid).toBe(1);
  });

  test("calls onInvalid for JSON that fails Zod", async () => {
    let invalid = 0;
    const s = startNdjsonSocketServer({
      socketPath,
      onValid: () => {},
      onInvalid: () => {
        invalid += 1;
      },
    });
    await s.listen();
    await sendLine(JSON.stringify({ foo: 1 }));
    await s.close();
    expect(invalid).toBe(1);
  });
});
