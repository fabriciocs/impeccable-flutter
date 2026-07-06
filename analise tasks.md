
## Mudanças já implementadas

### 1. Migração operacional parcial de Bun/Playwright para Node/npm + Puppeteer Core

O `package.json` já está em `version: 3.2.0`, exige Node `>=24`, usa scripts `npm run ...` com `node scripts/run-tests.mjs`, e declara `puppeteer-core` como dependência opcional, sem Playwright direto no `package.json`.

Também foi criado um lançador local de browser que procura Chrome, Edge ou Chromium instalados localmente e permite `PUPPETEER_EXECUTABLE_PATH`, sem baixar browser automaticamente.

### 2. Suporte inicial a Dart/Flutter no detector

O walker agora inclui `.dart` como extensão escaneável e exporta `DART_EXTENSIONS`.

Foi adicionada detecção de projeto Flutter por `pubspec.yaml`, `lib/main.dart`, `web/index.html`, `web/flutter.js`, `web/main.dart.js` e sinais `_flutter.loader`, `flutter.js`, `main.dart.js`. A detecção retorna metadados específicos como `optionalServer`, `sourceOnly` e `projectType` (`flutter-web` ou `flutter-source`).

### 3. Engine textual Flutter/Dart

Existe uma engine nova em `cli/engine/engines/flutter-dart/detect-dart.mjs`. Ela detecta padrões como:

* `BorderRadius.circular(32+)`;
* gradientes roxo/ciano;
* texto com `ShaderMask`/shader;
* excesso de `TextStyle(fontSize:)`;
* `Colors.grey` em superfície colorida;
* cards/containers decorativos aninhados;
* `GestureDetector`/`InkWell` sem semântica;
* repetição de `EdgeInsets.all(16)`.

Essas regras também foram registradas no catálogo de anti-patterns com descrições e guidelines próprias para Flutter.

### 4. Integração da CLI com `.dart`

A CLI importa `detectDart`, processa `.dart` vindo de stdin/tool input, arquivo único e diretório, além de mostrar uma mensagem específica quando detecta projeto Flutter sem porta padrão.

A API pública também exporta `detectDart` e `DART_EXTENSIONS`.

### 5. Skill adaptada para Flutter/Dart

A skill principal agora declara suporte a “Flutter/Dart apps” e orienta o agente a ler `pubspec.yaml`, `lib/main.dart`, `ThemeData`, `ColorScheme`, `TextTheme` e widgets representativos antes de atuar.

Também há uma seção explícita “Flutter/Dart targets” com regras para trabalhar em widgets, constraints, Material 3, semântica, `flutter analyze`, `flutter test` e a limitação de Flutter Web renderizado no browser.

### 6. Testes registrados para Flutter e runner Node

A matriz de testes registra os testes Flutter/Dart em `detector`, `framework` e `cli-e2e`: `file-system-dart`, `cli-flutter-dart`, `detect-flutter-dart`, `framework-detection-flutter`.

O `scripts/test-suites.mjs` já trata `package-lock.json` como gatilho de infra comum, o que indica intenção de migração para npm.

## O que ainda resta

### 1. CI ainda está em Bun/Playwright

O workflow principal ainda usa `oven-sh/setup-bun`, `bun install`, `bun run ...`, `bunx puppeteer browsers install chrome`, cache de Playwright e `npx playwright install chromium`.

A segunda metade do workflow também mantém `Setup Bun`, cache `~/.cache/ms-playwright`, `bun install`, `npx playwright install chromium` e `bun run test:...`.

### 2. Workflow de sync gerado ainda está em Bun

`.github/workflows/sync-generated-output.yml` ainda observa `bun.lock`, instala com `bun install --frozen-lockfile` e executa `bun run build:release`.

### 3. `package-lock.json` não está versionado

O arquivo `package-lock.json` **não existe na branch remota**. Além disso, `.gitignore` ainda diz que o projeto usa `bun.lock` e ignora `package-lock.json`, o que conflita com a migração para npm.

### 4. Template de PR ainda exige Bun

O checklist de PR ainda pede `bun run build` e `bun test`.

### 5. `CLAUDE.md` ainda está desatualizado

`CLAUDE.md` ainda documenta `bun run dev`, `bun run preview`, `bun run deploy`, `bun run og-image`, `bun run build`, `bun run test`, `npx playwright install chromium` e descreve E2E como Playwright-based.

### 6. Extensão/Flutter Web awareness ainda não aparece como concluída

Na comparação da branch, não aparecem mudanças nos arquivos funcionais de UI da extensão, como `extension/popup`, `extension/devtools` ou mensagens específicas de Flutter Web. O detector entende Flutter, mas ainda falta fechar a comunicação para o usuário: “browser scan vê o DOM/render Flutter Web; para Dart source, rode `impeccable detect lib/`”.

### 7. Fixture Flutter ainda parece incompleta como golden path de framework

A branch adicionou arquivos em `tests/framework-fixtures/flutter-basic/files/...`, mas não aparece `fixture.json` na comparação. Sem esse contrato, a fixture serve como material de detecção, mas não como golden path completo do harness de framework.

