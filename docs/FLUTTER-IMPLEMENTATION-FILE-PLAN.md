# Impeccable Flutter — plano de arquivos para implementação

Data da análise: 2026-09-15

Repositório: `fabriciocs/impeccable-flutter`
Branch: `main`
HEAD analisado: `8c64a09e311706bb3fb439bc34f02f9848d75b5d`
Upstream comparado: `pbakaus/impeccable:main`

## 1. Estado após pull/sincronização

O estado remoto do `main` foi atualizado e comparado com o upstream.

- `behind_by: 0`: não há commits pendentes do upstream para trazer.
- `ahead_by: 3`: o fork possui três commits próprios sobre o upstream.
- `099ba8b587dc9e61c05e099b1d75c155894bff26`: integração inicial Flutter/Dart.
- `2d05d68450c0a798f5078777bf49b004f9357300`: regeneração dos outputs dos providers.
- `8c64a09e311706bb3fb439bc34f02f9848d75b5d`: documentação dos ajustes Flutter restantes.

Não é necessário merge/rebase do upstream neste momento. O trabalho restante é completar a integração Flutter no código existente.

## 2. Diagnóstico

A integração atual já adiciona detecção Dart, reconhecimento básico de projeto Flutter, referência Flutter da skill e indicação Flutter Web na extensão. Porém, o produto ainda permanece Web/Node-first em pontos centrais.

Os principais gaps são:

1. `impeccable context` ainda não trata `pubspec.yaml`, `lib/`, `.dart`, Melos e Dart workspaces como sinais nativos de projeto Flutter.
2. `crates/detect/src/cli.rs` ainda usa `detect_framework_config()` sem conectar `detect_flutter_project()` ao fluxo real do comando.
3. a identificação Flutter em `file_system_flutter.rs` é heurística e precisa distinguir app, package, plugin, target Web e Dart puro.
4. o detector Dart usa heurísticas regex/context-window que precisam de melhor cobertura contra falsos positivos e negativos.
5. a documentação pública ainda não descreve Flutter como capacidade de primeira classe.
6. os arquivos gerados dos providers devem continuar derivados das fontes canônicas; não devem ser editados manualmente.

## 3. Arquivos que DEVEM SER AJUSTADOS

### P0 — integração funcional

| Arquivo | Ação necessária |
|---|---|
| `crates/context/src/context.rs` | Tornar discovery e contexto Flutter-aware: reconhecer `pubspec.yaml`, `lib/`, `.dart`, `melos.yaml`, Dart workspace; incluir `lib/main.dart`/entry point como target; detectar implementação visual Dart/Flutter; adicionar sinal separado de tecnologia/framework sem alterar a semântica de `Platform`; cobrir app simples e monorepo. |
| `crates/context/src/context_cli.rs` | Propagar `framework`/`technology` no contexto resolvido; não desabilitar detector source quando `Platform` for Android/iOS/adaptive e a tecnologia for Flutter; tornar mensagens de fallback neutras para Web/Flutter; adicionar testes de hook/detector para Flutter nativo. |
| `crates/detect/src/cli.rs` | Importar e usar `detect_flutter_project()` no fluxo de diretórios; atualizar `USAGE`, `Detection modes` e exemplos para `.dart`, `lib/` e Flutter Web; explicar source scan versus browser scan; nunca assumir uma porta Flutter fixa; adicionar testes da CLI. |
| `crates/detect/src/file_system_flutter.rs` | Substituir identificação textual frágil por leitura estruturada/segura do `pubspec.yaml`; distinguir Dart puro, Flutter app, package e plugin; substituir `source_only` por sinais claros como `has_dart_source` e `has_web_target`; aceitar entry points diferentes de `lib/main.dart`; ampliar testes positivos e negativos. |
| `crates/detect/src/detect_text_flutter.rs` | Preservar integralmente o fallback Web; garantir `rule_pack` e inline ignores em Dart; definir comportamento explícito para Dart via stdin sem filename; testar scan multiarquivo para evitar registro/resultado duplicado. |
| `crates/detect/src/detect_dart.rs` | Endurecer as oito regras Flutter; reduzir dependência de janelas fixas de linhas; melhorar semântica de `GestureDetector`/`InkWell`, containers/cards, ThemeData/TextTheme/ThemeExtension, Material/Cupertino; manter IDs e contratos estáveis; adicionar casos limite por regra. |
| `crates/detect/tests/flutter_dart.rs` | Cobrir cada regra individualmente, inline ignores, `rule_pack`, Dart puro, Flutter app/package/plugin/Web, diretórios mistos Web+Dart, caminhos Windows/POSIX e múltiplos arquivos. |
| `crates/detect/tests/fixtures/flutter/bad.dart` | Manter apenas casos agregados estáveis que comprovem violações inequívocas; mover casos ambíguos para testes unitários específicos. |
| `crates/detect/tests/fixtures/flutter/good.dart` | Adicionar Material 3/ColorScheme, ThemeExtension, Semantics, LayoutBuilder/MediaQuery, containers estruturais e estilos locais legítimos que não podem gerar falso positivo. |

