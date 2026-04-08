# Widget (Quickshell)

Primeiro scaffold visual do widget V1, inspirado na referência validada no PRD e guiado por `DESIGN.md`.

## Estrutura

- `quickshell/Theme.qml`: tokens de estilo (cores, raios, espaçamentos)
- `quickshell/EngFlowWidget.qml`: card principal com hierarquia:
  1. estado
  2. texto principal (`display_text`)
  3. tip
  4. categoria
- `quickshell/Main.qml`: preview local para iteração visual

## Mapping de contrato

`EngFlowWidget.qml` já expõe propriedades alinhadas ao `WidgetFeedbackEvent`:

- `feedbackState` (`correct` | `small_issue` | `strong_issue`)
- `displayText`
- `tipText`
- `categoryText`
- `canPin`

E sinais de interação:

- `pinToggled(bool pinned)`
- `dismissRequested()`

## Como testar (passo a passo)

1. Entre na raiz do projeto:
  - `cd /home/pedro/Projetos/EngFlow`
2. Rode um preview rapido com QML puro (modo janela, apenas visual/debug):
  - `qmlscene widget/quickshell/Main.qml`
3. Se estiver em ambiente sem GPU/Wayland (ou CI/headless), use:
  - `QT_QUICK_BACKEND=software qmlscene -platform offscreen widget/quickshell/Main.qml`
4. Edite os valores de exemplo em `widget/quickshell/Main.qml`:
  - `feedbackState`: `correct` | `small_issue` | `strong_issue`
  - `displayText`, `tipText`, `categoryText`
5. Valide comportamento visual esperado:
  - `correct` mostra confirmacao limpa
  - `small_issue`/`strong_issue` destacam cor por severidade
  - formato `antes -> depois` aplica riscado no trecho antigo e verde no corrigido
  - botoes `PIN/UNPIN` e `x` respondem ao clique
6. Runtime real (daemon + host WebSocket), caminho principal — **um terminal** na raiz do repo:
  - `bun run stack`
  - Sobe o daemon e o `widget-runtime-host`; logs no stderr com prefixos `[daemon]` e `[host]`. Encerre com Ctrl+C (SIGINT/SIGTERM encerra os dois processos).
  - Argumentos extras são repassados ao host (ex.: `bun run stack -- --port=4343`).
  - Alternativa manual (dois terminais), se precisar depurar um lado só: `bun run packages/daemon/src/main.ts` e, em outro, `bun widget/runtime/widget-runtime-host.ts --host=127.0.0.1 --port=4242`.
7. Widget (Quickshell ou preview) continua em **outro comando** — não faz parte do `stack` (overlay: ver secao "Overlay real com Quickshell" abaixo). Exemplo preview:
  - `qmlscene widget/quickshell/Main.qml --runtime-ingress=ws --runtime-ws-url=ws://127.0.0.1:4242`
9. O runtime host envia automaticamente `{"type":"subscribe_widget","payload":{}}` ao conectar no socket Unix do daemon e repassa cada evento para o QML via WebSocket.
10. Sem parametros de ingress, `Main.qml` usa `ws` por padrao (`ws://127.0.0.1:4242`).
11. Fluxo legado (somente fallback): `--runtime-ingress=legacy-file` com `widget-runtime-bridge.ts --legacy-output-file=...` mantem polling de arquivo isolado dentro de `RuntimeEventBridge.qml`.

## Overlay real com Quickshell (sem janela tradicional)

Para comportamento de overlay no compositor (similar a popup/notificacao), use o entrypoint Quickshell:

- `qs -p /home/pedro/Projetos/EngFlow/widget/quickshell/shell.qml -- --runtime-ingress=ws --runtime-ws-url=ws://127.0.0.1:4242`

Notas:

- `shell.qml` usa `PanelWindow` com `WlrLayer.Overlay` e `WlrKeyboardFocus.None` (nao rouba foco).
- `Main.qml` permanece como preview local no `qmlscene` e por isso sempre sera uma janela comum.
- A politica on-demand (auto_open/pin/manual close block) e a mesma nos dois caminhos.

## Modo sob demanda (overlay)

O `Main.qml` agora opera em modo overlay sob demanda:

- o widget inicia oculto por padrao (sem preview grande permanente)
- ele abre quando chega `widget_feedback` com `auto_open=true`, se permitido pela politica local
- ele tambem pode iniciar forcado para debug com `--force-visible=true`

Estado local aplicado no shell/UI:

- `isVisible`: visibilidade atual controlada por politica
- `isPinned`: fixado manualmente via botao `PIN`
- `lastCloseReason`: ultimo fechamento (`manual` ou `auto`)
- `manualAutoOpenBlocked`: bloqueio de reabertura automatica apos fechamento manual

Politica de visibilidade:

- `auto_open=true` abre apenas quando `!isPinned` e sem bloqueio manual
- fechar manualmente (`x`) seta bloqueio de autoabertura
- esse bloqueio so e liberado ao ligar manualmente novamente (ex.: iniciar com `--force-visible=true` ou fixar via `PIN`)
- se `pinned`, o widget permanece visivel e apenas atualiza o conteudo
- sem novos eventos, permanece oculto

Logs minimos de depuracao:

- conexao/status de websocket (`[widget][ws]`)
- evento recebido (`[widget][event] widget_feedback`)
- transicoes de visibilidade (`[widget][visibility]`)
- mudanca de pin (`[widget][pin]`)

Exemplo com visibilidade forcada para debug:

- `qmlscene widget/quickshell/Main.qml --runtime-ingress=ws --runtime-ws-url=ws://127.0.0.1:4242 --force-visible=true`
- `qs -p /home/pedro/Projetos/EngFlow/widget/quickshell/shell.qml -- --runtime-ingress=ws --runtime-ws-url=ws://127.0.0.1:4242 --force-visible=true`

## Ingress boundary (fase A)

Objetivo arquitetural da fase A:
- reduzir acoplamento do `Main.qml` com detalhes de transporte/polling
- concentrar parsing/ingestao de evento em `RuntimeEventBridge.qml`
- permitir integracao futura com host runtime/socket sem reescrever o widget visual

Estado atual:
- caminho principal: host dedicado (`widget-runtime-host.ts`) com repasse WebSocket para o QML
- boundary de evento no QML: `ingestEventEnvelope` / `ingestNdjsonChunk` / `ingestNdjsonLine`
- caminho legado: polling de arquivo NDJSON (`legacy-file`) para fallback local

Limitacao atual:
- `qmlscene` puro nao oferece cliente Unix socket integrado neste scaffold, por isso o host dedicado fica responsavel pela conexao Unix e o QML consome via WebSocket local.

## Próximos passos

- ligar `auto_open` ao comportamento real de abertura no host shell (sem backend de pin/dismiss nesta fase)
- refinar pixel-perfect final (ícones e spacing por screenshot comparativa)
- implementar aba `Stats` com dados reais (ou esconder até existir backend)