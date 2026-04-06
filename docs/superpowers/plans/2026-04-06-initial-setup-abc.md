# EngFlow initial setup (A + B + C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver strict “setup inicial”: **A** toolchain (Bun monorepo + scripts + TS check), **B** Zod contracts aligned with `engflow-prd-v1-v2.md`, **C** minimal UNIX domain socket daemon that reads **NDJSON** (one JSON object per line), validates `NormalizedPromptEvent`, and never crashes on malformed input.

**Architecture:** Root `package.json` uses Bun **workspaces** with `packages/contracts` (`@engflow/contracts`) and `packages/daemon` (`@engflow/daemon`). The daemon depends only on the contracts package for parsing. Wire protocol for this milestone: **UTF-8 NDJSON over stream**; each line is one `JSON.parse` payload validated with `normalizedPromptEventSchema.safeParse`. No correction pipeline, OpenCode adapter, or Quickshell yet — only validation + hooks (`onValid` / `onInvalid`).

**Tech Stack:** Bun (runtime + `bun:test`), TypeScript (`strict` already in root `tsconfig.json`), Zod 3.x, Node `node:net` (`createServer`) for UNIX sockets (supported in Bun).

**Parallelização:** **A → B → C é sequencial** (C importa contratos). Subagents em paralelo fazem sentido **depois** deste plano (ex.: correction vs adapter vs widget). Não dividas A/B/C entre agents diferentes sem merge ordenado.

**Fonte de contratos:** `engflow-prd-v1-v2.md` secção “Suggested Internal Contracts” — campos abaixo.

---

## File map (criar / alterar)


| Caminho                                     | Responsabilidade                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `package.json` (raiz)                       | `workspaces`, scripts `test` / `check`, `devDependencies`                                 |
| `tsconfig.json` (raiz)                      | `include` para `packages/*/src/**/*.ts` (ajuste mínimo)                                   |
| `packages/contracts/package.json`           | Pacote `@engflow/contracts`, dependência `zod`                                            |
| `packages/contracts/src/schemas.ts`         | Schemas Zod + tipos exportados + `parseNormalizedPromptEvent`                             |
| `packages/contracts/src/schemas.test.ts`    | Testes de contrato                                                                        |
| `packages/daemon/package.json`              | Pacote `@engflow/daemon`, dependência `workspace:`* dos contratos                         |
| `packages/daemon/src/ndjson-socket.ts`      | Servidor UNIX socket NDJSON + API `start` / `close`                                       |
| `packages/daemon/src/ndjson-socket.test.ts` | Testes de integração locais                                                               |
| `index.ts` (raiz)                           | Remover ou esvaziar — entrada futura será `packages/daemon` (este plano não adiciona CLI) |


---

### Task 1: Phase A — Workspaces, scripts, TypeScript check

**Files:**

- Modify: `/home/pedro/Projetos/EngFlow/package.json`
- Modify: `/home/pedro/Projetos/EngFlow/tsconfig.json`
- Create: `/home/pedro/Projetos/EngFlow/packages/contracts/package.json`
- Create: `/home/pedro/Projetos/EngFlow/packages/daemon/package.json`
- Delete or modify: `/home/pedro/Projetos/EngFlow/index.ts`
- **Step 1: Replace root `package.json` with workspace-enabled config**

Substituir o conteúdo de `package.json` por:

```json
{
  "name": "engflow",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "bun test",
    "check": "bun test && bunx tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

- **Step 2: Point TypeScript at workspace packages**

Substituir `tsconfig.json` **completo** por (mantém `strict`; adiciona `include`):

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  },
  "include": ["packages/*/src/**/*.ts"]
}
```

- **Step 3: Create placeholder workspace packages so `bun install` resolves**

`packages/contracts/package.json`:

```json
{
  "name": "@engflow/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/schemas.ts"
  }
}
```

`packages/daemon/package.json`:

```json
{
  "name": "@engflow/daemon",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/ndjson-socket.ts"
  },
  "dependencies": {
    "@engflow/contracts": "workspace:*"
  }
}
```

- **Step 4: Remove root `index.ts`**

Apagar `/home/pedro/Projetos/EngFlow/index.ts` (evita confundir entry com pacotes).

- **Step 5: Install and verify workspaces**

Run:

```bash
cd /home/pedro/Projetos/EngFlow && bun install
```

Expected: `bun install` completes; `node_modules` links `@engflow/contracts` and `@engflow/daemon`. **Não corras `tsc` ainda** — com `include` vazio o TypeScript pode falhar; o primeiro `bun run check` completo fica no fim da Task 2 (depois de existir `packages/contracts/src/*.ts`).

- **Step 6: Commit**

```bash
cd /home/pedro/Projetos/EngFlow
git add package.json tsconfig.json packages/contracts/package.json packages/daemon/package.json
git rm -f index.ts 2>/dev/null || true
git commit -m "chore: add bun workspaces for contracts and daemon packages"
```

