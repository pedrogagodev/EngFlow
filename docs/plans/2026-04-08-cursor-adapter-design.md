# Design: adapter Cursor 3 para analise de prompt no widget

## Objetivo

Adicionar um novo `adapter-cursor` para o Cursor 3 (Agents) que capture cada prompt enviado e encaminhe para o daemon no mesmo contrato do `adapter-opencode`, sem alterar o widget.

Experiencia alvo: voce usa o Cursor normalmente, envia o prompt, e o widget atual recebe a analise automaticamente.

## Escopo do MVP

Inclui:

- captura de eventos de prompt via hook `beforeSubmitPrompt`
- normalizacao para o envelope `prompt_event` ja aceito no daemon
- envio via socket Unix NDJSON reutilizando o fluxo existente
- analise para todos os prompts validos (sempre)
- logs tecnicos para observabilidade local

Nao inclui:

- escrever respostas de volta no chat do Cursor
- alterar UI/UX do widget
- heuristicas de severidade para decidir quando mostrar
- integracao por IPC interno privado do Cursor

## Abordagens consideradas

### Recomendada (escolhida): hook direto `beforeSubmitPrompt`

Capturar o payload oficial do hook e enviar imediatamente ao daemon como `prompt_event`.

Motivos:

- mais estavel que tail de logs
- menor latencia
- baixo acoplamento com internals do app desktop
- encaixa no pipeline ja funcionando com widget

Trade-off:

- depende da configuracao de hook estar ativa no ambiente

### Alternativas nao escolhidas

1. Tail de logs do Cursor:
  - pro: simples para spike
  - contra: parser fragil a mudanca de formato e maior latencia
2. Interceptacao de IPC/socket interno do Cursor:
  - pro: potencial de integracao profunda
  - contra: alta complexidade e risco para MVP

## Arquitetura

Fluxo ponta a ponta:

1. Usuario envia prompt no Cursor Agents.
2. Hook `beforeSubmitPrompt` dispara com payload do evento.
3. `adapter-cursor` valida e normaliza para `prompt_event`.
4. Adapter envia NDJSON no socket do daemon.
5. Daemon processa com `CorrectionEngine`.
6. Widget (ja existente) recebe feedback e renderiza.

Principio central: o adapter so faz captura, normalizacao e entrega. Nao decide analise nem comportamento visual.

## Componentes

### 1) Ingestao do hook

Responsabilidades:

- receber payload do `beforeSubmitPrompt`
- validar campos minimos
- ignorar eventos que nao sejam de prompt

Regras:

- processar apenas quando `hook_event_name === "beforeSubmitPrompt"`
- exigir `prompt` nao vazio
- aceitar `composer_mode` e metadados de contexto quando disponiveis

### 2) Normalizacao

Converter payload do Cursor para envelope padrao:

```json
{
  "type": "prompt_event",
  "payload": {
    "source": "cursor",
    "text": "<prompt>",
    "mode": "<composer_mode>",
    "workspace": "<workspace_path>",
    "session_id": "<session_id>",
    "event_id": "<id>",
    "created_at": "<iso8601>"
  }
}
```

Observacoes:

- `event_id` pode ser UUID ou hash deterministico
- manter nomes e estrutura alinhados ao contrato atual do daemon

### 3) Transporte

Responsabilidades:

- enviar uma linha NDJSON por evento
- reutilizar o sender/socket client ja consolidado
- tratar erro sem interromper o fluxo do Cursor

Comportamento em falha:

- logar erro detalhado
- nao bloquear o envio do prompt no Cursor
- encerrar sem causar erro funcional para o usuario

## Contrato e compatibilidade

- Reutilizar o envelope existente `prompt_event`.
- Introduzir somente `source: "cursor"` como novo origin.
- Nao exigir alteracao no widget.
- Daemon deve continuar aceitando outras origens (`opencode`) sem regressao.

## Erros e resiliencia

Casos esperados:

- payload invalido: `warn` e descarte
- evento nao suportado: `info/debug` e descarte
- falha de socket: `error` com contexto e retorno seguro
- daemon indisponivel: nao bloquear o fluxo de chat no Cursor

Objetivo de resiliencia:

- falha do adapter nunca pode quebrar a interacao principal do usuario no Cursor

## Observabilidade

Registrar logs estruturados com:

- `ts`
- `level`
- `event`
- `source`
- `workspace`
- `session_id`
- `event_id`
- `result`

Sugestao de arquivo:

- `adapter-cursor.log` (ou canal de log ja padronizado no projeto)

## Testes

### Unitarios (Bun)

1. normalizacao de `beforeSubmitPrompt` para `prompt_event`
2. filtro de eventos nao suportados
3. validacao de prompt vazio/invalido

### Integracao

1. envio NDJSON para socket fake
2. erro de conexao nao interrompe execucao do hook
3. daemon recebe envelope esperado

### Smoke manual

1. iniciar daemon e widget
2. enviar prompt no Cursor Agents
3. confirmar evento capturado no log do adapter
4. confirmar feedback renderizado no widget

## Criterios de sucesso (MVP)

- todo prompt enviado no Cursor gera tentativa de `prompt_event`
- widget recebe feedback sem mudanca de UI
- falhas do adapter nao interrompem uso do Cursor
- testes relevantes passam com `bun test`

## Plano de implementacao

1. Criar pacote/modulo `adapter-cursor` com parser de hook.
2. Reaproveitar sender NDJSON existente (fatorar util comum se necessario).
3. Integrar script de hook `beforeSubmitPrompt` ao novo adapter.
4. Adicionar logs estruturados e mensagens de erro claras.
5. Escrever testes unitarios e de integracao.
6. Executar smoke test com Cursor desktop + daemon + widget.
7. Documentar setup e diagnostico rapido.

## Fora do MVP (proximas fases)

- canal bidirecional (acoes de volta para chat/composer)
- enriquecimento da analise com contexto adicional do editor
- controles avancados de deduplicacao e politicas de rate-limit