### P1 — documentação, skill e UX

| Arquivo | Ação necessária |
|---|---|
| `skill/reference/flutter.md` | Corrigir comando de format para Dart válido; documentar app/package/plugin/monorepo; diferenciar `flutter analyze` e `dart analyze`; cobrir widget/golden/integration tests; diferenciar Material, Cupertino e design system customizado; reforçar que browser live não substitui testes Flutter. |
| `skill/SKILL.src.md` | Usar o sinal determinístico de tecnologia/framework produzido pelo contexto para carregar `reference/flutter.md`; garantir que Flutter nativo continue usando detector Dart; preservar roteamento para audit/adapt/polish/optimize. |
| `README.md` | Apresentar Flutter/Dart como capacidade oficial; documentar `impeccable detect lib/`; explicar source scan Dart versus rendered scan Flutter Web; revisar a contagem de regras; incluir exemplo Flutter e esclarecer que mobile/desktop não depende de servidor Web. |
| `extension/popup/popup.js` | Isolar a detecção Flutter Web em função testável; evitar dependência exclusiva de internals `flt-*`; reconhecer bootstraps atuais; manter detecção best-effort apenas para orientação; atualizar estado ao navegar/trocar de aba quando aplicável. |
| `extension/popup/popup.html` | Ajustar o texto somente se a CLI ganhar comandos/flags adicionais; manter explícita a diferença entre scan do output renderizado e scan de `lib/`. |
| `extension/popup/popup.css` | Nenhuma mudança funcional obrigatória; alterar apenas se o novo estado/hint exigir acessibilidade ou layout. Não criar aparência de erro exclusiva para Flutter. |
| `.github/workflows/ci.yml` | Garantir que mudanças em código/fixtures Flutter sempre executem Rust tests e validações relevantes; adicionar paths apenas se novos testes forem criados fora de `crates/`. |
| `.github/workflows/sync-generated-output.yml` | Manter o fluxo de geração como autoridade para providers; revisar somente se novos arquivos canônicos Flutter não forem propagados atualmente. |

### P2 — ajustes condicionais

| Arquivo | Condição |
|---|---|
| `crates/context/Cargo.toml` | Alterar somente se a solução escolhida exigir nova dependência. Evitar criar dependência de `impeccable-context` para `impeccable-detect`. |
| `crates/detect/Cargo.toml` | Alterar somente se houver nova dependência compartilhada necessária para parsing/detecção Flutter. |
| `Cargo.toml` | Alterar apenas se for criado um novo crate; não é necessário se a lógica compartilhada entrar em `impeccable-common`, que já é dependência dos crates `context` e `detect`. |

## 4. Arquivos que DEVEM SER CRIADOS

### 4.1 Recomendado: helper Flutter compartilhado

Criar `crates/common/src/flutter.rs`.

Responsabilidades propostas:

- ler sinais mínimos de `pubspec.yaml` sem acoplar `context` a `detect`;
- informar `is_flutter`, `is_dart`, tipo do pacote quando determinável, `has_web_target`, `has_dart_source`, possíveis entry points e sinais de workspace;
- manter parsing determinístico e sem inferir porta/URL;
- não conter regras de design/anti-patterns;
- poder ser usado igualmente por `impeccable-context` e `impeccable-detect`.

A criação exige também ajustar `crates/common/src/lib.rs` para exportar o módulo.

Se for possível centralizar esta lógica em um módulo compartilhado já existente sem aumentar acoplamento, o novo arquivo pode ser dispensado. A regra arquitetural é ter uma única fonte para identificação Flutter, não duplicar parsing entre `context` e `detect`.

### 4.2 Testes do helper compartilhado

