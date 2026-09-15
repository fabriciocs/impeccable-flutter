# Node/npm + puppeteer-core migration

## Purpose

Migrate the current 4.1.x repository away from operational Bun and Playwright dependencies without weakening the Node, Rust, extension, oracle, or live-mode test gates.

This is intentionally separate from the Flutter/Dart integration PR. The historical `feature/adaptation_to_flutter` branch attempted a similar migration before the repository adopted its current Rust workspace, oracle, extension/WASM build, Node matrix, and release guards. That old implementation is reference material, not merge material.

## Non-negotiable outcome

- Node/npm is the JavaScript package/install/build/test entry point.
- `package-lock.json` is committed and `npm ci` is reproducible.
- No workflow installs or invokes Bun.
- No workflow installs Playwright or downloads a Playwright-managed browser.
- Browser automation uses `puppeteer-core` with an explicitly resolved local/CI Chrome, Chromium, or Edge executable.
- The Rust workspace and release order remain unchanged.
- Existing deterministic, browser, extension, oracle, live, and Windows gates remain at least as strong as before.

## Current architecture constraints

The migration must preserve all current 4.1.x surfaces:

1. Node 22.18 and Node 24 test matrix.
2. Rust workspace builds/tests on Linux and Windows.
3. Oracle replay against a freshly built engine.
4. WASM/extension build and Firefox lint.
5. Generated-output drift checks.
6. VS Code packaging validation.
7. Live E2E fixtures and provider-backed opt-in tests.
8. Engine release readiness checks and platform-package release flow.

## Ordered implementation

### Phase 1: native Node test runner

1. Replace the `runner: 'bun'` path in `scripts/run-tests.mjs` and `scripts/test-suites.mjs`.
2. Port remaining `bun:test` specs to `node:test`.
3. Prefer direct `node:test` assertions/mocks. Where legacy Jest/Bun-style matchers make a one-shot port safer, use a small repository-local compatibility helper and keep it dependency-free.
4. Rewrite tests that spy on ESM namespace exports as integration tests. Node does not allow redefining ESM namespace bindings the way Bun's `spyOn` does.
5. Gate: `node scripts/run-tests.mjs core` passes on Node 22.18 and 24 with no Bun executable present.

### Phase 2: npm build/package scripts

Convert package scripts to Node/npm equivalents:

- `bun run scripts/build.js` -> `node scripts/build.js`;
- nested `bun run <script>` -> `npm run <script>`;
- `bunx` -> pinned `npx --yes ...` or an installed package binary;
- `bun audit` -> `npm audit` with equivalent severity policy.

Gate: build, release build, VS Code package validation, and generated-output checks pass under npm.

### Phase 3: lockfile

1. Stop ignoring `package-lock.json`.
2. Generate it with the minimum supported Node/npm toolchain used by CI.
3. Commit `package-lock.json`.
4. Replace installs with `npm ci`.
5. Remove `bun.lock` only after clean `npm ci` validation.

Gate: clean checkout + `npm ci` succeeds on Linux and Windows.

### Phase 4: browser automation

1. Replace package-level Playwright usage with `puppeteer-core`.
2. Resolve browser executable explicitly. Resolution order should support:
   - `PUPPETEER_EXECUTABLE_PATH`;
   - Chrome/Chromium/Edge installed on the host;
   - CI-provided Chrome/Chromium.
3. Do not use a package that downloads a browser during install.
4. Port live/new-work E2E helpers behind a small Puppeteer compatibility layer instead of scattering API translations through every scenario.
5. Preserve process-group teardown and orphan-reaper behavior on Windows.

Gate: browser-backed detector and live E2E tests pass with no Playwright package/cache/browser present.

### Phase 5: workflows

Update all active workflows, including at minimum:

- `.github/workflows/ci.yml`;
- `.github/workflows/sync-generated-output.yml`;
- release workflows that install JS dependencies.

Requirements:

- no `oven-sh/setup-bun`;
- no `bun install`, `bun run`, or `bunx`;
- no `npx playwright install`;
- no `~/.cache/ms-playwright` cache;
- use `npm ci`;
- expose an explicit browser executable path for `puppeteer-core` jobs;
- keep the pinned Rust toolchain and existing Rust cache strategy.

### Phase 6: active documentation

Update operational instructions in:

- `.github/PULL_REQUEST_TEMPLATE.md`;
- `AGENTS.md`;
- `CLAUDE.md`;
- `docs/DEVELOP.md`;
- README files;
- workflow/script comments that are instructions rather than historical notes.

Historical migration documents may mention Bun/Playwright when clearly marked as history; active commands must not instruct users to install or invoke them.

## Final gates

All of these must pass from a clean checkout:

```text
npm ci
npm run build
npm run test:core
npm run test:detector
npm run test:live
npm run test:framework
cargo build --workspace --all-targets
cargo test --workspace
```

CI must additionally prove:

- Node 22.18 matrix: green;
- Node 24 matrix: green;
- Rust Linux: green;
- Rust Windows: green;
- launcher Windows: green;
- oracle: green;
- extension/WASM build: green;
- Firefox extension lint: green;
- generated tracked output: no drift.

Run opt-in browser/provider lanes when their prerequisites are available; absent provider keys must skip explicitly rather than appear as false success or false failure.

## Search gate

Before marking the migration PR ready, inspect active manifests, workflows, scripts, tests, and operational docs for:

```text
setup-bun
bun install
bun run
bunx
bun.lock
npx playwright
ms-playwright
@playwright/test
playwright-core
from 'playwright'
from "playwright"
```

Every remaining occurrence must be either removed or explicitly justified as non-operational historical text.

## Rollback rule

Do not remove a Bun/Playwright path before its Node/npm/puppeteer-core replacement has an equivalent passing gate. Migrate one lane at a time and keep the PR draft until Linux, Windows, browser, extension, and oracle checks agree.
