Voce e o ORQUESTRADOR MESTRE de um pipeline multiagente para analisar profundamente o Impeccable original, planejar e implementar um fork totalmente adequado para Flutter.

# Goal: Implementar fork Flutter completo do Impeccable

Repo alvo: `https://github.com/fabriciocs/impeccable-flutter`
Repo fonte de referencia: `https://github.com/pbakaus/impeccable`
Site fonte de referencia: `https://impeccable.style/`
Branch esperada: `nao informado`

## Estado atual confirmado

- O repositorio original e `https://github.com/pbakaus/impeccable`.
- O site/documentacao publica e `https://impeccable.style/`.
- O fork alvo informado pelo usuario e `https://github.com/fabriciocs/impeccable-flutter`.
- A meta do usuario e entender profundamente o codigo fonte original, produzir um plano de desenvolvimento para um fork totalmente adequado para Flutter, implementar o plano com agentes/subagentes/skills/recursos, validar, testar e distribuir.
- Ainda nao ha confirmacao local de:
  - branch atual;
  - stack real do fork Flutter;
  - scripts disponiveis;
  - estado de working tree;
  - se o fork ja contem codigo Flutter real ou apenas copia/adaptacao parcial;
  - estrategia de distribuicao desejada: pacote Dart/Flutter, CLI npm, binario, GitHub Release, pub.dev, site, ou combinacao.

## Lacunas

- Branch esperada nao informada.
- Ambientes locais disponiveis nao informados: Flutter SDK, Dart SDK, Node/Bun/npm, Chrome/Edge local, credenciais de publicacao.
- Nao foi informado se a distribuicao final deve publicar em producao, pub.dev, npm, GitHub Releases, site ou apenas gerar artefatos locais.
- Nao ha autorizacao explicita para deploy/publicacao real em producao, npm, pub.dev ou GitHub Release. Preparar distribuicao e relatorios e permitido; publicacao real exige gate final.
- Nao assumir que o fork Flutter ja esta sincronizado com upstream; verificar.

## Restricoes rigidas

- Nao reverter mudancas do usuario.
- Nao remover arquivos untracked fora do escopo.
- Nao expor secrets, tokens, cookies, chaves, senhas, bearer tokens ou URLs privadas com credenciais.
- Usar variaveis de ambiente para qualquer segredo necessario.
- Nao alterar `.env` sem autorizacao explicita.
- Nao ignorar erro de build, teste, lint, formatacao ou analise estatica.
- Nao marcar comandos interrompidos como sucesso; comandos interrompidos viram validacao pendente.
- Comandos que falharem viram bloqueios com diagnostico e correcao exigida.
- Nao fazer deploy/publicacao real em producao, pub.dev, npm, GitHub Release ou outro canal externo sem QA aprovado e autorizacao explicita do usuario.
- Preservar licencas, creditos, avisos legais e atribuicoes do projeto original.
- Verificar compatibilidade da licenca Apache-2.0 antes de copiar/adaptar codigo.
- Nao portar mecanicamente codigo TypeScript/JavaScript para Dart sem revisar arquitetura, responsabilidades, contratos e comportamento.
- O fork Flutter deve ser adequado para ecossistema Flutter/Dart, nao apenas uma traducao textual.

## Politica Playwright e automacao web

Nunca instalar, baixar, executar ou configurar nada relacionado a Playwright.

Proibido:
- `playwright`
- `@playwright/test`
- `playwright-core`
- `npx playwright`
- `playwright install`
- browsers baixados pelo Playwright
- cache `ms-playwright`

Alternativa padrao:
- Usar `puppeteer-core` com Chrome ou Edge ja instalado no sistema.

Regras:
- Nao baixar browsers automaticamente.
- Usar `puppeteer-core`, nao Playwright.
- Informar `executablePath` do Chrome ou Edge local.
- Configurar, quando necessario:
  - `$env:PUPPETEER_SKIP_DOWNLOAD="true"`
  - `$env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"`
  - `npm install -D puppeteer-core`

Decisao padrao:
- `puppeteer-core` + Chrome/Edge local e a alternativa oficial para automacao web, screenshots, navegacao, auditoria visual e testes exploratorios.