---

# Meta: Finalizar a feature `adaptation_to_flutter` para PR/merge

## Objetivo

Concluir a adaptação do Impeccable para reconhecer, analisar e orientar projetos Flutter/Dart sem converter o projeto para Flutter, garantindo que:

1. `.dart` seja escaneado pela CLI;
2. projetos Flutter sejam detectados por estrutura e sinais Web;
3. a skill oriente corretamente trabalhos Flutter/Dart;
4. browser automation use `puppeteer-core` com Chrome/Edge/Chromium local;
5. Bun e Playwright não sejam dependências operacionais;
6. CI, docs, PR template e lockfile estejam coerentes com npm/Node;
7. a feature esteja validada por build, testes e golden path.

## Passos repetíveis para implementar

### Passo 1 — Corrigir lockfile e `.gitignore`

1. Remover o bloco antigo que ignora `package-lock.json`.
2. Atualizar o comentário de `.gitignore` para npm.
3. Garantir que `node_modules/` continue ignorado.
4. Gerar e versionar `package-lock.json` com:

```bash
npm install
```

Critério parcial: `package-lock.json` existe no Git e `bun.lock` continua removido.

### Passo 2 — Migrar CI principal para npm/Node

Em `.github/workflows/ci.yml`:

1. Remover todos os blocos `Setup Bun`.
2. Trocar `bun install` por `npm ci`.
3. Trocar `bun run test:*` por `npm run test:*`.
4. Trocar `bun run build`, `build:browser`, `build:extension` por `npm run ...`.
5. Remover cache `~/.cache/ms-playwright`.
6. Remover `npx playwright install chromium`.
7. Configurar Chrome/Chromium local para `puppeteer-core`, por exemplo usando `browser-actions/setup-chrome` ou o Chrome disponível no runner.
8. Se necessário, exportar `PUPPETEER_EXECUTABLE_PATH`.

Critério parcial: busca por `bun`, `bunx`, `playwright`, `ms-playwright` no workflow principal não retorna comandos operacionais.

### Passo 3 — Migrar workflow de sync gerado

Em `.github/workflows/sync-generated-output.yml`:

1. Trocar gatilho de `bun.lock` para `package-lock.json`.
2. Remover `Setup Bun`.
3. Usar `npm ci`.
4. Trocar `bun run build:release` por `npm run build:release`.

Critério parcial: workflow de sync usa apenas Node/npm.

### Passo 4 — Atualizar documentação operacional

Atualizar:

* `.github/PULL_REQUEST_TEMPLATE.md`;
* `CLAUDE.md`;
* `AGENTS.md`, se ainda restar referência operacional antiga;
* `docs/DEVELOP.md`, se necessário;
* `README.md` e `README.npm.md`, se necessário.

Trocas obrigatórias:

```txt
bun run build            -> npm run build
bun run build:release    -> npm run build:release
bun run test             -> npm run test
bun run test:live-e2e    -> npm run test:live-e2e
bun run dev              -> npm run dev
bun run deploy           -> npm run deploy
npx playwright install   -> Chrome/Edge/Chromium local + PUPPETEER_EXECUTABLE_PATH
```

Critério parcial: nenhuma documentação ativa instrui instalar ou rodar Playwright/Bun.

### Passo 5 — Fechar Flutter Web awareness na extensão

Implementar mensagem visível em popup/devtools/sidebar quando detectar Flutter Web renderizado:

```txt
Flutter Web detected: browser scan checks rendered DOM output. Run `impeccable detect lib/` for Dart source rules.
```

Critério parcial: a extensão não promete ler Dart pelo DOM/browser, mas orienta o fluxo correto.

### Passo 6 — Completar fixture/golden path Flutter

Criar ou ajustar:

```txt
tests/framework-fixtures/flutter-basic/fixture.json
tests/framework-fixtures/flutter-basic/files/pubspec.yaml
tests/framework-fixtures/flutter-basic/files/lib/main.dart
tests/framework-fixtures/flutter-basic/files/web/index.html
```

Decisão importante: se o harness não deve iniciar Flutter, marcar a fixture como source-only/detection-only. Se deve iniciar Flutter Web, documentar SDK necessário e isolar como opt-in.

Critério parcial: `npm run test:framework` inclui Flutter de forma controlada e não fica pendurado por tentar iniciar servidor sem SDK.

### Passo 7 — Validar CLI Flutter

Executar:

```bash
node cli/bin/cli.js detect --no-config tests/fixtures/flutter/bad.dart
node cli/bin/cli.js detect --no-config tests/fixtures/flutter/good.dart --json
node cli/bin/cli.js detect --no-config tests/fixtures/flutter/project-bad
npm run test:detector
npm run test:framework
```

Critérios:

* `bad.dart` retorna findings Flutter e exit code `2`;
* `good.dart --json` retorna `[]` e exit code `0`;
* diretório Flutter é escaneado;
* testes Flutter continuam registrados nas suites corretas.

