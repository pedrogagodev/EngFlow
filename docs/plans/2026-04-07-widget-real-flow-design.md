# Design: widget conectado ao fluxo real (fase A)

## Objetivo

Conectar o `widget` ao fluxo real do app sem acoplar ainda comandos de volta (`pin`/`dismiss`). Nesta fase A, o widget passa a consumir `WidgetFeedbackEvent` real vindo do daemon via Unix socket NDJSON, conforme PRD, com cliente de socket no host/runtime do Quickshell (sem bridge por arquivo).

## Escopo desta fase

Inclui:

- consumo real de eventos no widget
- daemon emitindo `WidgetFeedbackEvent` para assinantes
- protocolo mínimo de assinatura no mesmo socket
- tratamento de falhas sem quebrar o loop
- politica de `auto_open` com respeito a intencao local do usuario

Não inclui:

- persistencia/historico
- replay de eventos antigos
- canal de comando `pin`/`dismiss` para o daemon
- segundo socket dedicado para widget
- bridge por arquivo NDJSON para alimentar QML

## Abordagens consideradas

### Recomendada (escolhida): socket unico com multiplex por `type`

Usar o socket Unix atual para:

- entrada: `prompt_event` (adapter -> daemon)
- controle: `subscribe_widget` (widget -> daemon)
- saida: `widget_feedback` (daemon -> widget)

Motivos:

- maior aderencia ao PRD event-driven
- valida o caminho real ponta a ponta cedo
- evita caminho temporario que vira divida tecnica
- reaproveita base ja implementada no daemon/testes

Trade-off:

- requer envelope minimo de mensagem para distinguir direcao/tipo

### Alternativas nao escolhidas

1. Socket separado para widget (`engflow-widget.sock`):
  - pro: separacao clara
  - contra: complexidade operacional extra em V1-A
2. Arquivo/IPC temporario:
  - pro: implementacao rapida
  - contra: desalinha com PRD e exige migracao depois

## Contrato de mensagens NDJSON

Envelope unico:

```json
{ "type": "<message_type>", "payload": { "...": "..." } }
```

Tipos na fase A:

- `prompt_event`: `payload` segue `NormalizedPromptEvent`
- `subscribe_widget`: `payload` pode ser vazio (`{}`)
- `widget_feedback`: `payload` segue `WidgetFeedbackEvent`
- `error` (opcional): mensagem tecnica para cliente

### Regras de compatibilidade

- Mensagens com `type` desconhecido devem ser ignoradas por clientes.
- `payload` deve ser validado conforme schema de cada tipo.
- Uma linha NDJSON = uma mensagem completa.

## Arquitetura e componentes

### Daemon

Responsabilidades:

1. manter parser NDJSON e validacao de entrada
2. rotear `prompt_event` para pipeline de correcao
3. registrar sockets assinados ao receber `subscribe_widget`
4. broadcast de `widget_feedback` para assinantes ativos
5. remover sockets com erro/close sem derrubar processo

Mudancas esperadas:

- adicionar registry em memoria (`Set<Socket>`) para assinantes
- transformar `PromptFeedback` -> `WidgetFeedbackEvent`
- emitir `widget_feedback` apos cada resultado
- manter comportamento resiliente em JSON/schema invalidos

### Widget (Quickshell + host runtime)

Responsabilidades:

1. host/runtime conecta no socket Unix do daemon
2. host/runtime envia `subscribe_widget` uma vez por conexao
3. host/runtime le stream NDJSON continuamente e reconecta em falha
4. host/runtime aplica estado recebido nas props visuais:
  - `feedbackState <- state`
  - `displayText <- display_text`
  - `tipText <- tip`
  - `categoryText <- category`
  - `canPin <- can_pin`
5. QML permanece focado em renderizacao e interacao local

Notas:

- `auto_open` segue politica de abertura respeitando intencao local:
  - abre automaticamente somente se nao estiver pinned e nao tiver sido fechado manualmente
  - se foi fechado manualmente, nao reabre sozinho
  - se estiver pinned, apenas atualiza conteudo mantendo visivel
- nesta fase, clicks de `pin`/`dismiss` nao disparam comando no backend.

## Fluxo de dados

1. Adapter envia `prompt_event`.
2. Daemon valida e processa com `CorrectionEngine`.
3. Daemon mapeia resultado para `widget_feedback`.
4. Daemon envia para assinantes registrados.
5. Widget recebe e renderiza imediatamente.

## Falhas e comportamento esperado

- JSON invalido: log e descarte, sem crash.
- Schema invalido: log estruturado e descarte, sem crash.
- Tipo de envelope desconhecido: descartar e seguir stream.
- Falha no `CorrectionEngine`: emitir card neutro/fallback para manter UX consistente.
- Sem assinantes: processamento segue normal; apenas sem entrega visual.
- Assinante desconectado: remover do registry e continuar broadcast para os demais.
- Queda de conexao do widget: host/runtime reconecta com backoff curto e reenvia `subscribe_widget`.

## Estrategia de testes para fase A

1. `prompt_event` valido percorre pipeline sem erro.
2. evento invalido e rejeitado sem crash do daemon.
3. apos `subscribe_widget`, cliente recebe `widget_feedback`.
4. payload emitido respeita schema `WidgetFeedbackEvent`.
5. desconexao de assinante nao afeta processamento futuro.
6. erro do `CorrectionEngine` gera fallback emitido ao widget.
7. host/runtime reconecta e volta a receber eventos apos indisponibilidade temporaria.
8. politica de `auto_open` respeita fechamento manual/pinned.

## Criterio de pronto (DoD) da fase A

