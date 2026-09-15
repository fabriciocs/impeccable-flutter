# Impeccable Flutter — Plano de adaptação nativa Flutter + Material 3 + Codex

## Objetivo

Transformar este fork em uma especialização Flutter-first do Impeccable, preservando a arquitetura upstream e adicionando conhecimento, detecção determinística, fluxos de agente, validação e documentação específicos para Dart, Flutter, Material 3 e Codex.

O resultado esperado não é apenas permitir que o Impeccable opere em um projeto Flutter. O objetivo é que ele compreenda a estrutura real do aplicativo Flutter, ThemeData, ColorScheme, TextTheme, ThemeExtension, widgets, constraints, navegação, adaptação multiplataforma, Semantics, text scaling, localização, performance e golden tests, mantendo separadas as evidências de análise do código Dart e da interface renderizada.

## Princípios de implementação

1. `skill/` continua sendo a fonte de verdade da skill.
2. Arquivos gerados em `.agents/`, `.claude/`, `.cursor/`, outros providers e `plugin/` não devem ser editados manualmente; devem ser regenerados pelo build.
3. Regras Flutter determinísticas pertencem ao engine em `crates/`, não somente aos prompts.
4. Não adaptar regras CSS mecanicamente para Dart. Flutter deve possuir scanner próprio.
5. Material 3 deve ser tratado semanticamente, por roles e temas, e não como um conjunto de estilos visuais fixos.
6. Um design system customizado coerente deve ser preservado quando for a autoridade visual do projeto.
7. Análise de fonte Dart e análise renderizada de Flutter Web são evidências diferentes e não devem ser confundidas.
8. Toda nova regra determinística precisa de positivos, falsos positivos, testes Rust e cobertura oracle apropriada.
9. Codex deve consumir a mesma fonte canônica da skill; não criar uma segunda implementação divergente apenas para Codex.

## P0 — Núcleo obrigatório

### `skill/SKILL.src.md`

Ajustar o roteamento Flutter para que Flutter seja plataforma de primeira classe em todos os comandos relevantes, e não somente uma referência adicional de `audit` e `adapt`.

Alterações:
- manter detecção por `pubspec.yaml` com Flutter SDK;
- carregar `reference/flutter.md` para qualquer tarefa de UI Flutter;
- tornar explícito o comportamento Flutter para `shape`, `document`, `extract`, `critique`, `audit`, `polish`, `harden`, `animate`, `colorize`, `typeset`, `layout`, `clarify`, `adapt`, `optimize` e new-work;
- exigir inspeção de `pubspec.yaml`, entry point, tema, widgets representativos, navegação e testes antes de alterações relevantes;
- definir que validação Flutter usa fonte Dart + testes Flutter + evidência visual disponível;
- impedir inferências sobre implementação Dart baseadas somente no DOM/render de Flutter Web;
- incluir Definition of Done Flutter no fluxo de finalização.

### `skill/reference/flutter.md`

Expandir para ser a especificação Flutter canônica da skill.

Adicionar seções para:
- descoberta do projeto e arquitetura;
- Material 3;
- `ThemeData`;
- `ColorScheme` e roles semânticos;
- `TextTheme`;
- `ThemeExtension` e design tokens;
- component themes;
- composição e reutilização de widgets;
- constraints e layout;
- responsividade e adaptação;
- Android, iOS, Web e desktop;
- navegação e fluxos;
- formulários e validação;
- loading, empty, error, offline e retry states;
- `Semantics`, foco, teclado e traversal;
- text scaling;
- localização e expansão de conteúdo;
- SafeArea, teclado, insets e orientação;
- animação e reduced motion;
- imagens e assets;
- performance e rebuilds;
- golden/widget/integration tests;
- inspeção visual;
- detector Impeccable;
- workflow Codex;
- Definition of Done.

### `crates/core/src/checks/flutter_scan.rs` — novo

Criar scanner específico para Dart/Flutter.

Responsabilidades iniciais:
- reconhecer arquivos `.dart` relevantes;
- identificar construções Flutter com baixo risco de falso positivo;
- produzir findings usando os tipos/contratos existentes do engine;
- manter regras independentes do scanner CSS;
- fornecer localização útil de arquivo/linha quando suportado pelo engine;
- permitir evolução futura para parsing mais estrutural sem quebrar o contrato CLI.