## Politica de execucao silenciosa e logs economicos

Durante a execucao, operar em modo silencioso por padrao.

Regras obrigatorias:
1. Nao narrar raciocinio, progresso interno, decisoes triviais ou passos intermediarios.
2. Nao imprimir logs completos de comandos bem-sucedidos.
3. Para comandos bem-sucedidos, registrar somente:
   - acao executada;
   - status `OK`;
   - arquivos criados/alterados;
   - validacao realizada.
4. Para comandos com erro, registrar:
   - comando executado;
   - codigo de saida;
   - `stderr` relevante;
   - trecho minimo de `stdout` necessario;
   - causa provavel;
   - correcao aplicada ou recomendada.
5. Usar `--silent`, `--quiet`, `--no-progress` ou equivalente quando possivel.
6. Se a saida for longa, resumir e preservar somente linhas relevantes para diagnostico.
7. Salvar relatorios detalhados em arquivos dentro de `reports/`, nao no chat.

## Objetivo

Produzir e implementar um fork Flutter do Impeccable com excelencia maxima:

1. Entender em profundidade o site `impeccable.style` e o codigo fonte de `pbakaus/impeccable`.
2. Extrair arquitetura, comandos, skill, referencias, detectores, CLI, live mode, docs, site, extensoes, testes, build e distribuicao do projeto original.
3. Projetar uma arquitetura Flutter/Dart idiomatica para o fork `fabriciocs/impeccable-flutter`.
4. Criar um plano completo, validado por analise do codigo real, com mapeamento recurso-a-recurso.
5. Implementar o plano no fork Flutter, preservando comportamento essencial e adaptando corretamente ao ecossistema Flutter.
6. Validar com formatacao, analise estatica, testes unitarios, testes de integracao quando aplicavel, build e auditoria.
7. Preparar distribuicao com release notes, artefatos e checklist.
8. Nao publicar/deployar externamente sem gate final.

## Preflight obrigatorio

1. Confirmar diretorio atual:
   - Se o diretorio atual for o fork `impeccable-flutter`, trabalhar nele.
   - Se nao for, verificar se ha subdiretorio `impeccable-flutter`.
   - Se nao houver repositorio local, clonar `https://github.com/fabriciocs/impeccable-flutter` em diretorio apropriado.
2. Obter referencia upstream:
   - Se `pbakaus/impeccable` nao estiver disponivel localmente, clonar como repositorio read-only em `_reference/impeccable-upstream` ou adicionar como remote/fetch sem misturar branches.
   - Nunca sobrescrever arquivos do fork com upstream sem plano explicito.
3. Rodar:
   - `git status --short`
   - `git branch --show-current`
   - `git remote -v`
4. Registrar estado inicial em `reports/preflight.md`.
5. Identificar ferramentas:
   - `flutter --version`
   - `dart --version`
   - `node --version`, se necessario para upstream
   - `npm --version`, `pnpm --version`, `bun --version`, conforme lockfiles
6. Se Flutter/Dart nao estiver instalado, registrar bloqueio claro.
7. Nao instalar dependencias globais sem necessidade.
8. Nao alterar `.env`.

## Analise profunda obrigatoria do upstream

Inspecionar o repositorio original antes de planejar implementacao. Ler no minimo:

- `README*`
- `AGENTS.md`
- `CLAUDE.md`
- `DESIGN.md`
- `PRODUCT.md`
- `package.json`
- lockfiles
- `skill/**`
- `source/skills/impeccable/**`
- `cli/**`
- `site/**`
- `docs/**`
- `extension/**`
- `functions/**`
- `plugin/**`
- `scripts/**`
- `tests/**`
- `.codex/**`
- `.claude/**`
- `.cursor/**`
- qualquer arquivo relacionado a comandos, detectores, live mode, hooks, installers, build e distribuicao.

Extrair e documentar em `reports/upstream-deep-analysis.md`:

- arquitetura geral;
- estrutura de pacotes;
- modelo de skill;
- lista completa de comandos;
- comportamento esperado de cada comando;
- entradas/saidas de cada comando;
- arquivos de referencia usados por cada comando;
- detectores deterministicos;
- regras anti-pattern;
- live mode;
- CLI;
- instalador/update/link;
- providers suportados;
- docs e site;
- testes existentes;
- build e release;
- dependencias;
- riscos de licenca;
- pontos que nao fazem sentido em Flutter e precisam de adaptacao.