---

### Task 2: Phase B — Zod contracts + tests (TDD)

**Files:**

- Modify: `/home/pedro/Projetos/EngFlow/packages/contracts/package.json`
- Create: `/home/pedro/Projetos/EngFlow/packages/contracts/src/schemas.ts`
- Create: `/home/pedro/Projetos/EngFlow/packages/contracts/src/schemas.test.ts`
- **Step 1: Add Zod dependency**

Em `packages/contracts/package.json`, adicionar:

```json
"dependencies": {
  "zod": "^3.24.0"
}
```

Run:

```bash
cd /home/pedro/Projetos/EngFlow && bun install
```

- **Step 2: Write failing tests first**

Criar `packages/contracts/src/schemas.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import {
  feedbackStateSchema,
  normalizedPromptEventSchema,
  parseNormalizedPromptEvent,
  promptFeedbackSchema,
  widgetFeedbackEventSchema,
} from "./schemas.ts";

const validEvent = {
  event_type: "prompt_submitted",
  source: "opencode",
  session_id: "sess-1",
  project_path: "/home/user/proj",
  prompt_text: "Fix the bug",
  timestamp: "2026-04-06T12:00:00.000Z",
};

describe("NormalizedPromptEvent", () => {
  test("accepts a valid payload", () => {
    const r = parseNormalizedPromptEvent(validEvent);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prompt_text).toBe("Fix the bug");
  });

  test("rejects missing field", () => {
    const bad = { ...validEvent };
    delete (bad as Record<string, unknown>)["prompt_text"];
    const r = parseNormalizedPromptEvent(bad);
    expect(r.success).toBe(false);
  });
});

describe("PromptFeedback", () => {
  test("accepts valid feedback", () => {
    const r = promptFeedbackSchema.safeParse({
      state: "small_issue",
      fragment_before: "I need learn",
      fragment_after: "I need to learn",
      tip: "Use infinitive after need.",
      category: "grammar",
    });
    expect(r.success).toBe(true);
  });
});

describe("WidgetFeedbackEvent", () => {
  test("accepts valid widget payload", () => {
    const r = widgetFeedbackEventSchema.safeParse({
      state: "correct",
      display_text: "Looks good",
      tip: "",
      category: "none",
      can_pin: true,
      auto_open: true,
    });
    expect(r.success).toBe(true);
  });
});

describe("feedbackStateSchema", () => {
  test("rejects unknown state", () => {
    const r = feedbackStateSchema.safeParse("nope");
    expect(r.success).toBe(false);
  });
});
```

Run:

```bash
cd /home/pedro/Projetos/EngFlow && bun test packages/contracts/src/schemas.test.ts
```

Expected: **FAIL** — cannot find `./schemas.ts` or import errors.

- **Step 3: Implement `schemas.ts` to pass tests**

Criar `packages/contracts/src/schemas.ts`:

```typescript
import { z } from "zod";

/** Aligns with PRD widget severity / engine state (internal enum). */
export const feedbackStateSchema = z.enum([
  "correct",
  "small_issue",
  "strong_issue",
]);

export const normalizedPromptEventSchema = z.object({
  event_type: z.string(),
  source: z.string(),
  session_id: z.string(),
  project_path: z.string(),
  prompt_text: z.string(),
  timestamp: z.string(),
});

export const promptFeedbackSchema = z.object({
  state: feedbackStateSchema,
  fragment_before: z.string(),
  fragment_after: z.string(),
  tip: z.string(),
  category: z.string(),
});

export const widgetFeedbackEventSchema = z.object({
  state: feedbackStateSchema,
  display_text: z.string(),
  tip: z.string(),
  category: z.string(),
  can_pin: z.boolean(),
  auto_open: z.boolean(),
});

export type NormalizedPromptEvent = z.infer<typeof normalizedPromptEventSchema>;
export type PromptFeedback = z.infer<typeof promptFeedbackSchema>;
export type WidgetFeedbackEvent = z.infer<typeof widgetFeedbackEventSchema>;

export function parseNormalizedPromptEvent(
  raw: unknown,
): z.SafeParseReturnType<unknown, NormalizedPromptEvent> {
  return normalizedPromptEventSchema.safeParse(raw);
}
```

Atualizar `packages/contracts/package.json` `exports` se necessário — manter `"."` → `./src/schemas.ts`.

Run:

```bash
cd /home/pedro/Projetos/EngFlow && bun test packages/contracts/src/schemas.test.ts
```

Expected: **PASS**

- **Step 4: Full test + typecheck**

```bash
cd /home/pedro/Projetos/EngFlow && bun test && bun run check
```

Expected: all tests pass; `tsc` exits 0.

- **Step 5: Commit**