Primeiro conjunto de regras candidatas:
1. cores literais repetidas quando roles de tema são preferíveis;
2. `TextStyle(fontSize: ...)` repetido em vez de escala temática;
3. spacing literals repetitivos como `EdgeInsets.all(16)` em múltiplos níveis;
4. `BorderRadius.circular(32+)` em cards/painéis comuns;
5. gradientes genéricos roxo/ciano;
6. gradient text decorativo com `ShaderMask`/shader;
7. containers decorativos excessivamente aninhados;
8. ações customizadas sem semântica/tooltip/affordance adequada;
9. dimensões rígidas suspeitas em layouts adaptativos;
10. estilos locais repetidos de botão/input/card quando component themes são indicados;
11. truncamento excessivo de conteúdo significativo;
12. padrões com risco para text scaling;
13. scrollables aninhados suspeitos;
14. animações decorativas contínuas ou bounce/elastic inadequado;
15. uso inconsistente de Material 3/theme roles.

Cada regra deve ter critérios suficientemente restritos para evitar transformar preferência estilística em erro determinístico.

### `crates/core/src/checks/mod.rs`

- declarar/exportar o scanner Flutter;
- integrar o scanner ao dispatcher existente;
- preservar comportamento atual para HTML/CSS/browser;
- garantir que arquivos não-Dart não sejam processados pelo scanner Flutter.

### `crates/core/src/checks/rules.rs`

- registrar IDs estáveis das regras Flutter;
- definir severidade, categoria, mensagem e orientação de correção;
- garantir nomes compatíveis com hooks, ignore-rule e saída JSON;
- não reutilizar IDs web para regras semanticamente diferentes em Flutter.

### `crates/core/src/checks/text_rules.rs`

Revisar somente o que for compartilhável com Flutter. Não acumular toda a implementação Dart neste arquivo. Se regras textuais genéricas forem reutilizadas, extrair funções comuns; regras Flutter permanecem em `flutter_scan.rs`.

### `crates/core/src/lib.rs`

Ajustar exports apenas se necessário para disponibilizar o scanner/registro Flutter aos crates consumidores sem criar acoplamento circular.

## P0 — Fixtures e contratos

### `tests/fixtures/flutter/` — novo

Criar corpus dedicado, preferencialmente separado por regra:

- `theme-literals/`
- `typography/`
- `spacing/`
- `radius/`
- `gradients/`
- `semantics/`
- `adaptive-layout/`
- `text-scaling/`
- `overflow/`
- `material3/`
- `nested-containers/`
- `motion/`

Cada fixture deve incluir casos que devem acusar e casos semelhantes que devem passar. Cobrir design systems customizados para evitar recomendações indevidas de Material padrão.

### Testes Rust do crate afetado

Adicionar regressões antes ou junto de cada regra. Cobrir:
- match esperado;
- não-match;
- comentários/strings quando aplicável;
- widgets customizados;
- tema Material 3;
- tema customizado;
- multiline Dart;
- múltiplos findings;
- estabilidade de IDs e mensagens.

### `tests/oracle/`

Adicionar casos para `impeccable detect` sobre Dart/Flutter e revisar manualmente os goldens. Não regenerar vetores congelados indiscriminadamente.

## P1 — Playbooks especializados

### `skill/reference/audit.md`

- detectar Flutter e delegar ao guia Flutter;
- combinar `impeccable detect lib/`, `flutter analyze`, testes e evidência visual;
- auditar Semantics, target sizes, text scaling, focus, teclado, overflow e adaptação;
- diferenciar source findings de rendered findings.

### `skill/reference/polish.md`

- incluir consistência ThemeData/ColorScheme/TextTheme;
- remover estilos locais redundantes;
- revisar spacing, radii, states, affordances e plataforma;
- exigir validação visual limitada e testes relevantes.

### `skill/reference/adapt.md` e `skill/reference/adapt.native.md`

- usar constraints em vez de breakpoints web copiados;
- cobrir `LayoutBuilder`, `MediaQuery`, Flex, Wrap, Slivers e constrained widths;
- cobrir phones, tablets/foldables, desktop/web conforme plataformas suportadas;
- verificar orientação, SafeArea, teclado e insets;
- manter convenções específicas de plataforma.

### `skill/reference/layout.md`

- ensinar raciocínio constraint-first;
- revisar scroll ownership, nested scrolls, Flex overflow e intrinsic sizing;
- usar spacing por relacionamento, não repetição mecânica.

### `skill/reference/typeset.md`

- priorizar `TextTheme` e escala tipográfica do produto;
- validar text scaling e localização;
- evitar font sizes locais repetidos;
- preservar fontes declaradas no `pubspec.yaml`.

### `skill/reference/colorize.md`

- mapear decisões para `ColorScheme` e ThemeExtensions;
- usar `on*` roles para contraste;
- evitar introduzir paletas/gradientes genéricos;
- preservar sistema customizado coerente.

### `skill/reference/animate.md`

