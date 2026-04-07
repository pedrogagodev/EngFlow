import { afterEach, describe, expect, test } from "bun:test";
import { resolveSocketPath } from "./socket-path.ts";

describe("resolveSocketPath", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  test("uses ENGFLOW_SOCKET when set", () => {
    process.env.ENGFLOW_SOCKET = "/tmp/custom.sock";
    delete process.env.XDG_RUNTIME_DIR;
    expect(resolveSocketPath()).toBe("/tmp/custom.sock");
  });

  test("uses XDG_RUNTIME_DIR when ENGFLOW_SOCKET unset", () => {
    delete process.env.ENGFLOW_SOCKET;
    process.env.XDG_RUNTIME_DIR = "/run/user/1";
    expect(resolveSocketPath()).toBe("/run/user/1/engflow.sock");
  });

  test("falls back to ~/.config/engflow/socket", () => {
    delete process.env.ENGFLOW_SOCKET;
    delete process.env.XDG_RUNTIME_DIR;
    const p = resolveSocketPath();
    expect(p.endsWith("/.config/engflow/socket")).toBe(true);
  });
});