## Analise profunda do site

Analisar `https://impeccable.style/` como produto e documentacao.

Regras:
- Preferir codigo fonte local do upstream quando o site estiver presente em `site/**`.
- Se for necessario navegar/renderizar, usar `puppeteer-core` com Chrome/Edge local, sem Playwright.
- Capturar evidencias em `reports/site-analysis.md`.

Extrair:
- proposta de valor;
- IA/persona/design vocabulary;
- paginas principais;
- copy e hierarquia;
- onboarding;
- live mode demonstrado;
- referencias visuais;
- fluxo de download/instalacao;
- exemplos de uso;
- promessas funcionais;
- lacunas entre site e codigo.

## Analise do fork Flutter

Inspecionar o repositorio alvo real antes de decidir qualquer coisa.

Ler no minimo:
- `README*`
- `pubspec.yaml`
- `analysis_options.yaml`
- `lib/**`
- `bin/**`
- `test/**`
- `integration_test/**`
- `tool/**`
- `scripts/**`
- `.github/workflows/**`
- `docs/**`
- `example/**`
- qualquer arquivo de configuracao Flutter/Dart.

Documentar em `reports/flutter-fork-analysis.md`:

- se e pacote Dart, app Flutter, CLI Flutter/Dart, monorepo, plugin ou mistura;
- arquitetura atual;
- estado de implementacao;
- mapeamento parcial para upstream;
- scripts disponiveis;
- qualidade atual;
- testes existentes;
- lacunas;
- riscos;
- recomendacao de arquitetura final.

## Plano completo antes de implementar

Criar `reports/flutter-port-plan.md` com:

1. Objetivo do fork Flutter.
2. Escopo funcional.
3. Escopo fora.
4. Mapa upstream -> Flutter:
   - skill;
   - comandos;
   - referencias;
   - detectores;
   - CLI;
   - live/browser;
   - instalador;
   - docs;
   - testes;
   - distribuicao.
5. Arquitetura Dart/Flutter proposta:
   - camadas;
   - dominios;
   - servicos;
   - modelos;
   - parsers;
   - runners;
   - CLI;
   - adaptadores para providers;
   - detector engine;
   - design vocabulary;
   - documentacao.
6. Estrategia de compatibilidade:
   - comandos equivalentes;
   - comportamento preservado;
   - pontos adaptados ao ecossistema Flutter.
7. Plano de arquivos.
8. Plano de migracao incremental.
9. Plano de testes.
10. Plano de QA.
11. Plano de distribuicao.
12. Riscos e mitigacoes.
13. Criterios de aceite rastreaveis.

Gate:
- Validar internamente o plano contra a analise upstream e o estado real do fork.
- Se o plano revelar bloqueio estrutural grave, parar e reportar.
- Se nao houver bloqueio, seguir para implementacao autonoma.
- Publicacao externa real continua gated.

## Subagentes

Criar contratos explicitos para os seguintes subagentes. Subagentes sao contratos de trabalho; o orquestrador continua responsavel por consolidar, revisar e validar.

### `orchestrator`

- Papel: coordenar fases, dependencias, gates e relatorios.
- Objetivo: garantir que analise, plano, implementacao, testes, QA e distribuicao preparada sejam completos.
- Entradas: todos os relatorios e estado do repo.
- Arquivos permitidos: `reports/**`, arquivos de coordenacao, planos.
- Arquivos proibidos: `.env`, secrets, arquivos fora do repo.
- Dependencias: nenhuma.
- Comandos permitidos: comandos de leitura, git status, validacoes.
- Criterios de aceite: plano e relatorio final consistentes.
- Entrega: secoes em `reports/multiagent-final-report.md`.

### `upstream_archaeologist`

