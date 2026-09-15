# Impeccable Flutter — plano validado de arquivos para implementação

Data da análise: 2026-09-15

Repositório: `fabriciocs/impeccable-flutter`  
Branch: `main`  
HEAD validado antes desta revisão documental: `e6b2ee7553fb8431cace79549da0859d4321167a`  
Baseline funcional Flutter analisada: `8c64a09e311706bb3fb439bc34f02f9848d75b5d`  
Upstream comparado: `pbakaus/impeccable:main`

## 1. Resultado do pull/sincronização

Foi lido o `main` remoto mais recente e comparado com `pbakaus/impeccable:main`.

No momento da validação, antes deste commit documental:

- `behind_by: 0`: não há commits pendentes do upstream para incorporar;
- `ahead_by: 4`: o fork possui quatro commits próprios sobre o upstream;
- `099ba8b587dc9e61c05e099b1d75c155894bff26`: integração inicial Flutter/Dart;
- `2d05d68450c0a798f5078777bf49b004f9357300`: regeneração dos outputs dos providers;
- `8c64a09e311706bb3fb439bc34f02f9848d75b5d`: documentação/ajustes Flutter anteriores;
- `e6b2ee7553fb8431cace79549da0859d4321167a`: criação da primeira versão deste plano.

Este próprio ajuste documental cria mais um commit do fork, portanto a contagem `ahead_by` pode aumentar sem representar nova alteração funcional.

**Conclusão:** não é necessário merge/rebase do upstream neste momento. O trabalho pendente é completar e endurecer a integração Flutter/Dart no código do fork.

## 2. Evidências verificadas no código atual

A análise não foi baseada apenas em nomes de arquivos. Foram conferidos pontos funcionais do código e da documentação atual.

1. `crates/detect/src/cli.rs` ainda conduz a detecção de diretório pelo fluxo `detect_framework_config()` e a detecção Flutter não está integrada de forma completa ao caminho principal da CLI.
2. `crates/detect/src/file_system_flutter.rs` possui detector Flutter separado, mas a identificação do projeto depende de heurísticas de conteúdo/arquivos e precisa de uma fonte de verdade compartilhada e mais estruturada.
3. `crates/context/src/context_cli.rs` trata `ios`, `android` e `adaptive` como `native` e desabilita o fallback do detector nesses casos. Isso conflita com Flutter: um app Flutter Android/iOS continua tendo Dart source que deve poder ser analisado.
4. O `RESOLVED_CONTEXT` atual expõe `platform`, mas não expõe um sinal separado e determinístico de tecnologia/framework; Flutter não deve ser inferido apenas de `platform`.
5. `README.md` continua apresentando o produto principalmente como detector de frontend genérico/Web e não documenta Flutter/Dart como capacidade de primeira classe.
6. `skill/reference/flutter.md` recomenda `flutter format --set-exit-if-changed .`; a formatação deve usar a ferramenta Dart compatível com o SDK do projeto, por exemplo `dart format --output=none --set-exit-if-changed .` quando suportado.
7. A integração inicial já adicionou regras Dart, detector Flutter, fixtures/testes, referência Flutter e mensagens de Flutter Web. O correto é completar essa arquitetura, não criar uma implementação paralela.
8. Outputs dos providers são derivados de fontes canônicas e não devem ser corrigidos manualmente.

## 3. Resumo de ações

| Grupo | Decisão |
|---|---|
| Ajustar | Contexto, CLI de detecção, detector Flutter/Dart, testes/fixtures, skill, README, extensão e eventualmente CI/configuração. |
| Criar | Um helper Flutter compartilhado em `crates/common/src/flutter.rs` e fixtures adicionais somente quando necessárias. |
| Excluir | Nenhum arquivo inteiro neste estágio. Remover apenas lógica duplicada/obsoleta dentro dos arquivos ajustados quando substituída pelo helper compartilhado. |
| Não editar diretamente | Outputs gerados de providers/distribuição. Alterar as fontes canônicas e regenerar. |

## 4. Arquivos que DEVEM SER AJUSTADOS

### P0 — integração funcional

