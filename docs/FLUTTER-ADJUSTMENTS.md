# Impeccable Flutter — análise de arquivos e ajustes necessários

Data da análise: 2026-09-15

Repositório: `fabriciocs/impeccable-flutter`
Branch analisada: `main`
HEAD analisado: `2d05d68450c0a798f5078777bf49b004f9357300`
Upstream comparado: `pbakaus/impeccable:main`

## 1. Estado do repositório

No momento desta análise o fork está sincronizado com o upstream e contém somente a adaptação Flutter adicional:

- `behind_by: 0` — não existe commit pendente do upstream para trazer;
- `ahead_by: 2` — o fork possui dois commits próprios;
- `099ba8b587dc9e61c05e099b1d75c155894bff26` adicionou o suporte inicial Flutter/Dart;
- `2d05d68450c0a798f5078777bf49b004f9357300` regenerou os outputs dos providers.

Portanto, o equivalente ao `pull` está resolvido no estado remoto analisado: não há merge/rebase de upstream pendente.

## 2. Diagnóstico executivo

A adaptação atual é funcional como primeira camada, mas ainda não transforma o Impeccable em uma implementação Flutter completamente integrada.

Já existe:

- detector de anti-patterns em Dart;
- `.dart` incluído no scan de diretórios;
- detecção básica de `pubspec.yaml` com Flutter SDK;
- fixtures positivas/negativas para o detector Dart;
- orientação Flutter em `skill/reference/flutter.md`;
- roteamento da skill para carregar essa referência;
- aviso da extensão quando uma página Flutter Web é identificada;
- outputs dos providers regenerados.

O principal problema restante é que a integração foi adicionada majoritariamente como wrappers do crate `detect`, enquanto o restante do produto continua assumindo projeto Web/Node em pontos importantes. Em especial, a CLI não usa `detect_flutter_project()` no fluxo de diretórios e o crate de contexto ainda não considera `lib/`, `.dart`, `pubspec.yaml`, Melos ou Dart workspaces como sinais de projeto/UI.

## 3. Ajustes P0 — necessários para a integração funcional

### 3.1 `crates/detect/src/cli.rs`

**Situação atual**

A CLI importa e executa `detect_framework_config()`, mas não `detect_flutter_project()`. Consequentemente, a função Flutter criada em `file_system_flutter.rs` não participa do fluxo principal de `impeccable detect <diretório>` para explicar ao usuário que o projeto é Flutter.

O help também descreve arquivos não HTML apenas como `CSS, JSX, TSX, etc.` e o modo URL como a principal inspeção renderizada, sem explicar a separação entre source scan Dart e Flutter Web.

**Ajustes**

1. Importar `detect_flutter_project` no fluxo da CLI.
2. Ao receber diretório, detectar Flutter antes/de forma complementar a `detect_framework_config`.
3. Para Flutter source, informar que `.dart` será analisado diretamente.
4. Para Flutter Web, informar que o source scan e o browser scan são camadas diferentes.
5. Nunca inventar porta para Flutter; somente recomendar URL quando ela for fornecida/conhecida.
6. Atualizar `USAGE`, `Detection modes` e exemplos com `.dart`, `lib/` e Flutter Web.
7. Adicionar testes do texto/fluxo da CLI para projeto Flutter source e Flutter Web.

**Critério de aceite**

`impeccable detect .` em um projeto Flutter identifica o projeto, varre Dart e não sugere uma porta fixa inexistente.

---

### 3.2 `crates/detect/src/file_system_flutter.rs`

**Situação atual**

`detect_flutter_project()` usa busca textual simples por `sdk: flutter`, `sdk:flutter` ou uma linha `flutter:`. Isso é suficiente para o fixture atual, porém pode produzir falso positivo e não representa corretamente variantes de packages/plugins/workspaces.

O campo `source_only` também fica semanticamente ambíguo: em Flutter Web ele pode ser `true` simplesmente porque `lib/main.dart` existe, embora o projeto também tenha target Web.

**Ajustes**

