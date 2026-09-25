# Especificação consolidada — validação local Windows, engine isolado e gates

Data de consolidação: 2026-09-25  
Repositório: `fabriciocs/impeccable-flutter`  
Baseline remoto analisado: `main@5e7d97fb52c1eee9ed6570767dfa1e8585a1dbb5`  
Commit funcional de live-E2E imediatamente anterior ao sync gerado: `7558793ad2e1fbffa079670b84aebe5acf40ed90`

## 1. Objetivo

Esta especificação transforma a validação local do projeto em um processo determinístico, rastreável e seguro no Windows, eliminando dependência de `target/release/impeccable.exe` compartilhado entre execuções e impedindo que um executável antigo, bloqueado por um processo Live, seja confundido com o engine compilado a partir do HEAD corrente.

O problema observado não é erro de compilação Rust. O linker concluiu `impeccable-live` e iniciou a produção de `impeccable v0.1.5`, mas o Windows recusou a substituição de `target\release\impeccable.exe` com `os error 5` porque o executável estava aberto. A correção principal é isolamento de `cargo target` por execução, não encerramento indiscriminado de processos.

Também é necessário corrigir uma premissa da orientação anterior: `node scripts/run-tests.mjs --cleanup` é seguro e escopado por marcadores no Linux/macOS, mas **atualmente não encontra processos no Windows**, pois `scripts/lib/live-server-processes.mjs` retorna mapa vazio em `win32`. Portanto esse cleanup pode ser mantido como best-effort, mas não pode ser considerado mecanismo de desbloqueio do executável no Windows nem gate de sucesso.

## 2. Estado consolidado do repositório

- `main` contém as correções de build limpo do Windows, oracle Dart, estabilização Svelte e correções live-E2E/design-system.
- As branches históricas de 15/09 apontam para `3a6710f5e0234203ae537bd61d505cc3a0c3931b` e estão integralmente atrás de `main`.
- As branches de correção de 23–24/09 mantêm commits granulares divergentes, mas o conteúdo funcional foi consolidado nos commits posteriores de `main`, incluindo `ccad6a35c`, `1c78002a2`, `e970875d5` e `7558793ad`.
- Não havia pull request aberta no momento da consolidação.
- `Validate-Local.ps1` não existe na árvore remota analisada; a cópia local mencionada é não rastreada. Ela deve ser promovida a artefato versionado antes de ser tratada como contrato oficial.

## 3. Princípios obrigatórios

1. Uma execução de validação deve usar um único engine compilado do começo ao fim.
2. O engine deve ser compilado em diretório exclusivo da execução.
3. Nenhum gate local pode cair silenciosamente para `target/release/impeccable.exe`, release baixado ou binário residual quando `IMPECCABLE_BIN` já foi selecionado.
4. O caminho efetivo do engine, SHA validado, diretório Cargo e logs devem ser preservados como evidência.
5. Cleanup de Live server não pode usar `taskkill` genérico, nome de processo amplo ou porta como critério.
6. No Windows, até existir descoberta segura de processos Live, o isolamento do target é a defesa contra locks.
7. Gates que alterem arquivos rastreados devem terminar com árvore Git limpa.
8. Falha em qualquer gate obrigatório interrompe a sequência; gates opcionais/provider-backed devem ser explicitamente marcados.
9. `wasm32-unknown-unknown` e `wasm-pack` são pré-requisitos verificáveis, não devem ser reinstalados desnecessariamente em toda execução.
10. A validação deve funcionar em PowerShell 5.1 e PowerShell 7+.

---

# FASE 00 — Baseline, integridade Git e diretório de evidências

## Objetivo
Garantir que a validação parte do repositório correto, de um commit identificável e de uma árvore rastreada sem alterações inesperadas.

## Criar
Nenhum arquivo adicional além de `Validate-Local.ps1` na Fase 01.

## Alterar
### `Validate-Local.ps1`
Quando promovido na Fase 01, deverá conter um GATE 00 que:
- resolva `RepoPath` com `Resolve-Path`;
- execute `git rev-parse --show-toplevel` e compare com `RepoPath`;
- registre `git rev-parse HEAD`, branch atual e `git status --short`;
- não falhe por estar em detached HEAD, desde que o SHA esperado seja atendido quando esse modo for solicitado;
- trate arquivos sob `test-results/local-validation/` como evidência ignorada;
- falhe se houver alteração rastreada não autorizada antes do início;
- aceite o próprio `Validate-Local.ps1` como rastreado, eliminando a exceção atual de arquivo não rastreado.