- Papel: analisar profundamente `pbakaus/impeccable`.
- Objetivo: extrair arquitetura, comandos, detectores, skill, CLI, live mode, docs, testes e distribuicao.
- Entradas: `_reference/impeccable-upstream/**`.
- Arquivos permitidos: somente leitura em upstream; escrita em `reports/upstream-deep-analysis.md`.
- Arquivos proibidos: modificar upstream, `.env`.
- Dependencias: preflight.
- Comandos permitidos: leitura, grep/ripgrep, comandos de listagem, testes upstream apenas se necessario e seguro.
- Criterios de aceite: inventario completo e rastreavel.
- Entrega: `reports/upstream-deep-analysis.md`.

### `site_product_analyzer`

- Papel: analisar produto, site e documentacao publica.
- Objetivo: capturar promessa de produto, fluxos e expectativas de UX.
- Entradas: site local em upstream e, se necessario, URL publica.
- Arquivos permitidos: `reports/site-analysis.md`, screenshots em `reports/assets/`.
- Arquivos proibidos: Playwright, downloads automaticos de browser, secrets.
- Dependencias: preflight.
- Comandos permitidos: `puppeteer-core` com browser local, leitura de codigo do site.
- Criterios de aceite: relatorio compara site, docs e codigo.
- Entrega: `reports/site-analysis.md`.

### `flutter_architect`

- Papel: desenhar arquitetura Flutter/Dart idiomatica.
- Objetivo: transformar o Impeccable original em design adequado para Flutter.
- Entradas: relatorios upstream, site e fork.
- Arquivos permitidos: `reports/flutter-port-plan.md`, `docs/**`.
- Arquivos proibidos: implementacao antes do plano aprovado internamente.
- Dependencias: `upstream_archaeologist`, `site_product_analyzer`, `flutter_fork_auditor`.
- Comandos permitidos: leitura e analise.
- Criterios de aceite: plano completo com mapa recurso-a-recurso.
- Entrega: `reports/flutter-port-plan.md`.

### `flutter_fork_auditor`

- Papel: auditar o fork atual.
- Objetivo: entender estrutura real, scripts, estado, lacunas e riscos.
- Entradas: repo alvo.
- Arquivos permitidos: `reports/flutter-fork-analysis.md`.
- Arquivos proibidos: alteracoes de codigo nesta fase.
- Dependencias: preflight.
- Comandos permitidos: `flutter --version`, `dart --version`, `flutter pub get` somente se necessario e seguro, `dart analyze` somente apos dependencias.
- Criterios de aceite: diagnostico fiel do estado atual.
- Entrega: `reports/flutter-fork-analysis.md`.

### `command_port_agent`

- Papel: portar comandos do Impeccable para Flutter/Dart.
- Objetivo: implementar ou completar comandos equivalentes aos 23 comandos originais quando aplicavel.
- Entradas: plano aprovado internamente.
- Arquivos permitidos: `lib/**`, `bin/**`, `test/**`, `docs/**`.
- Arquivos proibidos: `.env`, arquivos fora do escopo.
- Dependencias: `flutter_architect`.
- Comandos permitidos: `dart format`, `dart analyze`, testes focados.
- Criterios de aceite: comandos implementados, documentados e testados.
- Entrega: codigo + testes + resumo.

### `detector_engine_agent`

- Papel: portar detectores deterministicos e anti-patterns.
- Objetivo: implementar engine Dart para regras deterministicas e relatorios.
- Entradas: regras do upstream.
- Arquivos permitidos: `lib/**`, `test/**`, `docs/**`.
- Arquivos proibidos: `.env`.
- Dependencias: `flutter_architect`.
- Comandos permitidos: testes focados, analyze.
- Criterios de aceite: regras cobertas por testes, relatorios previsiveis.
- Entrega: engine + fixtures + testes.

### `skill_packaging_agent`

- Papel: adaptar skill/provider packaging para Flutter.
- Objetivo: preparar estrutura instalavel/usavel no ecossistema alvo.
- Entradas: upstream packaging, plano Flutter.
- Arquivos permitidos: `lib/**`, `bin/**`, `tool/**`, `docs/**`, configs necessarias.
- Arquivos proibidos: publicar externamente.
- Dependencias: `command_port_agent`, `detector_engine_agent`.
- Comandos permitidos: build/test local.
- Criterios de aceite: pacote local instalavel/executavel conforme proposta.
- Entrega: packaging + docs.

