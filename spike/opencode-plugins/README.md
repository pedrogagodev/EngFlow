# OpenCode plugin — EngFlow hook spike

Este diretório contém o plugin de **diagnóstico** descrito em `docs/plans/2026-04-06-opencode-adapter-spike-design.md`. Serve apenas para descobrir **qual hook** dispara quando envias um prompt no TUI e que **payload** chega.

## Ficheiro de log (TUI “ocupa” o terminal)

Cada disparo de hook acrescenta **uma linha NDJSON** em:

`~/.config/opencode/engflow-spike.log`

Assim podes usar **outro terminal** com `tail -f` enquanto o OpenCode corre no primeiro — não precisas de ver logs no mesmo ecrã que o TUI.

## Passo a passo para testar

1. **Atualiza o plugin** no sítio onde o OpenCode o carrega (copia por cima do ficheiro antigo):
   ```bash
   cp /caminho/para/EngFlow/spike/opencode-plugins/engflow-spike.ts ~/.config/opencode/plugins/engflow-spike.ts
   ```
2. **Terminal A — seguir o log** (deixa a correr):
   ```bash
   touch ~/.config/opencode/engflow-spike.log
   tail -f ~/.config/opencode/engflow-spike.log
   ```
   (Opcional: `rm ~/.config/opencode/engflow-spike.log` antes do teste para começar com ficheiro vazio.)
3. **Terminal B — arrancar o OpenCode** como habitualmente (`opencode`, etc.). O TUI pode “prender” este terminal; é normal.
4. No OpenCode, **abre uma sessão** e envia um **prompt único**, por exemplo: `ENGFLOW_HOOK_TEST_2026_04_06_alpha`.
5. Olha para o **Terminal A**: devem aparecer linhas JSON com `"hook":"..."`. Anota qual `hook` aparece **no momento em que envias** o prompt e se o `payload` contém o texto do prompt / ids de sessão.
6. **Opcional:** `opencode --version` (ou o comando que a tua instalação use) para registar a versão ao lado dos achados.

Se o Terminal A **ficar sem linhas novas** ao enviar o prompt, o plugin pode não estar a carregar (caminho errado, export, ou versão do OpenCode). Confere a [documentação de plugins](https://open-code.ai/en/docs/plugins).

## Instalação (primeira vez)

1. Copia `engflow-spike.ts` para uma das localizações que o OpenCode carrega automaticamente:
   - **Global:** `~/.config/opencode/plugins/engflow-spike.ts`
   - **Por projeto:** `<repo>/.opencode/plugins/engflow-spike.ts`
2. Reinicia o OpenCode (o TUI carrega plugins no arranque).

Se o plugin não for reconhecido, confirma na [documentação de plugins](https://open-code.ai/en/docs/plugins) da tua versão do OpenCode (nome do export, pastas, `opencode.json`).

## Hooks instrumentados

| Hook              | Uso no spike                          |
| ----------------- | ------------------------------------- |
| `tui.command.execute` | Candidato a “executei comando / enviei” |
| `tui.prompt.append` | Mudanças no buffer do prompt          |
| `message.updated` | Atualização de mensagens              |
| `session.updated` | Atualização de sessão                 |
| `event`           | Evento genérico (inclui `session.idle`, etc.) |

Cada disparo regista `directory`, `worktree` (do contexto do plugin) e o payload serializado de forma segura (sem rebentar com referências circulares).

## Onde ver os logs

1. **`~/.config/opencode/engflow-spike.log`** — principal para o spike (`tail -f` noutro terminal).
2. **`client.app.log`** — se existir, em paralelo; o destino depende da instalação.
3. Se não houver `client.app.log`, o plugin ainda escreve para **stderr** com prefixo `[engflow-spike]` (difícil de ver com o TUI no mesmo terminal).

## Procedimento manual (plano §3)

1. Abre uma sessão no TUI.
2. Envia um **prompt curto e único** (para o identificares nos logs).
3. Observa **qual hook** e **ordem** batem com o envio.
4. Anota a versão do OpenCode (`opencode --version` ou equivalente).
5. Guarda 1–2 payloads **anonimizados** para fixtures futuras do adapter (não commits com dados sensíveis).

## Critérios de saída

Quando tiveres a regra “usamos o hook **H** com campos **A, B, C**”, atualiza o plano ou um doc de descoberta no repositório com essa conclusão e encerra o spike do ponto de vista de investigação.