| Arquivo | Ajuste necessário | Critério de conclusão |
|---|---|---|
| `crates/common/src/lib.rs` | Exportar o novo helper compartilhado, por exemplo `pub mod flutter;`, caso `crates/common/src/flutter.rs` seja criado. | `context` e `detect` conseguem consumir a mesma identificação Flutter sem dependência circular. |
| `crates/context/src/context.rs` | Tornar discovery/contexto Flutter-aware: reconhecer `pubspec.yaml`, `lib/`, `.dart`, `melos.yaml` e workspace Dart; localizar entry points; considerar Dart/Flutter implementação visual; adicionar tecnologia/framework separado de `Platform`; cobrir app simples e monorepo. | Projeto Flutter é resolvido corretamente mesmo sem Web/Node e Dart puro não vira Flutter por engano. |
| `crates/context/src/context_cli.rs` | Propagar `framework`/`technology` no contexto resolvido; não desabilitar detector source apenas porque `platform` é Android/iOS/adaptive quando tecnologia é Flutter; tornar mensagens Web-específicas neutras quando necessário; adicionar testes. | Flutter nativo continua recebendo instrução de source scan Dart; Web existente não regride. |
| `crates/detect/src/cli.rs` | Integrar `detect_flutter_project()` ou o helper comum ao fluxo real de diretórios; atualizar usage/examples para `.dart`, `lib/` e Flutter Web; separar source scan de browser scan; nunca assumir porta Flutter fixa. | `impeccable detect lib/` e diretórios Flutter chegam deterministicamente ao scanner Dart. |
| `crates/detect/src/file_system_flutter.rs` | Consumir a identificação compartilhada; abandonar parsing textual frágil do `pubspec.yaml`; distinguir Dart puro, Flutter app, package, plugin e target Web; aceitar entry points além de `lib/main.dart`; substituir flags ambíguas por sinais claros. | Classificação é estável para app/package/plugin/Web e rejeita Dart puro. |
| `crates/detect/src/detect_text_flutter.rs` | Preservar fallback Web; garantir `rule_pack`, ignores inline e comportamento de Dart via stdin; impedir duplicação de registro/resultado em scan multiarquivo. | Contratos existentes permanecem compatíveis e testes cobrem stdin/múltiplos arquivos/ignores. |
| `crates/detect/src/detect_dart.rs` | Endurecer as regras Flutter atuais; reduzir dependência de janelas fixas; melhorar tratamento de `GestureDetector`/`InkWell`, cards/containers, ThemeData/TextTheme/ThemeExtension e Material/Cupertino sem alterar IDs públicos das regras. | Cada regra tem positivo, negativo e casos limite com falsos positivos controlados. |
| `crates/detect/tests/flutter_dart.rs` | Expandir cobertura para cada regra, inline ignore, `rule_pack`, Dart puro, app/package/plugin/Web, diretórios mistos, caminhos Windows/POSIX e múltiplos arquivos. | Cobertura protege integração funcional e compatibilidade de plataforma. |
| `crates/detect/tests/fixtures/flutter/bad.dart` | Manter violações agregadas inequívocas; mover casos ambíguos para testes unitários específicos. | Fixture não depende de heurística frágil. |
| `crates/detect/tests/fixtures/flutter/good.dart` | Adicionar Material 3/ColorScheme, ThemeExtension, Semantics, LayoutBuilder/MediaQuery, estruturas legítimas de container e estilos locais válidos. | Casos Flutter modernos válidos não geram falsos positivos. |

### P1 — skill, documentação e UX