1. Tornar a leitura do `pubspec.yaml` estruturalmente mais segura, sem depender apenas de `contains` global.
2. Distinguir projeto Dart puro de Flutter por dependência SDK Flutter válida.
3. Reconhecer app Flutter, package Flutter e plugin Flutter.
4. Representar separadamente sinais como `has_dart_source` e `has_web_target`, evitando o booleano ambíguo `source_only`.
5. Considerar entry points diferentes de `lib/main.dart` sem deixar de reconhecer o projeto.
6. Criar testes negativos com `pubspec.yaml` Dart puro e texto incidental contendo `flutter:`.
7. Criar testes para package/plugin Flutter e target Web.

**Critério de aceite**

Dart puro não é classificado como Flutter; Flutter app/package/plugin é reconhecido de maneira consistente e sem pressupor servidor/porta.

---

### 3.3 `crates/detect/src/detect_text_flutter.rs`

**Situação atual**

O wrapper despacha para o detector Dart apenas quando a extensão calculada é `.dart`. O comportamento é correto para arquivos, mas stdin sem `file_path` continua sem contexto de linguagem.

**Ajustes**

1. Preservar o fallback upstream para todas as extensões não Dart.
2. Garantir testes para `rule_pack` e inline ignores em Dart.
3. Documentar/implementar uma forma explícita de informar filename/linguagem quando Dart vier via stdin, se stdin for um caso suportado para source scan.
4. Garantir que nenhuma regra Dart seja registrada/duplicada de maneira não determinística em scans multiarquivo.

**Critério de aceite**

O comportamento Web upstream permanece inalterado e Dart passa pelo mesmo pipeline de configuração/ignore/extensibilidade.

---

### 3.4 `crates/detect/src/detect_dart.rs`

**Situação atual**

Há oito regras Flutter source implementadas por regex/context windows. É uma boa primeira versão, mas algumas heurísticas podem gerar falsos positivos/negativos em Dart real, especialmente widgets formatados em várias linhas e componentes customizados.

**Ajustes**

1. Isolar uma função/teste por regra para facilitar regressão.
2. Reduzir dependência de janelas fixas de linhas quando a relação estrutural puder atravessar mais linhas.
3. Melhorar detecção de containers/cards aninhados sem confundir containers de layout não decorativos.
4. Melhorar `GestureDetector`/`InkWell` para não considerar qualquer `label:` próximo como prova de semântica.
5. Considerar controles Flutter equivalentes e padrões Material/Cupertino relevantes.
6. Validar `TextStyle` contra ThemeData/TextTheme/ThemeExtension sem penalizar exceções legítimas.
7. Manter IDs, categoria, scope e mensagens estáveis para compatibilidade de ignores/configuração.
8. Adicionar testes específicos de false-positive e false-negative para cada regra.

**Critério de aceite**

Cada regra tem pelo menos um caso que deve disparar, um caso que deve permanecer limpo e um caso limite representativo de código Flutter formatado normalmente.

---

### 3.5 `crates/detect/tests/flutter_dart.rs`

**Ajustes**

Expandir a suíte para cobrir:

- as oito regras individualmente;
- inline ignores por linha, próxima linha e arquivo;
- `rule_pack` em `.dart`;
- diretório contendo Dart + arquivos Web;
- projeto Dart puro;
- Flutter app, package, plugin e Web;
- caminhos Windows e POSIX;
- múltiplos arquivos para confirmar ausência de registro duplicado.

### 3.6 `crates/detect/tests/fixtures/flutter/bad.dart`

Manter como fixture agregada, mas acrescentar somente casos estáveis. Casos ambíguos devem ir para testes unitários menores para que uma alteração de heurística não esconda a origem da regressão.

### 3.7 `crates/detect/tests/fixtures/flutter/good.dart`

Aumentar o fixture limpo com:

- `ThemeExtension`;
- Material 3/ColorScheme;
- `Semantics` e controles padrão;
- `LayoutBuilder`/MediaQuery;
- `Container` puramente estrutural;
- estilos locais legítimos que não devem virar falso positivo.

## 4. Ajustes P1 — contexto e descoberta de projetos Flutter

### 4.1 `crates/context/src/context.rs`

Este é o maior ponto ainda web-first.

**Problemas observados**