```bash
git add packages/contracts/
git commit -m "feat(contracts): add PRD-aligned Zod schemas and tests"
```

---

### Task 3: Phase C — NDJSON UNIX socket daemon + tests (TDD)

**Files:**

- Create: `/home/pedro/Projetos/EngFlow/packages/daemon/src/ndjson-socket.ts`
- Create: `/home/pedro/Projetos/EngFlow/packages/daemon/src/ndjson-socket.test.ts`

**Behavior:**

- `startNdjsonSocketServer({ socketPath, onValid, onInvalid })` cria `createServer` UNIX, escuta `socketPath`.
- Cada conexão: acumular buffer, split por `\n`, para cada linha não vazia: `JSON.parse` → se throw chama `onInvalid(error, line)`; senão `parseNormalizedPromptEvent` → failure chama `onInvalid(zodError, line)`; success chama `onValid(data)`.
- Retorno: `{ server, listen(): Promise<void>, close(): Promise<void> }` onde `close` remove o socket path com `fs.unlink` em erro ignorado após `server.close`.
- **Step 1: Write failing integration test**

Criar `packages/daemon/src/ndjson-socket.test.ts`:

```typescript
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
```

Run:

```bash
cd /home/pedro/Projetos/EngFlow && bun test packages/daemon/src/ndjson-socket.test.ts
```

Expected: **FAIL** — module missing or exports wrong.

- **Step 2: Implement `ndjson-socket.ts`**

Criar `packages/daemon/src/ndjson-socket.ts`:

```typescript
import { createServer, type Socket } from "node:net";
import { unlink } from "node:fs/promises";
import type { NormalizedPromptEvent } from "@engflow/contracts";
import { parseNormalizedPromptEvent } from "@engflow/contracts";

export type NdjsonSocketHandlers = {
  onValid: (event: NormalizedPromptEvent) => void;
  onInvalid: (error: unknown, line: string) => void;
};

export type NdjsonSocketServer = {
  listen: () => Promise<void>;
  close: () => Promise<void>;
};

export function startNdjsonSocketServer(options: {
  socketPath: string;
} & NdjsonSocketHandlers): NdjsonSocketServer {
  const server = createServer((socket: Socket) => {
    let buffer = "";
    socket.on("data", (chunk: Buffer | string) => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (line.length === 0) continue;
        let raw: unknown;
        try {
          raw = JSON.parse(line) as unknown;
        } catch (e) {
          options.onInvalid(e, line);
          continue;
        }
        const parsed = parseNormalizedPromptEvent(raw);
        if (!parsed.success) {
          options.onInvalid(parsed.error, line);
          continue;
        }
        options.onValid(parsed.data);
      }
    });
  });

  const listen = () =>
    new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.socketPath, () => {
        server.off("error", reject);
        resolve();
      });
    });

  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      unlink(options.socketPath).catch(() => {});
    });

  return { listen, close };
}
```

Run:

```bash
cd /home/pedro/Projetos/EngFlow && bun test packages/daemon/src/ndjson-socket.test.ts
```

Expected: **PASS**

- **Step 3: Run full suite + check**

```bash
cd /home/pedro/Projetos/EngFlow && bun test && bun run check
```

Expected: all green.

- **Step 4: Commit**

```bash
git add packages/daemon/
git commit -m "feat(daemon): add NDJSON unix socket server with validation"
```

---

## Self-review (spec coverage)


| PRD / requisito                                                            | Task                              |
| -------------------------------------------------------------------------- | --------------------------------- |
| TypeScript + Bun                                                           | Task 1                            |
| Zod validation                                                             | Task 2                            |
| Contratos `NormalizedPromptEvent`, `PromptFeedback`, `WidgetFeedbackEvent` | Task 2                            |
| UNIX socket IPC                                                            | Task 3                            |
| JSON simples (NDJSON), não JSON-RPC                                        | Task 3                            |
| Eventos inválidos não derrubam o daemon                                    | Task 3 test + try/catch por linha |


**Gaps intencionais (fora de A+B+C):** OpenCode adapter, `CorrectionEngine`, Quickshell, CLI `status`/`diagnostics`, emissão real de `WidgetFeedbackEvent` — ficam para planos seguintes.

**Placeholder scan:** Nenhum TBD; passos incluem código e comandos esperados.

**Type consistency:** `feedbackStateSchema` partilhado entre `PromptFeedback` e `WidgetFeedbackEvent`; `parseNormalizedPromptEvent` único ponto de entrada no daemon.

---

## Execution handoff

**Plano guardado em:** `docs/superpowers/plans/2026-04-06-initial-setup-abc.md`.

**Duas opções de execução:**

1. **Subagent-driven (recomendado)** — um subagent por task (1→2→3), revisão entre tasks.
2. **Inline execution** — executar os passos nesta sessão com checkpoints após cada task.

**Qual abordagem queres usar?**