## Excluir
Nenhum arquivo.

## Gate G00
PASS somente quando repositório, SHA, status Git e diretório de evidências forem registrados. Alterações rastreadas inesperadas => FAIL.

---

# FASE 01 — Tornar `Validate-Local.ps1` canônico e isolar Cargo por execução

## Criar
### `Validate-Local.ps1`
Promover a versão local para a raiz do repositório e consolidar nela o contrato abaixo.

Parâmetros mínimos:
- `RepoPath`, default para a pasta do script;
- `SkipInstall`;
- `ExpectedCommit` opcional;
- `KeepArtifacts` opcional;
- `SkipBrowserE2E` opcional, somente para diagnóstico, nunca como default de validação completa.

Inicialização obrigatória:
- `Set-StrictMode -Version Latest`;
- `$ErrorActionPreference = 'Stop'`;
- timestamp por execução;
- `$LogRoot = <repo>\test-results\local-validation\<timestamp>`;
- `$ValidationCargoTarget = <LogRoot>\cargo-target`;
- criação explícita dos dois diretórios;
- preservação do valor anterior de `IMPECCABLE_BIN` para restauração em `finally`.

O script deve usar `$ValidationCargoTarget` em todo build Rust de validação. É proibido gerar o engine canônico de validação em `<repo>\target\release`.

Build obrigatório:
`cargo build --release -p impeccable --target-dir "<ValidationCargoTarget>"`

Engine obrigatório:
`<ValidationCargoTarget>\release\impeccable.exe`

Após confirmar `Test-Path`, definir:
`$env:IMPECCABLE_BIN = (Resolve-Path $Engine).Path`

O script deve imprimir e gravar:
- HEAD;
- caminho do engine;
- tamanho/mtime do engine;
- Cargo target;
- versão reportada pelo engine ou resultado de `engine-probe`;
- versão Rust, Cargo, Node, npm e wasm-pack.

### `tests/validate-local-script.test.mjs`
Teste estrutural, sem executar PowerShell destrutivo. Deve ler `Validate-Local.ps1` e garantir:
- presença de target por execução sob `$LogRoot`;
- uso de `--target-dir`;
- seleção explícita de `IMPECCABLE_BIN`;
- ausência de atribuição do engine canônico para `target\release\impeccable.exe`;
- existência de verificação `Test-Path`;
- relatório final contendo engine e Cargo target;
- restauração de `IMPECCABLE_BIN` em `finally`;
- ausência de `taskkill /IM impeccable.exe`, `Stop-Process -Name impeccable` ou equivalentes amplos.

## Alterar
### `.gitignore`
Adicionar:
`/test-results/local-validation/`

Não ignorar `Validate-Local.ps1`.

### `package.json`
Adicionar script:
`"test:validate-local-script": "node --test tests/validate-local-script.test.mjs"`

### `scripts/test-suites.mjs`
Adicionar `tests/validate-local-script.test.mjs` à suíte `core`. Incluir `^Validate-Local\.ps1$` entre os triggers de `core`.

## Excluir
Nenhum arquivo.

## Gate G01
- `node --test tests/validate-local-script.test.mjs` PASS.
- `git check-ignore Validate-Local.ps1` não deve indicar ignore.
- `git check-ignore test-results/local-validation/probe.txt` deve indicar ignore.
- nenhuma referência operacional da validação pode apontar para `target\release\impeccable.exe`.

---

# FASE 02 — Semântica segura de cleanup e comportamento Windows

## Criar
Nenhum arquivo obrigatório.

## Alterar
### `Validate-Local.ps1`
No início do gate de engine, executar:
`node scripts/run-tests.mjs --cleanup`

Essa chamada é **best-effort no Windows**. O resultado deve ser logado, porém não deve ser descrito como mecanismo que garante liberação de `target\release\impeccable.exe`.

Se o comando retornar erro real, registrar o erro e falhar apenas quando o próprio cleanup afirmar que encontrou processos escopados e não conseguiu encerrá-los.

