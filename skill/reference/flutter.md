# Flutter / Dart guidance

Load this reference whenever the target project is Flutter (`pubspec.yaml` declares the Flutter SDK), regardless of whether PRODUCT.md calls the platform `android`, `ios`, `adaptive`, or leaves it unspecified.

## Project classification and context contract

Flutter is a technology/framework axis, not a replacement for product platform. A project may therefore resolve as `technology=flutter`, `framework=flutter`, and `platform=android`, `ios`, `adaptive`, or another supported product value at the same time.

Project identification must be structural and deterministic:

- Dart package: a package root with `pubspec.yaml`;
- Flutter project: `dependencies.flutter.sdk: flutter` or `dev_dependencies.flutter.sdk: flutter` in `pubspec.yaml`;
- Flutter app: Flutter SDK plus an application entry point/platform target;
- Flutter package: Flutter SDK package without application evidence;
- Flutter plugin: Flutter SDK plus the `flutter.plugin` declaration;
- Flutter Web: a Flutter project with a `web/` target. This does not imply a fixed dev-server port;
- Dart/Flutter workspace: native Dart `workspace:` or a Melos workspace, with the selected package kept distinct from the workspace root.

Do not classify a project as Flutter merely because a `flutter:` key, asset name, comment, or unrelated string appears in YAML. When context already emits `technology`, `framework`, or `FLUTTER_REFERENCE_REQUIRED`, treat that resolved context as the primary signal and use `pubspec.yaml` as the fallback verification source.

## Establish the Flutter truth before editing

Read, at minimum:

- `pubspec.yaml` for SDK, Material/Cupertino packages, fonts, assets, localization, and state/navigation dependencies;
- `lib/main.dart` or the real application entry point, including alternate `main_*.dart`, `*_main.dart`, `bin/*.dart`, and relevant example entry points when the repository uses them;
- the app-level `ThemeData`, `ColorScheme`, `TextTheme`, extensions, and spacing/radius tokens;
- representative widgets for the requested surface;
- router/navigation configuration when the task affects flows;
- existing widget, golden, and integration tests relevant to the target.

Do not translate web CSS advice mechanically into Flutter. Work in Flutter primitives: constraints, widget composition, inherited themes, semantics, focus, scroll behavior, platform adaptation, and device-safe layout.

## Source scan vs rendered scan

These are different evidence layers.

- `impeccable detect lib/` scans Dart source and reports Flutter-specific source rules.
- `impeccable detect path/to/file.dart` scans an individual Dart file.
- Dart/Flutter source passed through stdin is eligible for Dart dispatch when strong Dart/Flutter source signals are present.
- A browser scan of Flutter Web inspects only the rendered browser output. It does not read or understand the Dart source that produced it.
- Never claim that a browser finding proves a specific Dart implementation detail.
- When Flutter Web is available, use both layers: source scan for Dart patterns and rendered inspection for visual/layout behavior.

Generated output is not application source. Exclude `.dart_tool/`, `build/`, generated platform/build artifacts, and dependency/vendor trees from ordinary source traversal unless the user explicitly targets them.

For a source-only or native Flutter project, the absence of a browser URL is not a blocker. Continue with Dart source, existing goldens/screenshots, and Flutter-native validation. Never invent a localhost URL or port for Flutter Web; use a rendered endpoint only when it is explicitly available or independently discovered as evidence.

## Theme and component discipline

Prefer the app's theme and reusable components over local styling:

- use `Theme.of(context).colorScheme`, `textTheme`, and established `ThemeExtension`s;
- centralize repeated typography, spacing, radii, and colors instead of scattering literals;
- preserve Material 3 or Cupertino semantics when the project has adopted them;
- do not replace a coherent custom design system with stock Material defaults;
- do not hardcode platform-specific dimensions when constraints or adaptive layout are appropriate.

Avoid generated-UI tells in Dart source:

- `BorderRadius.circular(32+)` on ordinary cards/panels unless the shape is intentionally pill-like;
- generic purple/cyan `LinearGradient` surfaces;
- decorative gradient text through `ShaderMask` or text shaders;
- repeated local `TextStyle(fontSize:)` scales instead of `TextTheme`;
- gray text/icons on colored surfaces when a `ColorScheme` role is available;
- decorative containers nested inside decorative containers;
- custom `GestureDetector`/`InkWell` actions without semantic intent, label, tooltip, or equivalent affordance;
- `EdgeInsets.all(16)` repeated at every hierarchy level instead of relationship-based spacing.

## Layout and adaptation

Reason from Flutter constraints, not browser breakpoints alone.

- verify narrow phones, common phones, tablets/foldables when the product ships there, and desktop/web widths when supported;
- use `LayoutBuilder`, `MediaQuery`, adaptive navigation, slivers, flex, wrap, and constrained widths deliberately;
- test text scaling and localization expansion; do not fix overflow by truncating meaningful content without product justification;
- account for `SafeArea`, keyboard/insets, orientation, scroll ownership, and minimum touch targets;
- keep platform conventions unless the product has a documented reason to diverge.

## Accessibility

Use Flutter semantics as first-class structure:

- meaningful labels and roles for custom actions;
- logical focus and traversal order;
- keyboard support on desktop/web targets;
- sufficient target sizes and contrast;
- text scaling without clipping;
- announcements/state descriptions where visual changes would otherwise be silent.

Do not add redundant `Semantics` when a standard control already exposes the correct semantics.

## Motion

Prefer purposeful Flutter-native motion (`Animated*`, explicit animations, transitions) tied to state and hierarchy. Respect reduced-motion/platform accessibility behavior where applicable. Avoid decorative bounce/elastic motion and gratuitous continuous animation.

## Validation

After editing Flutter UI, run the strongest gates available in the project. Prefer:

```text
flutter format --set-exit-if-changed .
flutter analyze
flutter test
```

Use the project's actual formatting command if it differs. Run targeted widget/golden tests before a full suite when that is the repository convention. If integration tests are available for the changed flow, run them too.

For visual validation, use the real Flutter app or current goldens/screenshots. Validate the device classes the product actually ships. On Flutter Web, rendered browser inspection is supplemental to Dart-source validation, not a replacement for it.

## Impeccable detector

The CLI can scan Dart source directly:

```text
impeccable detect lib/
impeccable detect path/to/file.dart
impeccable detect --json lib/
```

Flutter project detection intentionally does not assume a dev-server port because Flutter Web may use an ephemeral port. If the user starts a Flutter Web server on a known URL, pass that URL explicitly for rendered inspection.

## Definition of done for Flutter UI work

Before considering Flutter UI work complete, verify the applicable items below:

- the selected Dart/Flutter package and workspace roots are correct;
- implementation follows the existing theme/design system instead of introducing an unrelated visual language;
- loading, empty, error, disabled, focused/hovered where applicable, and success states remain coherent;
- asynchronous UI code respects widget lifecycle (`mounted`/context validity) and does not create avoidable race conditions;
- layouts are checked at the product's relevant device classes, text scales, orientations, and insets;
- semantics, focus order, keyboard behavior for desktop/web, labels/tooltips, target sizes, and contrast are appropriate;
- changed `.dart` targets are passed through Impeccable source detection at least once;
- project-native formatting, analyzer, and tests are run at the strongest practical scope;
- goldens/widget/integration tests are updated only when the intended UI behavior changed;
- Flutter Web rendered inspection, when a real URL exists, is recorded as additional evidence rather than substituted for source validation;
- no generated `.dart_tool/` or `build/` output is treated as authored application source.