- `VISUAL_SOURCE_DIRS` não contém `lib`;
- `UI_EXTENSIONS` não contém `.dart`;
- `is_candidate_project_root()` procura `package.json`, `src`, `app`, `pages` e `public`, mas não `pubspec.yaml`/`lib`;
- `find_target_example()` não procura `lib/main.dart`;
- discovery de workspaces é baseada em package/pnpm/lerna;
- `MONOREPO_MARKER_FILES` não contém `melos.yaml`;
- `extract_platform()` aceita apenas `web`, `ios`, `android` e `adaptive`.

**Ajustes**

1. Incluir `lib` como fonte visual quando o projeto for Flutter/Dart.
2. Incluir `.dart` como extensão UI para a detecção de implementação visual.
3. Criar evidência Flutter específica (`Widget`, `StatelessWidget`, `StatefulWidget`, `MaterialApp`, `CupertinoApp`, `ThemeData`, etc.) em vez de aplicar apenas regex CSS/HTML ao Dart.
4. Reconhecer `pubspec.yaml` como marcador de project root.
5. Incluir `lib/main.dart` e/ou entry point Dart detectado em `find_target_example()`.
6. Reconhecer monorepos Melos (`melos.yaml`) e Dart workspaces modernos (`workspace:` em `pubspec.yaml`).
7. Reconhecer packages Flutter em `packages/*`, `apps/*` e padrões declarados pelo workspace.
8. Não forçar `flutter` para o campo de produto `Platform` se o schema continuar representando destino (`web/ios/android/adaptive`). Preferir um sinal separado, por exemplo `framework: flutter` ou `technology: flutter`.
9. Adicionar testes de resolução/contexto para app Flutter simples e monorepo Flutter/Melos.

**Critério de aceite**

`impeccable context` deve considerar um projeto Flutter com `lib/*.dart` como implementação visual existente e resolver corretamente o project root/target em app simples e monorepo.

---

### 4.2 `crates/context/src/context_cli.rs`

**Problemas observados**

O fluxo diferencia apenas plataformas nativas pelo valor de `PRODUCT.md`. Para `ios`, `android` e `adaptive`, o detector automático/manual é desabilitado como se toda UI nativa não tivesse detector source. Isso entra em conflito com Flutter: agora existe detector Dart mesmo quando o destino é Android/iOS.

Além disso, `MANUAL_DETECTOR_REQUIRED` fala em `changed web UI`.

**Ajustes**

1. Levar um sinal determinístico `is_flutter`/`framework` do contexto para a diretiva resolvida.
2. Não desabilitar o detector Dart somente porque `Platform` é `ios`, `android` ou `adaptive` quando a tecnologia é Flutter.
3. Tornar a mensagem do fallback neutra (`changed UI/source targets`) e, em Flutter, recomendar `impeccable detect <lib-or-dart-target>`.
4. Incluir o framework/technology no JSON `RESOLVED_CONTEXT`.
5. Manter o comportamento atual para Swift/Kotlin/React Native/outros nativos sem detector específico.
6. Adicionar testes de `automatic_hook_mode`, fallback e resolved context para Flutter Android/iOS/adaptive.

**Critério de aceite**

Um Flutter Android/iOS não perde o detector Dart apenas porque o produto é classificado como plataforma nativa.

---

### 4.3 `crates/context/Cargo.toml`

Evitar simplesmente criar dependência de `impeccable-context` para `impeccable-detect` apenas para reconhecer Flutter, porque isso aumenta acoplamento e pode criar direção arquitetural inadequada.

Se a identificação de tecnologia precisar ser compartilhada entre `context` e `detect`, extrair a leitura mínima de `pubspec.yaml` para um módulo/crate inferior já compartilhado (`common`/`foundation`) e fazer ambos dependerem dele. Ajustar este `Cargo.toml` somente se essa extração exigir nova dependência.

## 5. Ajustes P1 — skill e documentação

### 5.1 `skill/reference/flutter.md`

A referência é boa e já cobre tema, layout, acessibilidade, motion e source-vs-browser. Há, porém, uma correção objetiva necessária:

- substituir `flutter format --set-exit-if-changed .` por um comando Dart válido, por exemplo `dart format --output=none --set-exit-if-changed .` para verificação, ou pelo comando de formatação adotado pelo repositório.

Também ajustar/expandir:

1. explicar app/package/plugin e monorepo Flutter;
2. citar `dart analyze` quando o projeto usar fluxo Dart específico, mantendo `flutter analyze` para apps Flutter;
3. explicar golden tests e atualização de goldens somente quando intencional;
4. diferenciar Material, Cupertino e design system customizado;
5. explicitar que browser live mode não substitui widget/golden/integration tests.

---

### 5.2 `skill/SKILL.src.md`

**Ajustes**

1. Preservar `skill/reference/flutter.md` como fonte canônica Flutter.
2. Fazer o roteamento usar o sinal determinístico do contexto quando ele existir, em vez de depender de o agente redescobrir Flutter manualmente em toda execução.
3. Explicar que Flutter nativo pode usar detector Dart mesmo quando browser live não se aplica.
4. Manter `audit`, `adapt`, `polish`, `optimize` e tarefas gerais carregando a referência Flutter quando aplicável.

Após alterar este arquivo, **não editar manualmente as cópias dos providers**; executar o build de release ou deixar o workflow de sync regenerá-las.

---

### 5.3 `README.md`

O README ainda apresenta o projeto como frontend predominantemente Web e informa `61 deterministic detector rules`, sem explicar as novas regras Dart.

**Ajustes**

1. Adicionar Flutter/Dart ao resumo e à seção `What's Included`.
2. Documentar `impeccable detect lib/`.
3. Explicar source scan Dart versus rendered scan Flutter Web.
4. Atualizar a contagem de regras de modo consistente com a arquitetura: deixar claro se são 61 regras Web/browser + 8 regras Flutter source ou alterar a contagem global somente depois de confirmar como o registry expõe o total em cada target.
5. Adicionar exemplo de uso Flutter.
6. Explicar que Flutter mobile/desktop não exige servidor Web.

## 6. Ajustes P1/P2 — extensão Flutter Web

### 6.1 `extension/popup/popup.js`

A heurística atual verifica `window._flutter`, elementos `flt-*` e scripts `flutter_bootstrap.js`/`main.dart.js`.

**Ajustes recomendados**

1. Extrair a detecção para função testável reutilizável, se houver suíte da extensão adequada.
2. Cobrir renderizadores/bootstraps Flutter Web atuais sem depender exclusivamente de elementos internos `flt-*`.
3. Manter a detecção como best-effort: ela deve alterar somente a orientação exibida, nunca o resultado do detector.
4. Atualizar o hint ao trocar/navegar a aba quando o lifecycle do popup permitir.

### 6.2 `extension/popup/popup.html`

A mensagem atual está conceitualmente correta. Ajustar apenas se a CLI passar a oferecer um comando/flag mais específico. Manter explícito que o scan do browser vê output renderizado e o scan `lib/` vê Dart.

### 6.3 `extension/popup/popup.css`

Nenhuma mudança funcional obrigatória. Alterar apenas em conjunto com mudanças de estado/acessibilidade do hint. Não criar tratamento visual Flutter separado que pareça um erro.

## 7. Ajustes P1 — CI e prevenção de drift

### 7.1 `.github/workflows/ci.yml`

**Problema**

O workflow de sync declara um conjunto amplo de `GENERATED_PATHS`, enquanto o passo `Verify generated tracked outputs` da CI verifica apenas uma parte dos providers. Isso permite que determinadas cópias geradas fiquem desatualizadas sem que o PR falhe.

**Ajustes**

1. Alinhar a lista verificada pela CI com os paths efetivamente gerados pelo build/release.
2. Incluir explicitamente os providers atualmente omitidos pela verificação, ou centralizar a lista em script único reutilizado pelo CI e pelo sync.
3. Garantir que alterações em `skill/reference/flutter.md` e `SKILL.src.md` causem build e drift-check dos outputs.
4. Manter `cargo test --workspace` em Linux e Windows; os testes Flutter aqui são testes do detector Rust, portanto não é necessário instalar Flutter SDK para validar a lógica Rust.
5. Adicionar gates específicos somente se forem criados fixtures/projetos Flutter executáveis que realmente precisem do SDK Flutter.

---

### 7.2 `scripts/ci-test-plan.mjs`

Atualmente qualquer alteração em `crates/` já ativa a suíte Rust, o que cobre `detect` e `context`. Manter essa propriedade.

Se forem criados fixtures/tests Flutter fora de `crates/`, adicionar seus paths aos triggers apropriados para que PRs não pulem a suíte relevante.