### `scripts/lib/live-server-processes.mjs`
Nesta etapa não implementar descoberta Windows insegura. Manter a proteção atual contra matching por nome/porta/caminho aproximado. Acrescentar comentário/documentação explícita de que `win32` ainda não possui sweep suportado e de que consumidores Windows devem usar targets/processos isolados.

Uma implementação futura de cleanup Windows só poderá ser aceita se identificar processos por um identificador forte originado pelo harness (PID lease + nonce/runId, handle/job object ou equivalente), nunca apenas por nome, porta ou substring de command line.

### `scripts/run-tests.mjs`
A ajuda de `--cleanup` deve informar, quando `process.platform === 'win32'`, que não existe sweep Windows suportado atualmente. A saída precisa evitar a mensagem enganosa de que não existem leftovers quando, na realidade, eles não podem ser enumerados pelo mecanismo atual.

### `tests/live-server-leak.test.mjs`
Adicionar caso específico de contrato para Windows por mock/injeção de plataforma ou helper extraído: cleanup não deve alegar descoberta completa quando a plataforma não suporta enumeração.

## Excluir
Nenhum arquivo.

## Gate G02
- Linux/macOS: testes existentes de leak continuam PASS.
- Windows: cleanup é explicitamente "unsupported/best-effort", sem falso positivo.
- Nenhum encerramento por nome amplo ou porta.

---

# FASE 03 — Build e prova de proveniência do engine

## Criar
Nenhum arquivo.

## Alterar
### `Validate-Local.ps1`
Implementar GATE 03 completo:
1. seção "Build current engine";
2. cleanup repo-scoped best-effort;
3. imprimir Cargo target;
4. build release em `$ValidationCargoTarget`;
5. verificar existência do exe;
6. definir `IMPECCABLE_BIN`;
7. executar `engine-probe`;
8. registrar hash SHA-256 do exe via `Get-FileHash -Algorithm SHA256`;
9. escrever `engine-metadata.json` em `$LogRoot` contendo HEAD, enginePath, engineSha256, cargoTarget, timestamp, rustc, cargo.

Todo comando posterior que consome engine deve herdar `IMPECCABLE_BIN`.

### `tests/validate-local-script.test.mjs`
Adicionar asserts para `Get-FileHash`, `engine-metadata.json` e proibição de reatribuição posterior de `IMPECCABLE_BIN` para outro binário.

## Excluir
Nenhum arquivo.

## Gate G03
PASS quando o engine é compilado no target exclusivo, existe, passa probe e sua evidência aponta para o mesmo HEAD da execução.

---

# FASE 04 — Toolchain e dependências

## Criar
Nenhum arquivo.

## Alterar
### `Validate-Local.ps1`
Adicionar preflight:
- `node --version`;
- `npm --version`;
- `rustup show`;
- `cargo --version`;
- `rustup target list --installed` e confirmação de `wasm32-unknown-unknown`;
- `wasm-pack --version`.

Com `-SkipInstall`, ausência de dependência deve gerar mensagem objetiva e FAIL, não instalação implícita.

Sem `-SkipInstall`:
- `npm ci` somente quando necessário pelo contrato escolhido;
- `rustup target add wasm32-unknown-unknown` apenas se ausente;
- instalação de `wasm-pack` somente se ausente, usando versão/política documentada pelo projeto.

## Excluir
Nenhum arquivo.

## Gate G04
Todas as ferramentas necessárias disponíveis e versões registradas. Nenhuma reinstalação desnecessária.

---

# FASE 05 — Sequência de testes locais

## Criar
Nenhum arquivo.

## Alterar
### `Validate-Local.ps1`
Executar na ordem:
1. testes Rust do workspace;
2. oracle com `IMPECCABLE_BIN` do target isolado;
3. testes core;
4. detector;
5. live unit;
6. framework fixtures;
7. build;
8. package VS Code;
9. extension build/check não mutante;
10. live-E2E conforme Fase 06.

Após etapas que podem gerar arquivos, executar `git status --short` e falhar se arquivos rastreados forem alterados.

### `docs/ENGINE.md`
Atualizar exemplos legados de `bun run` para os comandos npm atuais onde o repositório já migrou para Node/npm. Documentar que validação Windows deve preferir `--target-dir` exclusivo e `IMPECCABLE_BIN` explícito.

## Excluir
Nenhum arquivo.