### Passo 8 — Regenerar artefatos necessários

Rodar:

```bash
npm run build:skills
npm run build:browser
npm run build:extension
npm run build:release
```

Depois conferir drift:

```bash
git diff -- .agents .claude .cursor .gemini .github/skills plugin cli/engine/detect-antipatterns-browser.js extension/detector
```

Critério parcial: os artefatos gerados ficam coerentes com as fontes alteradas ou o PR documenta por que não serão incluídos.

### Passo 9 — Rodar gates finais

Executar:

```bash
npm ci
npm run build:skills
npm run build:browser
npm run build:extension
npm run test
npm run test:live
npm run test:skill-behavior
```

Quando aplicável:

```bash
npm run test:live-e2e
npm run test:cli-e2e
```

Critério parcial: todos os gates locais passam, ou os opt-in com provider/API key pulam explicitamente por falta de chave.

---

## Critérios para considerar a meta alcançada

A meta estará alcançada quando todos estes pontos forem verdadeiros:

1. `package.json` não contém Playwright nem scripts Bun operacionais.
2. `package-lock.json` está versionado.
3. `bun.lock` está removido.
4. `.gitignore` não ignora `package-lock.json`.
5. `.github/workflows/ci.yml` não usa `setup-bun`, `bun install`, `bun run`, `bunx`, cache `ms-playwright` ou `npx playwright install`.
6. `.github/workflows/sync-generated-output.yml` usa `npm ci` e `npm run build:release`.
7. `.github/PULL_REQUEST_TEMPLATE.md` usa comandos npm.
8. `CLAUDE.md` descreve npm/Node + `puppeteer-core`, não Bun/Playwright.
9. `.dart` continua em `SCANNABLE_EXTENSIONS`.
10. `detectDart` continua exportado pela API pública.
11. `impeccable detect` funciona para arquivo `.dart`, diretório Flutter e stdin/tool input.
12. A skill principal e referências mantêm orientação Flutter/Dart.
13. Há fixture ou golden path Flutter controlado.
14. A extensão avisa corretamente a limitação de Flutter Web/browser scan.
15. `npm run test`, `npm run test:detector`, `npm run test:framework`, `npm run build:skills`, `npm run build:browser` e `npm run build:extension` passam.
16. A busca final não encontra comandos operacionais antigos:

```bash
grep -RniE "setup-bun|bun install|bun run|bunx|bun.lock|playwright|ms-playwright|npx playwright" \
  .github package.json scripts tests cli skill docs README.md README.npm.md CLAUDE.md AGENTS.md
```

## Critérios para dizer que ainda restam passos

Ainda restam passos se qualquer um destes ocorrer:

1. `package-lock.json` não estiver no Git.
2. Qualquer workflow ainda instalar Bun ou Playwright.
3. Qualquer checklist/doc operacional ainda mandar rodar `bun run` ou `bun test`.
4. CI depender de `bun.lock`.
5. `npm ci` falhar.
6. `npm run test` chamar Bun indiretamente.
7. Flutter Web for tratado como se o browser scan lesse Dart source.
8. A fixture Flutter não tiver contrato claro (`fixture.json` ou documentação source-only).
9. `bad.dart` não gerar findings Flutter.
10. `good.dart` gerar falso positivo.
11. `npm run build:release` gerar drift não explicado nos artefatos versionados.

## Prompt curto para o executor

```text
Continue a branch `feature/adaptation_to_flutter` no repositório `fabriciocs/impeccable-flutter`.

Objetivo: finalizar a migração Flutter/Dart e deixar a feature pronta para PR.

Estado atual:
- `.dart` já foi adicionado ao walker.
- `detectDart` já existe e está integrado na CLI.
- regras Flutter já estão registradas.
- `package.json` usa npm/Node e `puppeteer-core`.
- `bun.lock` foi removido.
- CI, sync workflow, PR template, `.gitignore` e `CLAUDE.md` ainda estão inconsistentes com npm/Node e ainda citam Bun/Playwright.
- `package-lock.json` não está versionado.
- extensão ainda precisa mensagem explícita de Flutter Web/browser scan.
- fixture Flutter precisa golden path ou contrato source-only.

Execute:
1. Corrigir `.gitignore` e versionar `package-lock.json`.
2. Migrar `.github/workflows/ci.yml` para npm/Node + Chrome local para `puppeteer-core`.
3. Migrar `.github/workflows/sync-generated-output.yml` para npm/Node.
4. Atualizar `.github/PULL_REQUEST_TEMPLATE.md`, `CLAUDE.md`, AGENTS/README/docs se necessário.
5. Adicionar aviso de Flutter Web na extensão.
6. Completar fixture/golden path Flutter.
7. Rodar `npm ci`, `npm run build:skills`, `npm run build:browser`, `npm run build:extension`, `npm run test`, `npm run test:live`, `npm run test:skill-behavior`.
8. Remover qualquer referência operacional restante a Bun/Playwright.
9. Entregar relatório final com arquivos alterados, gates executados, resultados e pendências.
```