| Arquivo | Ajuste necessário | Critério de conclusão |
|---|---|---|
| `skill/reference/flutter.md` | Corrigir a orientação de formatação; documentar app/package/plugin/monorepo; diferenciar `flutter analyze`/`dart analyze`; cobrir widget/golden/integration tests; diferenciar Material, Cupertino e design system customizado; explicar que browser live não substitui validação Flutter. | Comandos documentados são executáveis e refletem o comportamento real do produto. |
| `skill/SKILL.src.md` | Carregar `reference/flutter.md` por sinal determinístico de framework/tecnologia; manter Flutter nativo no detector Dart; preservar roteamento dos comandos existentes. | Skill não depende de inferência de plataforma para reconhecer Flutter. |
| `README.md` | Declarar Flutter/Dart como capacidade oficial; documentar `impeccable detect lib/`; separar scan source Dart e scan renderizado Flutter Web; revisar contagem de regras; incluir exemplo Flutter e esclarecer mobile/desktop sem servidor Web. | Usuário consegue instalar e usar suporte Flutter sem conhecimento implícito do fork. |
| `extension/popup/popup.js` | Isolar detecção Flutter Web em função testável; evitar dependência exclusiva de internals `flt-*`; reconhecer bootstraps atuais; manter detecção best-effort e atualizar estado na navegação/troca de aba quando aplicável. | Falha de heurística da extensão não altera a classificação do projeto source. |
| `extension/popup/popup.html` | Atualizar textos somente se CLI/estado visual exigir; manter explícita a diferença entre output renderizado e `lib/`. | UX não sugere que browser scan analisa Dart. |
| `extension/popup/popup.css` | Alterar apenas se novos estados/hints precisarem de layout/acessibilidade. | Nenhuma alteração cosmética desnecessária. |
| `.github/workflows/ci.yml` | Garantir que mudanças Flutter/Dart executem testes Rust e validações relevantes; rever `paths` apenas se testes novos ficarem fora de `crates/`. | PRs com regressão Flutter não passam CI. |
| `.github/workflows/sync-generated-output.yml` | Revisar somente se novas fontes canônicas Flutter não forem propagadas pelo build de release. | Providers gerados permanecem sincronizados automaticamente. |

### P2 — ajustes condicionais

| Arquivo | Alterar somente se |
|---|---|
| `crates/context/Cargo.toml` | O parsing/identificação compartilhado exigir dependência que ainda não esteja disponível. Não criar dependência `context -> detect`. |
| `crates/detect/Cargo.toml` | Houver nova dependência necessária para consumir/parsing compartilhado. |
| `Cargo.toml` | For realmente criado um novo crate. Não é necessário se a lógica compartilhada ficar em `impeccable-common`. |

## 5. Arquivos que DEVEM SER CRIADOS

### 5.1 `crates/common/src/flutter.rs`

**Recomendado.** Deve ser a fonte única de identificação de projeto Dart/Flutter utilizada por `context` e `detect`.

Responsabilidades:

- interpretar os sinais relevantes do `pubspec.yaml` de forma estruturada/segura;
- indicar `is_dart` e `is_flutter` separadamente;
- identificar app/package/plugin quando determinável;
- indicar `has_web_target`, `has_dart_source` e possíveis entry points;
- reconhecer sinais de workspace Dart/Melos quando aplicável;
- não inferir porta ou URL;
- não conter regras de design/anti-patterns;
- evitar duplicação de parsing entre crates.

Se a arquitetura existente oferecer um módulo compartilhado melhor, o caminho pode ser adaptado, mas deve existir **uma única fonte de verdade**, não duas implementações divergentes.

### 5.2 Testes do helper Flutter

Preferir testes unitários no próprio `crates/common/src/flutter.rs`. Criar arquivo de teste separado somente se isso seguir melhor o padrão do crate.

Cobrir no mínimo:

- Dart puro;
- Flutter app;
- Flutter package;
- Flutter plugin;
- Flutter Web;
- ocorrência incidental de `flutter:` que não declara SDK Flutter;
- comentários/formatações diferentes no pubspec;
- workspace Dart/Flutter;
- Melos quando aplicável.

### 5.3 Fixtures adicionais de projeto

Criar somente quando deixarem os testes de integração mais claros. Candidatas:

- `flutter_app/`;
- `flutter_package/`;
- `flutter_plugin/`;
- `flutter_web/`;
- `dart_only/`;
- `melos_workspace/`.

Evitar fixtures grandes ou duplicadas quando `tempdir`/teste unitário expressar o cenário de forma suficiente.

## 6. Arquivos que DEVEM SER EXCLUÍDOS

**Nenhum arquivo inteiro deve ser excluído no estado atual.**

Não excluir:

- `crates/detect/src/detect_text_flutter.rs`;
- `crates/detect/src/file_system_flutter.rs`;
- `crates/detect/src/detect_text.rs`;
- `crates/detect/src/file_system.rs`;
- `docs/FLUTTER-ADJUSTMENTS.md`;
- outputs gerados dos providers;
- referências Flutter geradas.