- orientar `Animated*`, transitions e animações explícitas quando necessárias;
- respeitar reduced motion/acessibilidade;
- evitar animação contínua gratuita, bounce e elastic sem justificativa;
- revisar lifecycle/disposal de controllers quando aplicável.

### `skill/reference/harden.md`

Adicionar checklist Flutter para:
- async loading/error/retry;
- offline/degraded state;
- mounted/context safety quando pertinente;
- overflow e conteúdo extremo;
- text scaling;
- localização;
- teclado/insets;
- lifecycle;
- permissões e estados negados quando a superfície depende deles.

### `skill/reference/optimize.md`

Adicionar diagnóstico Flutter para:
- rebuilds desnecessários;
- widgets excessivamente grandes;
- listas sem builder quando relevante;
- imagens e cache;
- animações/repaints;
- expensive layout/intrinsics;
- const correctness somente quando tiver benefício real;
- DevTools/perfil quando disponível, sem alegar ganhos sem medição.

### `skill/reference/extract.md`

- extrair tokens para ThemeData/ThemeExtension quando apropriado;
- extrair widgets reutilizáveis por comportamento/semântica, não apenas aparência;
- consolidar component themes;
- evitar abstrações prematuras.

### `skill/reference/document.md`

Fazer `DESIGN.md` documentar:
- ThemeData e ColorScheme;
- typography;
- spacing/radius/elevation;
- ThemeExtensions;
- component themes;
- widgets canônicos;
- adaptação por plataforma/device class;
- estados e motion;
- exceções deliberadas.

### `skill/reference/new-work.md`

Adicionar fluxo Flutter-first para novas superfícies:
- compreender shell/navegação existentes;
- escolher modo da superfície;
- preservar produto e plataforma;
- definir estrutura de widgets e estados antes de decorar;
- integrar ao design system existente;
- definir matriz de dispositivos para validação.

### `skill/reference/craft-floor.md`

Adicionar bans/reflexos Flutter que não dependem do detector:
- não construir tudo com `Container`;
- não criar card para cada agrupamento;
- não ignorar componentes/temas existentes;
- não sacrificar Semantics por custom painting;
- não copiar CSS mentalmente para Flutter;
- não usar valores mágicos para compensar layout quebrado;
- não remover affordances nativas sem motivo documentado.

### `skill/reference/critique.md`

Incluir avaliação Flutter de hierarquia, fluxo, affordances, adaptação, estados, plataforma e consistência com componentes nativos/design system.

### `skill/reference/shape.md`

Para Flutter, produzir arquitetura da superfície incluindo estados, navegação, device classes, estrutura semântica e componentes antes da implementação.

### `skill/reference/clarify.md`

Considerar mensagens de validação, erros, empty states, permissões, acessibilidade e expansão de localização.

## P1 — CLI/engine e detecção de projeto

Revisar os crates/arquivos responsáveis por descoberta de arquivos e comando `detect` para garantir:
- `.dart` incluído quando o target é diretório Flutter;
- diretórios gerados (`build/`, `.dart_tool/` etc.) ignorados;
- identificação de Flutter por `pubspec.yaml` com SDK Flutter;
- saída JSON estável;
- nenhuma dependência de dev-server para source scan;
- URL de Flutter Web somente quando explicitamente conhecida.

Os arquivos exatos nesta camada devem ser escolhidos após localizar no engine o dispatcher atual do `detect`; alterar apenas os módulos responsáveis, sem duplicar descoberta em `skill/`.

## P1 — Hooks

Revisar hook/detector para que alterações `.dart` em projeto Flutter possam acionar as regras Flutter quando hooks estiverem habilitados.

Ajustes:
- reconhecer extensões/paths Flutter;
- respeitar ignore-file/ignore-rule existentes;
- não executar browser scan implicitamente;
- manter mensagens rápidas e determinísticas.

## P2 — Documentação

### `README.md`

Reposicionar o fork claramente como Impeccable especializado em Flutter, Material 3 e Codex, mantendo crédito e relação com upstream.

Adicionar:
- proposta do fork;
- recursos Flutter;
- exemplo de instalação Codex;
- exemplo `impeccable detect lib/`;
- workflow recomendado;
- diferença entre Dart source scan e Flutter Web render scan;
- matriz de plataformas Flutter;
- status das regras Flutter.

### `AGENTS.md`

Documentar:
- `flutter_scan.rs` e sua responsabilidade;
- localização das fixtures Flutter;
- suites obrigatórias para mudanças Flutter;
- política de source-first;
- regra de não editar outputs gerados;
- sequência de validação Flutter.

### `docs/ENGINE.md`

Atualizar mapa do engine para mostrar o caminho Dart/Flutter, registry e consumidores do scanner.