## Gate G05
Todos os testes obrigatórios PASS usando o mesmo engine isolado. Git rastreado permanece limpo.

---

# FASE 06 — Matriz live-E2E e fixtures

## Criar
Nenhum arquivo.

## Alterar
### `Validate-Local.ps1`
Executar a suíte live-E2E com `IMPECCABLE_BIN` já definido, sem novo build implícito.

Registrar variáveis de seleção:
- `IMPECCABLE_E2E_ONLY`;
- `IMPECCABLE_E2E_SCENARIOS`;
- timeouts;
- `IMPECCABLE_E2E_ARTIFACT_DIR`.

A validação completa deve cobrir, no mínimo, os grupos equivalentes à CI:
- platform;
- svelte;
- react;
e permitir full matrix quando explicitamente solicitado.

### `tests/live-e2e.test.mjs` e helpers sob `tests/live-e2e/`
Não reimplementar lógica somente para o script local. Qualquer correção descoberta deve ser feita nos helpers compartilhados e coberta por teste unitário/source test.

## Excluir
Nenhum arquivo.

## Gate G06
Live-E2E PASS no engine do G03. Nenhum fallback para engine baixado/pinned. Falhas devem produzir artefatos no `$LogRoot`.

---

# FASE 07 — Evidência e relatório final

## Criar
Gerados em runtime, não versionados:
- `test-results/local-validation/<timestamp>/summary.json`;
- `.../engine-metadata.json`;
- `.../*.log`;
- `.../cargo-target/`;
- `.../live-e2e/`.

## Alterar
### `Validate-Local.ps1`
Resumo final deve imprimir:
- PASS/FAIL geral;
- HEAD;
- branch;
- Engine;
- Engine SHA-256;
- Cargo validation target;
- Log root;
- duração por gate;
- lista de gates executados/skipped/failed;
- status Git final.

`summary.json` deve conter os mesmos dados em formato estável e legível por máquina.

Usar `try/finally` para:
- restaurar `IMPECCABLE_BIN` anterior ou removê-lo se inexistente antes;
- registrar status final mesmo em exceção;
- não apagar evidências de falha.

## Excluir
Nenhum arquivo.

## Gate G07
Relatório humano e JSON coerentes entre si; caminho de engine e hash correspondem ao arquivo utilizado.

---

# FASE 08 — Regressão automatizada no Windows CI

## Criar
Nenhum arquivo adicional além do teste da Fase 01.

## Alterar
### `.github/workflows/ci.yml`
No job `rust-windows` ou em job Windows dedicado:
- executar `node --test tests/validate-local-script.test.mjs`;
- validar que a política de target isolado está presente;
- opcionalmente executar uma versão reduzida do `Validate-Local.ps1 -SkipInstall -SkipBrowserE2E` quando custo/tempo forem aceitáveis;
- manter os gates existentes de bundle não mutante.

Não forçar lock artificial do exe global como teste principal. O contrato deve provar que a validação não precisa escrever no exe global.

### `scripts/test-suites.mjs`
Garantir que alteração em `Validate-Local.ps1`, `.github/workflows/ci.yml`, `scripts/run-tests.mjs` ou processo Live dispare a suíte apropriada.

## Excluir
Nenhum arquivo.

## Gate G08
CI Windows valida o contrato estrutural e os builds existentes continuam PASS.

---

# FASE 09 — Limpeza documental e contrato operacional

## Criar
### `docs/LOCAL-VALIDATION.md`
Runbook curto e operacional:
- pré-requisitos;
- comando padrão;
- comando com `-SkipInstall`;
- localização das evidências;
- interpretação de lock Windows;
- explicação de que cada execução usa Cargo target próprio;
- comportamento atual de cleanup no Windows;
- procedimento de diagnóstico sem matar processos genericamente.

## Alterar
### `README.md`
Adicionar link para `docs/LOCAL-VALIDATION.md` na seção de desenvolvimento/testes, sem duplicar o runbook.

### `docs/ENGINE.md`
Referenciar o runbook e alinhar terminologia com `IMPECCABLE_BIN` e target isolado.

## Excluir
Nenhum arquivo.

## Gate G09
Documentação não promete cleanup Windows inexistente e todos os comandos documentados existem no package/Cargo atual.

---