- widget deixa de depender de bridge por arquivo e consome socket real no host/runtime.
- daemon publica `widget_feedback` real no socket Unix apos correcao.
- pipeline segue resiliente a entradas invalidas e quedas de cliente.
- testes cobrindo contratos e comportamento principal passam com `bun test`.

## Plano de implementacao (execucao)

### Fase 0 - Preparacao e guardrails

Objetivo: garantir base estavel antes de mover integracao do widget.

Tarefas:

1. Confirmar que os testes atuais do daemon continuam verdes apos mudancas de envelope.
2. Registrar contrato de mensagens no codigo (tipos/envelopes), evitando regressao para payload cru.
3. Marcar a bridge por arquivo como legado de desenvolvimento (nao caminho oficial).

Arquivos alvo:

- `packages/adapter-opencode/src/send-line.ts`
- `packages/adapter-opencode/src/send-line.test.ts`
- `packages/daemon/src/ndjson-socket.ts`
- `packages/daemon/src/ndjson-socket.test.ts`

Validacao:

- `bun test packages/adapter-opencode/src/send-line.test.ts`
- `bun test packages/daemon/src/ndjson-socket.test.ts`

### Fase 1 - Runtime host com socket real

Objetivo: substituir ingestao por arquivo por cliente socket no host/runtime do Quickshell.

Tarefas:

1. Implementar cliente socket no runtime do widget com:
  - conexao ao socket Unix do daemon
  - envio de `subscribe_widget` no connect
  - leitura de stream NDJSON com buffer por linha
  - backoff de reconexao curto
2. Expor para QML um canal de eventos pronto (ex.: sinal/event emitter) recebendo somente payload validado de `widget_feedback`.
3. Remover dependencia de polling de arquivo no `Main.qml`.
4. Manter fallback de estado visual default quando nao houver eventos.

Arquivos alvo:

- `widget/quickshell/Main.qml`
- `widget/quickshell/RuntimeEventBridge.qml`
- runtime host do Quickshell (novo/ajuste no ponto de bootstrap do widget)
- `widget/runtime/widget-runtime-bridge.ts` (depreciar ou remover do fluxo principal)

Validacao:

- iniciar daemon
- iniciar widget com runtime host real
- enviar `prompt_event` de teste e observar atualizacao imediata na UI

### Fase 2 - Politica de `auto_open` e estado local

Objetivo: aplicar comportamento de abertura alinhado a UX definida.

Tarefas:

1. Introduzir estado local minimo no host:
  - `isPinned`
  - `isVisible`
  - `lastCloseReason` (`manual` | `auto`)
2. Aplicar regra:
  - `auto_open: true` abre somente se nao estiver pinned e nao houver fechamento manual ativo
  - fechamento manual bloqueia reabertura automatica
  - pinned mantem visivel e recebe atualizacao de conteudo
3. Preservar separacao: host decide visibilidade; QML decide renderizacao.

Arquivos alvo:

- runtime host do Quickshell (controle de janela/visibilidade)
- `widget/quickshell/Main.qml` (bindings/sinais de interacao)
- `widget/quickshell/EngFlowWidget.qml` (sem mudar contrato visual)

Validacao:

- simular eventos com `auto_open` true/false
- validar cenarios de fechado manualmente, pinned e reabertura permitida

### Fase 3 - Testes de integracao ponta a ponta

Objetivo: cobrir fluxo feliz e resiliencia em execucao real.

Tarefas:

1. Testes daemon (ja existentes + complementos):
  - subscribe + broadcast
  - unknown type sem crash
  - limpeza de assinante desconectado
2. Testes runtime host:
  - parse por linha NDJSON
  - ignorar mensagens nao `widget_feedback`
  - reconectar e reassinar apos queda
3. Smoke test manual:
  - adapter -> daemon -> widget com atualizacao visual em tempo real.

Arquivos alvo:

- `packages/daemon/src/ndjson-socket.test.ts`
- testes do runtime host (novo arquivo no pacote do widget/runtime)
- `widget/README.md` (passo a passo atualizado sem bridge por arquivo)

Validacao:

- `bun test` nos pacotes alterados
- checklist manual de smoke test

### Fase 4 - Limpeza e hardening

Objetivo: remover caminho temporario e reduzir risco de manutencao.

Tarefas:

1. Remover ou isolar definitivamente a bridge por arquivo do caminho principal.
2. Revisar logs tecnicos para debug de reconexao/protocolo.
3. Atualizar documentacao com fluxo oficial (socket unico, host runtime).

Arquivos alvo:

- `widget/runtime/widget-runtime-bridge.ts` (remocao ou status legacy explicito)
- `widget/README.md`
- `docs/plans/2026-04-07-widget-real-flow-design.md`

Validacao:

- executar setup limpo seguindo apenas README atualizado
- confirmar que fluxo funciona sem qualquer dependencia de arquivo NDJSON intermediario

### Ordem recomendada de execucao

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4

### Riscos e mitigacoes

- Risco: regressao de contrato NDJSON por mudanca ad-hoc no cliente.
  - Mitigacao: manter parser central por envelope `type` e testes de contrato.
- Risco: loop de reconexao agressivo no host.
  - Mitigacao: backoff progressivo curto com teto.
- Risco: `auto_open` gerar UX intrusiva.
  - Mitigacao: regra de respeito ao fechamento manual/pinned + teste de cenarios.

## Proximos passos (fora da fase A)

- implementar comandos de retorno para `pin`/`dismiss` (fase B/C).
- decidir se manter socket unico ou separar canais quando houver mais consumidores.
- evoluir CLI (`status`/`diagnostics`) para inspecionar assinantes e ultimo evento.