### `docs_agent`

- Papel: documentar uso, arquitetura e migracao.
- Objetivo: atualizar README/docs para Flutter.
- Entradas: plano, implementacao.
- Arquivos permitidos: `README*`, `docs/**`, `CHANGELOG.md`.
- Arquivos proibidos: secrets.
- Dependencias: implementacao principal.
- Comandos permitidos: validacao markdown se houver.
- Criterios de aceite: docs reproduziveis e sem promessas falsas.
- Entrega: documentacao final.

### `unit_test_agent`

- Papel: criar e executar testes unitarios.
- Objetivo: cobrir comandos, parsers, detectores, fixtures e edge cases.
- Entradas: codigo implementado.
- Arquivos permitidos: `test/**`, fixtures, pequenos ajustes no codigo para testabilidade.
- Arquivos proibidos: alterar comportamento sem plano.
- Dependencias: implementacao.
- Comandos permitidos: `flutter test` ou `dart test`, conforme repo.
- Criterios de aceite: testes passam ou bloqueio real documentado.
- Entrega: testes + resumo.

### `integration_test_agent`

- Papel: validar fluxos ponta-a-ponta locais.
- Objetivo: testar CLI/packaging/execucao com fixture Flutter.
- Entradas: pacote implementado.
- Arquivos permitidos: `integration_test/**`, `example/**`, `test/fixtures/**`, `reports/**`.
- Arquivos proibidos: deploy/publicacao real.
- Dependencias: `unit_test_agent`.
- Comandos permitidos: comandos de integracao locais.
- Criterios de aceite: fluxo principal executa do inicio ao fim localmente.
- Entrega: relatorio de integracao.

### `qa_agent`

- Papel: QA independente.
- Objetivo: verificar aderencia ao plano, upstream, Flutter idiomatico, testes, docs, acessibilidade quando houver UI e ausencia de Playwright/secrets.
- Entradas: todos os relatorios, codigo, testes.
- Arquivos permitidos: `reports/qa-report.md`.
- Arquivos proibidos: alteracoes de implementacao exceto apontar correcoes.
- Dependencias: testes unitarios e implementacao.
- Comandos permitidos: `dart analyze`, `flutter analyze`, `flutter test`, `dart test`, build local conforme repo.
- Criterios de aceite: QA aprovado ou lista objetiva de bloqueios.
- Entrega: `reports/qa-report.md`.

### `devops_distribution_agent`

- Papel: preparar distribuicao.
- Objetivo: preparar artefatos, release notes, checklist e plano de publicacao sem publicar externamente.
- Entradas: QA aprovado.
- Arquivos permitidos: `CHANGELOG.md`, `reports/distribution-plan.md`, configs de CI se necessario.
- Arquivos proibidos: secrets, `.env`, publicacao real.
- Dependencias: `qa_agent` aprovado.
- Comandos permitidos: dry-run, build local, verificacoes de pacote.
- Criterios de aceite: artefatos e plano de distribuicao prontos; publicacao real gated.
- Entrega: `reports/distribution-plan.md`.

## Regras de paralelismo

- Pode executar em paralelo apenas:
  - `upstream_archaeologist`;
  - `site_product_analyzer`;
  - `flutter_fork_auditor`.
- `flutter_architect` so executa apos esses tres relatorios.
- Implementacao so comeca apos `reports/flutter-port-plan.md`.
- `command_port_agent` e `detector_engine_agent` podem trabalhar em paralelo se o plano separar arquivos sem conflito.
- `skill_packaging_agent` depende dos comandos e detectores.
- `docs_agent` depende da implementacao principal.
- `unit_test_agent` depende da implementacao.
- `integration_test_agent` depende dos testes unitarios.
- `qa_agent` depende de implementacao, docs e testes.
- `devops_distribution_agent` depende de QA aprovado.
- Deploy/publicacao real depende de QA aprovado e autorizacao explicita do usuario.

## Tarefas

### FASE 00: Preflight e preservacao

