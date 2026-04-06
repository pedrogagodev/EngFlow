# Plano: setup inicial do EngFlow

**Fonte de verdade:** `engflow-prd-v1-v2.md` (escopo V1/V2 e decisões de arquitetura).

**Objetivo deste documento:** definir o que compõe o *setup inicial* do repositório e da toolchain — o mínimo necessário para começar a implementar o loop V1 (adapter → daemon → correção → widget) sem antecipar V2 (histórico, SQLite, OpenTUI).

---

## 1. Escopo do setup inicial

### Dentro do escopo

- Repositório **TypeScript** com runtime **Bun** e estrutura de pastas que separe claramente: contratos, daemon, engine de correção, adapter OpenCode, apresentação Quickshell.
- **Contratos internos** versionados no código, validados com **Zod** (`NormalizedPromptEvent`, `PromptFeedback`, `WidgetFeedbackEvent` — campos conforme PRD).
- **Daemon** esqueleto: escuta em **Unix domain socket**, aceita JSON linha a linha ou mensagens delimitadas (definir no primeiro PR técnico), valida entrada, rejeita inválidos sem derrubar o processo.
- **CorrectionEngine** como interface; primeira implementação **OpenAI** atrás da interface (pode retornar stub até a prompt estiver fechada).
- **CLI mínima** (`status`, `diagnostics` ou equivalente) para operar e depurar o daemon localmente.
- **Widget Quickshell** como projeto ou subpasta separada do pacote TS, integrada ao desktop alvo (Arch + Hyprland).
- **Testes** focados em contratos e fronteiras (adapter → evento normalizado; eventos inválidos; saída da engine; geração do payload do widget), usando o runner do Bun.

### Fora do escopo (neste setup)

- Persistência / SQLite / histórico (V2).
- Adapter Zed ou Cursor.
- OpenTUI, analytics, spaced repetition.
- JSON-RPC no socket (PRD: JSON simples, não JSON-RPC).

---

## 2. Estrutura de repositório sugerida

Ajustável na implementação; o importante é manter fronteiras:

```
engflow/
  packages/
    contracts/      # tipos + schemas Zod compartilhados
    daemon/         # processo long-running, socket, orquestração
    correction/     # CorrectionEngine + provider OpenAI
    adapter-opencode/  # normalização OpenCode → NormalizedPromptEvent
  widget/           # Quickshell (QML/JS conforme stack do Quickshell)
  apps/cli/         # binário CLI que fala com o daemon (ou entry no daemon)
```

Se preferir monorepo mais simples no início: um único pacote `packages/core` com `src/daemon`, `src/adapter`, `src/correction` e migração para pacotes quando começar a doer — desde que as fronteiras no código permaneçam claras.

---

## 3. Fases e entregáveis

| Fase | Entregável | Critério de pronto |
|------|------------|-------------------|
| **A — Toolchain** | `package.json`, Bun, TS strict, scripts `dev`/`test`/`check` | `bun test` roda (mesmo que smoke). |
| **B — Contratos** | Schemas Zod + tipos inferidos, export único para daemon/adapter/widget | Serialização/deserialização redonda nos três contratos do PRD. |
| **C — Daemon + socket** | Servidor UNIX socket, parse JSON, validação, log estruturado de rejeições | Evento inválido não crasha; evento válido dispara pipeline (stub). |
| **D — CorrectionEngine** | Interface + implementação OpenAI (env `OPENAI_API_KEY`), fallback seguro em falha | Retorno validado como `PromptFeedback`; falha → caminho para cartão neutro (contrato widget). |
| **E — Adapter OpenCode** | Documentar origem dos eventos OpenCode; normalizar para `NormalizedPromptEvent` | Testes com payloads de exemplo; sem vazar detalhes do OpenCode no daemon. |
| **F — Widget Quickshell** | Card com hierarquia do PRD (estado → texto → tip → categoria), pin/dismiss, auto-open | Estados Correct / Small issue / Strong issue + fallback neutro. |
| **G — CLI** | Comandos mínimos de operação | `status` mostra se o socket/daemon está utilizável; `diagnostics` útil para suporte local. |

Ordem recomendada: **A → B → C → D** em paralelo com pesquisa leve em **E**; **F** assim que houver `WidgetFeedbackEvent` estável; **G** quando o daemon existir.

---

## 4. Configuração e segredos

- Caminho do socket: variável de ambiente ou ficheiro de config em XDG (ex. `~/.config/engflow/`), documentado no README do setup.
- `OPENAI_API_KEY` apenas para o processo do daemon (nunca commitar).
- Nenhuma credencial no repositório; `.env.example` com chaves fictícias.

---

## 5. Risco e mitigação

| Risco | Mitigação |
|-------|-----------|
| API do OpenCode para eventos ainda pouco documentada | Adapter isolado + testes com fixtures; daemon só vê `NormalizedPromptEvent`. |
| Quickshell vs versão do sistema | Fixar na documentação a versão mínima testada no Arch. |
| Escopo a derivar para SQLite “já que é fácil” | Revisar este plano e o PRD antes de qualquer migration. |

---

## 6. Próximo passo após este setup

Implementar o loop completo V1 conforme user stories do PRD; preparar V2 apenas com interfaces que não impeçam acrescentar storage depois (ex. injeção de “sink” nulo em V1).

---

## 7. Dependências a instalar

### Sistema (Arch Linux — ajustar noutras distros)

| Dependência | Para quê |
|-------------|----------|
| **Bun** | Runtime e gestor de pacotes do projeto (PRD). [Instalação oficial](https://bun.sh/docs/installation). |
| **Quickshell** | Camada de widget flutuante (PRD). No Arch costuma ser via **AUR** (ex. pacote `quickshell` ou `quickshell-git`); confirmar o nome atual em [quickshell](https://quickshell.outfoxxed.me/) / wiki do projeto. |
| **Hyprland + Wayland** | Ambiente alvo (já assumido no PRD; não é dependência de *build* do repo). |
| **git** | Controlo de versões. |

Opcional para desenvolvimento: **curl** ou **wget** para scripts de instalação do Bun; **jq** para inspecionar JSON no terminal ao testar o socket.

### Projeto (npm/bun — adicionar quando existir `package.json`)

| Pacote | Para quê |
|--------|----------|
| **typescript** (`dev`) | Compilação / tipos do projeto TS. |
| **zod** | Validação dos contratos internos (PRD). |
| **openai** | SDK oficial para a primeira implementação de `CorrectionEngine` com OpenAI. |

O runner de testes pode ser o **built-in `bun:test`** do Bun (sem obrigar Vitest/Jest no setup inicial).

### Variáveis de ambiente

- `OPENAI_API_KEY` — obrigatória para testes reais da correção (não versionar).

### O que *não* é dependência de V1 neste plano

- Cliente SQLite / ORM (V2).
- JSON-RPC, gRPC extra.
