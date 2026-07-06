Use esta meta em uma nova janela:

```text
Codex goal: concluir a feature `adaptation_to_flutter` com mínimo uso de tokens.

Contexto obrigatório:
- Repo: impeccable-flutter.
- Nunca instalar, baixar, configurar ou executar Playwright, @playwright/test, playwright-core, npx playwright, browsers/cache ms-playwright.
- Alternativa oficial: `puppeteer-core` + Chrome/Edge local, sem download de browser.
- Branch esperada: `feature/adaptation_to_flutter`.
- Trabalho já feito: migração Bun/Playwright -> npm/Node + puppeteer-core; `bun.lock` removido; deps reinstaladas; `npm run build:skills`, `npm run test`, `npm run test:live`, `npm run test:skill-behavior` já passaram no ciclo anterior.
- Mudanças conhecidas: ajustes em `tests/detect-antipatterns.test.js`, `tests/live-server.test.mjs`, `tests/skill-behavior/scenarios.test.mjs`; arquivo `VERSION` untracked deve ser preservado salvo instrução explícita.

Objetivo:
1. Não refatorar de novo.
2. Apenas revisar estado atual, garantir que não há regressão óbvia e preparar encerramento.
3. Não rodar testes pesados automaticamente. Em vez disso, gerar/usar o script abaixo para eu executar manualmente e outra IA avaliar o output.
4. Se o script manual indicar falha, corrigir somente a falha indicada.
5. Finalizar com resumo curto: arquivos alterados, validação manual esperada/recebida, riscos restantes.
```

Script PowerShell manual para validação:

```powershell
$ErrorActionPreference = "Stop"

$env:PUPPETEER_SKIP_DOWNLOAD = "true"
$env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if (Test-Path $chrome) {
  $env:PUPPETEER_EXECUTABLE_PATH = $chrome
} elseif (Test-Path $edge) {
  $env:PUPPETEER_EXECUTABLE_PATH = $edge
} else {
  Write-Error "Chrome/Edge local não encontrado para puppeteer-core."
}

Write-Host "== git =="
git branch --show-current
git status --short --untracked-files=all

Write-Host "== no playwright =="
rg -n "playwright|@playwright/test|playwright-core|npx playwright|ms-playwright" package.json package-lock.json tests scripts cli docs README.md README.npm.md AGENTS.md skill -S

Write-Host "== no bun scripts =="
rg -n "bun:test|runner: 'bun'|bun run|bun install|bun audit|import\.meta\.dir" tests scripts package.json docs AGENTS.md README.md README.npm.md -S

Write-Host "== npm deps =="
npm ls playwright playwright-core @playwright/test puppeteer-core --depth=0

Write-Host "== gates =="
npm run build:skills
npm run test
npm run test:skill-behavior
```

Critério para outra IA avaliar o output:
```text
A validação passa se:
- branch é `feature/adaptation_to_flutter`;
- buscas `rg` não encontram Playwright/Bun proibidos;
- `npm ls` mostra `puppeteer-core` e não mostra Playwright;
- `npm run build:skills` passa;
- `npm run test` passa;
- `npm run test:skill-behavior` passa ou pula providers por chave/quota indisponível;
- nenhum browser é baixado automaticamente.
```