1. Confirmar repo, branch, remotes e status.
2. Criar `reports/` se nao existir.
3. Registrar estado inicial em `reports/preflight.md`.
4. Identificar stack real do fork.
5. Identificar comandos disponiveis.
6. Verificar licenca e atribuicoes.
7. Verificar se ha arquivos modificados/untracked do usuario.
8. Nunca limpar working tree sem autorizacao.

### FASE 01: Analise upstream completa

1. Clonar/fetch upstream em area read-only se necessario.
2. Inventariar estrutura.
3. Extrair comandos e comportamento.
4. Extrair regras e referencias.
5. Extrair CLI/install/link/update.
6. Extrair live mode.
7. Extrair testes e fixtures.
8. Documentar em `reports/upstream-deep-analysis.md`.

### FASE 02: Analise do site/produto

1. Ler codigo do site no upstream.
2. Navegar/renderizar apenas se necessario com `puppeteer-core`.
3. Documentar produto, copy, fluxos e promessas.
4. Salvar `reports/site-analysis.md`.

### FASE 03: Analise do fork Flutter

1. Ler estrutura real.
2. Detectar tipo de projeto.
3. Detectar dependencias.
4. Detectar lacunas.
5. Rodar validacoes iniciais possiveis.
6. Salvar `reports/flutter-fork-analysis.md`.

### FASE 04: Plano validado

1. Criar `reports/flutter-port-plan.md`.
2. Incluir mapa upstream -> Flutter.
3. Incluir arquitetura final.
4. Incluir plano de implementacao incremental.
5. Incluir plano de testes e distribuicao.
6. Validar plano contra os relatorios anteriores.
7. Se houver bloqueio grave, parar e reportar.
8. Se nao houver bloqueio, iniciar implementacao.

### FASE 05: Implementacao Flutter/Dart

Implementar conforme plano real. Areas esperadas, ajustar aos arquivos reais:

1. Modelos de dominio:
   - comandos;
   - referencias;
   - regras;
   - resultados;
   - severidades;
   - sugestoes;
   - contexto de projeto.
2. Engine de comandos:
   - parser;
   - dispatcher;
   - runners;
   - saida estruturada.
3. Engine de detectores:
   - regras deterministicamente testaveis;
   - fixtures;
   - relatorio.
4. Adaptacao dos comandos Impeccable:
   - `init`;
   - `document`;
   - `extract`;
   - `shape`;
   - `critique`;
   - `audit`;
   - `polish`;
   - `bolder`;
   - `quieter`;
   - `distill`;
   - `harden`;
   - `onboard`;
   - `animate`;
   - `colorize`;
   - `typeset`;
   - `layout`;
   - `delight`;
   - `overdrive`;
   - `clarify`;
   - `adapt`;
   - `optimize`;
   - `live`;
   - `pin`;
   - demais comandos reais identificados.
5. CLI Dart/Flutter quando aplicavel:
   - `bin/`;
   - argumentos;
   - help;
   - exit codes;
   - modo silencioso;
   - relatorios.
6. Packaging:
   - `pubspec.yaml`;
   - exports;
   - docs;
   - exemplo;
   - changelog.
7. Docs:
   - README;
   - guia de instalacao;
   - guia de uso;
   - guia de contribuicao;
   - mapeamento com upstream.

### FASE 06: Testes

1. Rodar formatacao:
   - `dart format .` ou comando equivalente.
2. Rodar analise:
   - `dart analyze` ou `flutter analyze`, conforme projeto.
3. Rodar testes:
   - `dart test` ou `flutter test`, conforme projeto.
4. Criar testes faltantes.
5. Repetir ate passar ou ate bloqueio real.

### FASE 07: Integracao

1. Criar/usar fixture Flutter local.
2. Executar fluxo principal da CLI/pacote.
3. Validar que outputs sao deterministas.
4. Validar que erros retornam exit codes adequados.
5. Validar que docs reproduzem comandos.
6. Salvar `reports/integration-report.md`.

### FASE 08: QA

`qa_agent` deve verificar:

- aderencia ao upstream;
- aderencia ao plano Flutter;
- comportamento dos comandos;
- cobertura de detectores;
- qualidade Dart/Flutter;
- ausencia de Playwright;
- ausencia de secrets;
- preservacao de trabalho do usuario;
- docs;
- testes;
- build/package;
- riscos de distribuicao.