# FASE 10 — Gate final de integração

## Criar
Nenhum arquivo.

## Alterar
Nenhum arquivo além das correções eventualmente exigidas pelos gates anteriores.

## Excluir
Somente artefatos temporários fora de `test-results/local-validation/<timestamp>`. Não excluir evidência da execução usada para aprovação.

## Gate G10 — VERIFIED_PASS
Requisitos cumulativos:
- G00–G09 obrigatórios PASS;
- engine construído em target exclusivo;
- oracle e suites obrigatórias usando o mesmo `IMPECCABLE_BIN`;
- nenhuma tentativa de sobrescrever `target\release\impeccable.exe`;
- árvore Git rastreada limpa após a validação;
- nenhum processo encerrado por matching genérico;
- relatório final + evidências presentes;
- CI relevante verde no SHA a ser mesclado.

Somente após G10 o trabalho deve ser marcado como VERIFIED_PASS.

---

# 4. Fluxo recomendado do script

```text
G00 baseline/git
  -> G01 diretórios e contrato
  -> G02 cleanup best-effort/sem falsa garantia Windows
  -> G03 build isolado + probe + hash + IMPECCABLE_BIN
  -> G04 toolchain
  -> G05 testes Rust/oracle/core/detector/live/framework/build
  -> G06 live-E2E
  -> G07 relatório/evidência
  -> G08 paridade CI
  -> G09 documentação
  -> G10 VERIFIED_PASS
```

# 5. Decisões de implementação

## D1 — Isolamento vence encerramento de processo
A validação não precisa descobrir quem bloqueou o exe antigo para prosseguir. O target exclusivo remove a contenção e garante proveniência.

## D2 — Cleanup Windows não pode ser presumido
O código atual de `scripts/lib/live-server-processes.mjs` não enumera processos no Windows. Qualquer mensagem ou documentação deve refletir isso.

## D3 — Um único engine por execução
Depois de G03, `IMPECCABLE_BIN` é imutável até o `finally`. Isso impede oracle/E2E de consumirem outro binário.

## D4 — Evidência por execução
Logs, Cargo target e artefatos ficam sob o mesmo timestamp. Isso permite reproduzir qual binário gerou qual resultado.

## D5 — Sem regressão do build limpo
As mudanças já consolidadas em `ccad6a35c` para LF, bundle não mutante e Windows CI são baseline e não devem ser revertidas.

# 6. Critérios de aceitação específicos do bloqueio observado

O incidente de `Acesso negado (os error 5)` é considerado resolvido quando:
1. `target\release\impeccable.exe` pode permanecer aberto por um processo externo;
2. uma nova execução de `Validate-Local.ps1` ainda consegue compilar;
3. o novo exe nasce em `test-results\local-validation\<timestamp>\cargo-target\release\impeccable.exe`;
4. `engine-probe`, oracle e live-E2E usam esse caminho;
5. a execução não encerra indiscriminadamente o processo que mantém o exe antigo aberto;
6. o relatório final registra o caminho/hash do novo engine.

# 7. Arquivos consolidados por ação

## Criar
- `Validate-Local.ps1`
- `tests/validate-local-script.test.mjs`
- `docs/LOCAL-VALIDATION.md`
- runtime apenas: `test-results/local-validation/**`

## Alterar
- `.gitignore`
- `package.json`
- `scripts/test-suites.mjs`
- `scripts/run-tests.mjs`
- `scripts/lib/live-server-processes.mjs`
- `tests/live-server-leak.test.mjs`
- `.github/workflows/ci.yml`
- `docs/ENGINE.md`
- `README.md`
- `tests/live-e2e.test.mjs` e `tests/live-e2e/**` somente se a execução revelar defeito compartilhado real.

## Excluir
- nenhum arquivo rastreado nesta especificação;
- não excluir branches históricas como substituto para merge;
- não apagar evidências da execução final aprovada.

# 8. Comando operacional alvo

```powershell
Set-Location C:\repos\impeccable-flutter

Set-ExecutionPolicy `
    -Scope Process `
    -ExecutionPolicy Bypass `
    -Force

.\Validate-Local.ps1 -SkipInstall
```

O script deve concluir usando um engine exclusivo da execução mesmo que `C:\repos\impeccable-flutter\target\release\impeccable.exe` esteja bloqueado.
