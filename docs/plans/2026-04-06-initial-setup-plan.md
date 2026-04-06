# Plano: setup inicial do EngFlow

**Fonte de verdade:** `engflow-prd-v1-v2.md` (escopo V1/V2 e decisões de arquitetura).

**Objetivo deste documento:** servir de mapa desde o *bootstrap* do repo até o loop V1 descrito no PRD. **Importante:** “setup inicial” em sentido estrito **não** é a V1 inteira — ver secção 1.1.

### 1.1 Setup inicial vs implementação V1


|                       | **Setup inicial (estrito)**                                                                                                 | **Resto da V1 (PRD)**                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O quê**             | Toolchain, estrutura do repo, contratos Zod, opcionalmente um daemon/socket mínimo que valida JSON e não faz produto ainda. | Daemon completo, `CorrectionEngine` + OpenAI, adapter OpenCode, widget Quickshell com UX do PRD, CLI `status`/`diagnostics`, testes de fronteira. |
| **Fases neste plano** | **A** e **B**; **C** só como stub (“socket aceita evento válido e loga”) se quiseres fechar o bootstrap num único PR.       | **C** a **G** como trabalho de produto, não de “só configurar o projeto”.                                                                         |
| **Critério**          | Outra pessoa clona o repo, corre `bun install` / `bun test`, vê pastas e contratos alinhados ao PRD.                        | O loop *prompt → evento → correção → widget* funciona de ponta a ponta no teu ambiente.                                                           |


O documento original listava A–G sob o título “setup inicial”; na prática **A–G juntos cobrem a maior parte da entrega V1**, não apenas o primeiro dia de projeto. Usa **A–B** (e no máximo **C** leve) como definição de *setup inicial*; trata **D–G** como milestones da implementação V1.

---

## 1. Escopo: o que é “setup inicial” e o que é V1

### Setup inicial (estrito) — alvo depois do `bun init`

- **TypeScript + Bun** configurados (strict onde fizer sentido), scripts `test` / `check`.
- **Estrutura de pastas** que reserve lugar a contratos, daemon, correction, adapter, widget (mesmo que pastas vazias ou um único pacote com `src/` bem partido).
- **Contratos Zod** para `NormalizedPromptEvent`, `PromptFeedback`, `WidgetFeedbackEvent` conforme PRD, com testes de serialização.
- Opcional neste marco: **socket UNIX mínimo** que lê JSON, valida com Zod, rejeita lixo sem crash (pipeline interno ainda pode ser no-op).

### Resto da V1 (PRD) — não confundir com “só setup”

Isto são milestones de produto (**fases C–G**): daemon completo, `CorrectionEngine` + OpenAI, adapter OpenCode, widget Quickshell com UX (estados, pin, dismiss), CLI operacional, testes de fronteira listados no PRD. É o trabalho que entrega o loop real; ocupa semanas, não uma tarde de bootstrap.

### Fora de escopo (V1/V2 conforme PRD)

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

## 3. Fases e entregáveis (A–G = roadmap V1; A–B = setup inicial estrito)


| Fase                      | Entregável                                                                            | Critério de pronto                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **A — Toolchain**         | `package.json`, Bun, TS strict, scripts `dev`/`test`/`check`                          | `bun test` roda (mesmo que smoke).                                                            |
| **B — Contratos**         | Schemas Zod + tipos inferidos, export único para daemon/adapter/widget                | Serialização/deserialização redonda nos três contratos do PRD.                                |
| **C — Daemon + socket**   | Servidor UNIX socket, parse JSON, validação, log estruturado de rejeições             | Evento inválido não crasha; evento válido dispara pipeline (stub).                            |
| **D — CorrectionEngine**  | Interface + implementação OpenAI (env `OPENAI_API_KEY`), fallback seguro em falha     | Retorno validado como `PromptFeedback`; falha → caminho para cartão neutro (contrato widget). |
| **E — Adapter OpenCode**  | Documentar origem dos eventos OpenCode; normalizar para `NormalizedPromptEvent`       | Testes com payloads de exemplo; sem vazar detalhes do OpenCode no daemon.                     |
| **F — Widget Quickshell** | Card com hierarquia do PRD (estado → texto → tip → categoria), pin/dismiss, auto-open | Estados Correct / Small issue / Strong issue + fallback neutro.                               |
| **G — CLI**               | Comandos mínimos de operação                                                          | `status` mostra se o socket/daemon está utilizável; `diagnostics` útil para suporte local.    |


Ordem recomendada: **A → B → C → D** em paralelo com pesquisa leve em **E**; **F** assim que houver `WidgetFeedbackEvent` estável; **G** quando o daemon existir.

---

## 4. Configuração e segredos

- Caminho do socket: variável de ambiente ou ficheiro de config em XDG (ex. `~/.config/engflow/`), documentado no README do setup.
- `OPENAI_API_KEY` apenas para o processo do daemon (nunca commitar).
- Nenhuma credencial no repositório; `.env.example` com chaves fictícias.

---

## 5. Risco e mitigação


| Risco                                                | Mitigação                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| API do OpenCode para eventos ainda pouco documentada | Adapter isolado + testes com fixtures; daemon só vê `NormalizedPromptEvent`. |
| Quickshell vs versão do sistema                      | Fixar na documentação a versão mínima testada no Arch.                       |
| Escopo a derivar para SQLite “já que é fácil”        | Revisar este plano e o PRD antes de qualquer migration.                      |


---

## 6. Próximo passo após o setup inicial (A–B)

Fechar contratos e estrutura, depois seguir as fases **C–G** como implementação da V1 (não como “setup”). Preparar V2 só ao nível de interfaces (ex. nenhum storage obrigatório em V1).

---

## 7. Dependências a instalar

### Sistema (Arch Linux — ajustar noutras distros)


| Dependência            | Para quê                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Bun**                | Runtime e gestor de pacotes do projeto (PRD). [Instalação oficial](https://bun.sh/docs/installation).                                                                                                        |
| **Quickshell**         | Camada de widget flutuante (PRD). No Arch costuma ser via **AUR** (ex. pacote `quickshell` ou `quickshell-git`); confirmar o nome atual em [quickshell](https://quickshell.outfoxxed.me/) / wiki do projeto. |
| **Hyprland + Wayland** | Ambiente alvo (já assumido no PRD; não é dependência de *build* do repo).                                                                                                                                    |
| **git**                | Controlo de versões.                                                                                                                                                                                         |


Opcional para desenvolvimento: **curl** ou **wget** para scripts de instalação do Bun; **jq** para inspecionar JSON no terminal ao testar o socket.

### Projeto (npm/bun — adicionar quando existir `package.json`)


| Pacote                 | Para quê                                                                    |
| ---------------------- | --------------------------------------------------------------------------- |
| **typescript** (`dev`) | Compilação / tipos do projeto TS.                                           |
| **zod**                | Validação dos contratos internos (PRD).                                     |
| **openai**             | SDK oficial para a primeira implementação de `CorrectionEngine` com OpenAI. |


O runner de testes pode ser o **built-in `bun:test`** do Bun (sem obrigar Vitest/Jest no setup inicial).

### Variáveis de ambiente

- `OPENAI_API_KEY` — obrigatória para testes reais da correção (não versionar).

### O que *não* é dependência de V1 neste plano

- Cliente SQLite / ORM (V2).
- JSON-RPC, gRPC extra.