Ao criar o helper comum, remover **somente trechos duplicados** de parsing/classificação que ele substituir dentro de `file_system_flutter.rs`, `context.rs` ou outros consumidores. Não remover wrappers inteiros antes de os testes demonstrarem que são dispensáveis.

## 7. Arquivos GERADOS — não editar manualmente

Não corrigir diretamente cópias de skill/referências em providers, incluindo famílias como:

- `.agent/skills/impeccable/**`;
- `.agents/skills/impeccable/**`;
- `.claude/**` e `.claude-plugin/**` quando gerados;
- `.cursor/**` e `.cursor-plugin/**` quando gerados;
- `.codex/**` quando gerado;
- demais diretórios de provider produzidos pelo release build;
- `plugin/**` e `cursor-plugin/**` quando forem saídas derivadas.

Fontes canônicas a editar:

- `skill/SKILL.src.md`;
- `skill/reference/flutter.md`;
- demais fontes em `skill/` apenas quando necessário.

Depois das mudanças, executar o processo oficial de geração (`bun run build:release` ou workflow equivalente) e revisar o diff gerado.

## 8. Ordem de implementação

1. Criar a identificação Flutter compartilhada em `crates/common/src/flutter.rs` e exportá-la em `crates/common/src/lib.rs`.
2. Ajustar `crates/context/src/context.rs`.
3. Ajustar `crates/context/src/context_cli.rs` e o contrato de `RESOLVED_CONTEXT`.
4. Ajustar `crates/detect/src/file_system_flutter.rs` para consumir a mesma identificação.
5. Conectar Flutter ao fluxo real em `crates/detect/src/cli.rs`.
6. Endurecer `detect_text_flutter.rs` e `detect_dart.rs`.
7. Expandir testes e fixtures de detector/contexto.
8. Corrigir e ampliar `skill/reference/flutter.md`.
9. Ajustar `skill/SKILL.src.md`.
10. Atualizar `README.md`.
11. Endurecer a detecção Flutter Web da extensão.
12. Revisar CI e geração de providers.
13. Regenerar outputs derivados.
14. Executar suíte completa e revisar regressões Web.

## 9. Validações obrigatórias

Antes de considerar a implementação concluída:

- `cargo build --workspace --all-targets` deve passar;
- `cargo test --workspace` deve passar;
- testes específicos de Dart/Flutter devem passar;
- testes de contexto devem cobrir app Flutter simples e monorepo/workspace;
- Dart puro não pode ser classificado como Flutter;
- regressões Web existentes devem continuar verdes;
- build/testes Node aplicáveis devem passar;
- extensão deve continuar funcional em página não Flutter e Flutter Web;
- `bun run build:release` deve regenerar providers sem drift manual;
- `git diff` após regeneração deve conter apenas saídas esperadas;
- Flutter Android/iOS/adaptive deve manter source scan Dart disponível;
- Flutter mobile/desktop não pode depender de URL/porta;
- Flutter Web deve poder usar source scan e browser scan como camadas complementares.

## 10. Definition of Done

A integração Flutter estará concluída somente quando:

1. `context` e `detect` reconhecem Flutter deterministicamente pela mesma fonte de verdade;
2. `lib/**/*.dart` pode ser reconhecido como implementação visual relevante;
3. app/package/plugin/workspace são diferenciados quando necessário;
4. Dart puro não gera falso reconhecimento Flutter;
5. Flutter Android/iOS/desktop funciona sem pressupor servidor ou porta;
6. Flutter Web usa browser scan apenas quando uma URL real estiver disponível;
7. regras Dart possuem casos positivos, negativos e casos limite;
8. CLI realmente encaminha diretórios Flutter ao detector Dart;
9. documentação e skill descrevem comandos e comportamento reais;
10. providers são regenerados pelas fontes canônicas;
11. toda a suíte Web anterior permanece sem regressão.

## 11. Decisão arquitetural principal

A próxima implementação não deve adicionar mais heurísticas isoladas em `context` e `detect`. O primeiro passo deve ser centralizar a identificação Dart/Flutter em `impeccable-common` e fazer os consumidores usarem o mesmo resultado. Isso resolve o maior risco atual: o mesmo projeto ser classificado de maneiras diferentes pela CLI, pelo contexto e pela skill.