### `docs/CLI-CONTRACT.md`

Documentar comportamento observável de `detect` para `.dart`, diretórios Flutter e JSON, incluindo compatibilidade e códigos de saída.

## P2 — Build e distribuição

### `scripts/`

Revisar transformers/build para garantir que `reference/flutter.md` e demais alterações sejam distribuídas para todos os providers suportados.

Não criar conteúdo Flutter divergente por provider. Provider transforms devem alterar apenas envelope/formato necessário.

### `.agents/skills/`, `.claude/skills/`, `.cursor/skills/`, demais harnesses e `plugin/`

Não editar diretamente. Após concluir a fonte:

1. executar build normal para validar `dist/`;
2. executar release build somente quando for intencional atualizar outputs rastreados;
3. revisar diffs gerados;
4. validar especialmente `.agents/skills/impeccable` para Codex.

## Codex

A integração Codex deve permanecer derivada da fonte canônica:

`skill/SKILL.src.md` → referências Flutter → engine/detector → build/transformers → `.agents/skills/impeccable` → Codex.

Não criar prompts paralelos que possam divergir.

Validar:
- descoberta repo-local da skill;
- carregamento de `flutter.md` em projeto Flutter;
- execução do launcher no Windows via `.cmd` quando necessário;
- `impeccable context` a partir da raiz do projeto alvo;
- `detect lib/`;
- fluxo audit/polish/adapt;
- hook Codex quando aprovado pelo usuário.

## Ordem de implementação

### Fase 1 — Contrato
1. expandir `flutter.md`;
2. ajustar `SKILL.src.md`;
3. atualizar playbooks essenciais;
4. congelar catálogo inicial de regras e IDs.

### Fase 2 — Test-first
1. criar fixtures Flutter;
2. criar testes de regras;
3. criar casos oracle inicialmente falhando.

### Fase 3 — Engine
1. implementar `flutter_scan.rs`;
2. integrar registry/dispatcher;
3. integrar descoberta `.dart`;
4. integrar hook;
5. preservar contratos web existentes.

### Fase 4 — Material 3 e comandos
Especializar audit, polish, adapt, layout, typeset, colorize, harden, optimize, extract, document, shape, critique e new-work.

### Fase 5 — Validação
Executar, conforme aplicável ao diff:

```text
cargo fmt --check
cargo test --workspace
cargo build --release -p impeccable
IMPECCABLE_BIN=<target/release/impeccable> bun run test
bun run build
```

Nos fixtures/projetos Flutter usados para integração:

```text
flutter format --set-exit-if-changed .
flutter analyze
flutter test
```

Adicionar golden/integration tests quando o cenário exigir.

### Fase 6 — Distribuição Codex
1. validar build provider;
2. inspecionar `dist/agents`;
3. somente então sincronizar outputs rastreados quando apropriado;
4. testar a skill em um projeto Flutter real.

### Fase 7 — Documentação final
Atualizar README, AGENTS, ENGINE e CLI-CONTRACT com comportamento efetivamente implementado.

## Critérios de conclusão

A adaptação estará concluída quando:

- projeto Flutter for detectado deterministicamente;
- Dart source scan funcionar sem browser;
- regras Flutter tiverem testes positivos e negativos;
- `audit`, `polish`, `adapt` e demais comandos relevantes aplicarem orientação Flutter automaticamente;
- Material 3 for tratado por ThemeData/ColorScheme/TextTheme/ThemeExtension e component themes;
- design systems customizados coerentes não forem substituídos por Material default;
- Semantics, focus, keyboard, text scaling, i18n e device adaptation fizerem parte do fluxo;
- testes Rust, oracle e build passarem;
- fixtures Flutter passarem em `flutter analyze`/`flutter test` quando forem apps completos;
- outputs Codex forem derivados da fonte e validados;
- documentação refletir exatamente o comportamento implementado;
- nenhuma regressão conhecida for introduzida nos caminhos HTML/CSS/browser existentes.

## Arquivos novos previstos

- `crates/core/src/checks/flutter_scan.rs`
- `tests/fixtures/flutter/**`
- testes/oracles Flutter correspondentes

Outros arquivos novos só devem ser introduzidos quando reduzirem acoplamento ou forem exigidos pela arquitetura existente.

## Arquivos que não devem ser editados manualmente

Em desenvolvimento normal, evitar alterações diretas em outputs gerados, especialmente:

- `.agents/skills/**`
- `.claude/skills/**`
- `.cursor/skills/**`
- demais harness folders gerados
- `plugin/`
- `dist/`
- `build/`

A fonte deve ser corrigida primeiro e os artefatos regenerados pelo pipeline oficial.