Salvar `reports/qa-report.md`.

### FASE 09: Preparacao de distribuicao

Sem publicar externamente.

1. Preparar `reports/distribution-plan.md`.
2. Preparar release notes.
3. Validar versao em `pubspec.yaml`, se aplicavel.
4. Rodar dry-run quando disponivel e seguro:
   - para Dart/pub: usar comandos de dry-run, sem publicar;
   - para npm: apenas se o projeto realmente usar npm e sem publicar;
   - para GitHub Release: preparar checklist, nao criar release real.
5. Documentar variaveis necessarias sem expor valores.
6. Preparar plano de rollback.
7. Marcar publicacao real como pendente de autorizacao explicita.

### FASE 10: Auditoria final

Criar `reports/multiagent-final-report.md` contendo:

# Relatorio Final Multiagente

## Meta analisada
## Estado inicial
## Arquivos lidos
## Agentes criados
## Plano de execucao
## Tarefas executadas
## Tarefas paralelas
## Arquivos criados
## Arquivos alterados
## Testes executados
## Resultado do QA
## Resultado de integracao
## Resultado de distribuicao preparada
## Problemas encontrados
## Correcoes aplicadas
## Pendencias
## Riscos
## Proximos passos
## Gate de publicacao real

## Comandos de validacao esperados

Usar os comandos reais do repositorio. Nao assumir scripts inexistentes.

Preferencias por stack:

- Se for Flutter app/package:
  - `flutter pub get`
  - `dart format .`
  - `flutter analyze`
  - `flutter test`
  - build apropriado apenas se houver plataforma configurada.
- Se for Dart package/CLI puro:
  - `dart pub get`
  - `dart format .`
  - `dart analyze`
  - `dart test`
- Se houver Node/Bun apenas para upstream ou tooling:
  - usar o package manager indicado pelo lockfile;
  - comandos silenciosos;
  - nao instalar Playwright.

## Criterios de aceite

- `reports/preflight.md` criado com repo, branch, remotes, status inicial e ferramentas detectadas.
- `reports/upstream-deep-analysis.md` criado com inventario profundo do Impeccable original.
- `reports/site-analysis.md` criado com analise do site/produto.
- `reports/flutter-fork-analysis.md` criado com estado real do fork.
- `reports/flutter-port-plan.md` criado com plano recurso-a-recurso e arquitetura Flutter/Dart.
- O fork Flutter implementa arquitetura adequada ao ecossistema Flutter/Dart.
- Comandos essenciais do Impeccable original estao mapeados, implementados ou explicitamente marcados como nao aplicaveis com justificativa.
- Detectores/regras deterministicos relevantes estao implementados ou justificados.
- CLI/packaging funciona localmente, se aplicavel ao tipo de projeto.
- Documentacao explica instalacao, uso, arquitetura, comandos e limitacoes.
- Testes unitarios cobrem os nucleos implementados.
- Testes de integracao validam fluxo principal.
- `dart format`/`dart analyze`/`flutter analyze`/`dart test`/`flutter test` passam conforme stack real, ou bloqueio real e documentado impede conclusao.
- Nenhum uso de Playwright foi introduzido.
- Nenhum secret foi exposto.
- `.env` nao foi alterado sem autorizacao.
- Trabalho do usuario fora do escopo foi preservado.
- `reports/qa-report.md` aprovado ou bloqueios reais listados.
- `reports/distribution-plan.md` preparado.
- Nenhuma publicacao/deploy real externa foi executada sem autorizacao explicita.

## Saida final esperada no chat

Responder curto, em portugues, com:

- `OK` ou `ERRO`;
- fases concluidas;
- arquivos principais criados/alterados;
- comandos executados e resultado resumido;
- validacoes que passaram;
- bloqueios reais, se houver;
- riscos restantes;
- confirmacao de que nao houve publicacao real sem autorizacao;
- proximo passo necessario para publicacao/distribuicao real, se aplicavel.

MODO DE EXECUCAO:
Executar de forma autonoma ate concluir todos os criterios possiveis. Se encontrar bloqueio real, parar somente depois de registrar diagnostico, arquivo/comando relacionado, causa provavel e acao necessaria do usuario.