## 8. Outputs gerados — não editar manualmente

O commit `2d05d684...` mostra que a alteração canônica da skill é replicada em dezenas de providers, por exemplo:

- `.agent/skills/impeccable/**`;
- `.agents/skills/impeccable/**`;
- `.claude/skills/impeccable/**`;
- `.codex/**`;
- `.cursor/skills/impeccable/**`;
- `.dsh/skills/impeccable/**`;
- `.gemini/**`;
- `.github/skills/**`;
- `.grok/**`;
- `.hermes/**`;
- `.opencode/**`;
- `.pi/**`;
- `.qoder/**`;
- `.rovodev/**`;
- `.trae/**`;
- `.trae-cn/**`;
- `.veto/**`;
- `.vibe/**`;
- `plugin/**`;
- `cursor-plugin/**`.

Esses arquivos devem ser tratados como **derivados**. A fonte a alterar é `skill/SKILL.src.md`, `skill/reference/flutter.md` e demais fontes canônicas. Depois, executar `bun run build:release` ou permitir que `.github/workflows/sync-generated-output.yml` faça a sincronização.

## 9. Ordem recomendada de implementação

1. `crates/context/src/context.rs` — tornar a descoberta e `hasVisualImplementation` Flutter-aware.
2. `crates/context/src/context_cli.rs` — propagar tecnologia Flutter e não desligar o detector Dart em Flutter nativo.
3. `crates/detect/src/cli.rs` — conectar `detect_flutter_project()` ao fluxo real da CLI.
4. `crates/detect/src/file_system_flutter.rs` — endurecer identificação de pubspec/targets.
5. `crates/detect/src/detect_dart.rs` — reduzir falsos positivos e ampliar cobertura.
6. `crates/detect/src/detect_text_flutter.rs` — completar comportamento de dispatch/config/stdin.
7. `crates/detect/tests/flutter_dart.rs` + fixtures — transformar todos os itens acima em regressão automatizada.
8. `skill/reference/flutter.md` — corrigir comando de format e completar orientação.
9. `skill/SKILL.src.md` — consumir sinal determinístico do contexto.
10. `README.md` — documentar o suporte real depois que contratos/CLI estiverem estabilizados.
11. `extension/popup/*` — endurecimento opcional do reconhecimento Flutter Web.
12. `.github/workflows/ci.yml` — fechar drift e garantir cobertura de todas as saídas geradas.
13. Regenerar providers com `bun run build:release` e verificar `git diff`.
14. Rodar `cargo build --workspace --all-targets`, `cargo test --workspace`, testes Node/detector aplicáveis e build de extensão.

## 10. Definition of Done

A adaptação Flutter pode ser considerada completa quando todos os itens abaixo forem verdadeiros:

- projeto Flutter é reconhecido deterministicamente pelo contexto;
- `lib/*.dart` conta como implementação visual;
- monorepo Flutter/Melos resolve project roots corretamente;
- `impeccable detect .` e `impeccable detect lib/` analisam Dart e explicam o modo Flutter;
- Flutter Web não recebe porta inventada;
- Flutter Android/iOS/adaptive continua elegível ao detector source Dart;
- as oito regras Flutter possuem cobertura positiva, negativa e de edge cases;
- Dart puro não é confundido com Flutter;
- README e skill descrevem corretamente source scan versus browser scan;
- o comando de formatação da referência Flutter é válido;
- outputs de providers são regenerados somente a partir das fontes canônicas;
- CI detecta qualquer drift dos providers relevantes;
- workspace Rust passa em Linux e Windows;
- comportamento Web upstream continua sem regressão.

## 11. Arquivos que não devem ser alterados diretamente

Não editar manualmente as cópias geradas de `SKILL.md`/`reference/flutter.md` dentro dos providers. Elas devem mudar exclusivamente pela geração a partir das fontes canônicas.

Também não é necessário substituir os arquivos upstream `crates/detect/src/detect_text.rs` e `crates/detect/src/file_system.rs` enquanto os wrappers Flutter conseguirem preservar compatibilidade. A estratégia de wrappers reduz conflito com futuras sincronizações do upstream; só mover a lógica para os arquivos upstream se houver uma razão arquitetural objetiva e testes suficientes para proteger o merge futuro.