Preferência: testes unitários dentro de `crates/common/src/flutter.rs` ou, se o padrão do crate justificar, criar um teste dedicado equivalente.

Cobrir pelo menos:

- Dart puro;
- Flutter app;
- Flutter package;
- Flutter plugin;
- Flutter Web;
- texto incidental `flutter:` que não representa SDK Flutter;
- pubspec com comentários e formatações diferentes;
- workspace Dart/Flutter;
- Melos quando aplicável.

### 4.3 Fixtures de projeto

Criar fixtures de diretório somente se os testes atuais não conseguirem expressar de forma legível os cenários. Preferir fixtures pequenas para:

- `flutter_app/`;
- `flutter_package/`;
- `flutter_plugin/`;
- `flutter_web/`;
- `dart_only/`;
- `melos_workspace/`.

Não criar fixtures duplicadas quando um teste temporário/unitário simples for suficiente.

## 5. Arquivos que DEVEM SER EXCLUÍDOS

Neste estado, **nenhum arquivo de implementação deve ser excluído**.

Também NÃO excluir:

- `crates/detect/src/detect_text_flutter.rs`;
- `crates/detect/src/file_system_flutter.rs`;
- `crates/detect/src/detect_text.rs`;
- `crates/detect/src/file_system.rs`;
- outputs gerados dos providers;
- referências Flutter geradas.

Os wrappers Flutter atuais reduzem conflitos futuros com o upstream e devem permanecer até existir evidência arquitetural e testes suficientes para incorporar sua lógica diretamente nos arquivos upstream.

`docs/FLUTTER-ADJUSTMENTS.md` também não precisa ser excluído. Ele pode permanecer como análise anterior. Este documento deve ser usado como matriz operacional de arquivos para implementação.

## 6. Arquivos GERADOS — não editar manualmente

Não editar diretamente as cópias de `SKILL.md` e referências dentro de providers, incluindo famílias como:

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
- demais fontes sob `skill/` quando realmente necessárias.

Depois, executar o processo oficial de geração (`bun run build:release` ou workflow equivalente) e verificar o diff gerado.

## 7. Ordem de implementação recomendada

1. Criar/definir a identificação Flutter compartilhada em `crates/common`.
2. Ajustar `crates/context/src/context.rs`.
3. Ajustar `crates/context/src/context_cli.rs`.
4. Ajustar `crates/detect/src/file_system_flutter.rs` para consumir a mesma identificação.
5. Conectar Flutter ao fluxo real em `crates/detect/src/cli.rs`.
6. Endurecer `detect_text_flutter.rs` e `detect_dart.rs`.
7. Expandir testes e fixtures do detector/contexto.
8. Ajustar `skill/reference/flutter.md` e `skill/SKILL.src.md`.
9. Ajustar `README.md`.
10. Ajustar extensão Flutter Web.
11. Revisar CI e geração de providers.
12. Regenerar outputs.
13. Executar suíte completa e revisar regressões Web.

## 8. Validações obrigatórias

Antes de considerar a implementação concluída:

- `cargo build --workspace --all-targets` deve passar;
- `cargo test --workspace` deve passar;
- testes específicos do detector Dart devem passar;
- testes de contexto devem comprovar app simples e monorepo Flutter;
- regressões Web existentes devem continuar verdes;
- build/testes Node aplicáveis devem passar;
- extensão deve continuar funcional em página não Flutter e Flutter Web;
- `bun run build:release` deve regenerar providers sem drift manual;
- `git diff` após regeneração deve conter somente saídas esperadas;
- Dart puro não pode ser classificado como Flutter;
- Flutter Android/iOS/adaptive deve manter detector source Dart habilitado;
- Flutter Web deve poder usar source scan e browser scan como camadas complementares.

## 9. Definition of Done

A integração está concluída somente quando:

1. projeto Flutter é reconhecido deterministicamente por `context` e `detect` usando a mesma fonte de verdade;
2. `lib/*.dart` conta como implementação visual;
3. app/package/plugin/workspace são resolvidos corretamente;
4. Dart puro não gera falso reconhecimento Flutter;
5. Flutter mobile/desktop funciona sem suposição de servidor ou porta;
6. Flutter Web usa browser scan apenas quando uma URL real existe;
7. regras Dart possuem casos positivos, negativos e casos limite;
8. documentação e skill explicam o comportamento real;
9. providers são regenerados exclusivamente pelas fontes canônicas;
10. toda a suíte Web existente continua sem regressão.
