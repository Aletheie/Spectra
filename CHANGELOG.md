# Changelog

## 1.0.3 — 2026-10-02

- Use Spectra independently in desktop VS Code and compatible editor forks. Direct API providers
  appear first outside Cursor; an absent Cursor CLI no longer triggers automatic checks there.
  Explicit CLI setup remains available where the CLI is supported.
- Follow host provider order and prefer a configured provider. Preserve deliberate choices and
  the provider used for a submitted request across background status updates.
- Use editor-neutral setup, trust, diff and save instructions. Rename **Copy for Cursor** to
  **Copy brief** for manual use with any editor's AI chat; retain the existing protocol command.
- Add a reusable native extension-host/webview check with isolated profiles and fixture workspaces.
  Document desktop API requirements and distinguish Antigravity IDE from its standalone agent app.
- Keep the Original sample visible and interactive in narrow editor panels before generation;
  restore its vertical layout when switching back to Original on small screens.
- Preserve explicit Cursor CLI sign-out when its executable setting changes.

Download [spectra-1.0.3.vsix](https://github.com/Aletheie/Spectra/releases/download/v1.0.3/spectra-1.0.3.vsix)
from the GitHub release and install using **Extensions: Install from VSIX…**. This is not a
Visual Studio Marketplace publication. This release also includes the 1.0.1 and 1.0.2 changes below,
which were previously distributed as local packages.

Validation: `npm run check` passed all 99 automated tests and builds; 27 browser tests and native
VS Code 1.140.0 checks passed. Cursor native coverage is partial because the final guarded test
launch hit an OS sandbox conflict. Antigravity IDE, other forks and live AI remain unverified.

## 1.0.2 — 2026-10-02

- Defer loading the React syntax parser until reviewed replacement. The main activation bundle is
  about 95% smaller; total installed size is essentially unchanged.
- Send only relevant task/output instructions to all live providers while preserving exact source
  context. Initial comparison system instructions shrink by 16% for React and 31% for HTML versus
  1.0.1, measured in characters, without adding requests. Live latency remains unmeasured.
- Reuse compiled utility CSS in a bounded panel cache; merge and validate each revision's own code.
  Read the trusted preset once per panel and skip compilation for HTML without classes.
- Reconcile full editor updates once, then process status deltas without rescanning retained code.
  Preserve drafts and interactive previews; compare change descriptions without newline collisions.

Local package: `spectra-1.0.2.vsix`. Install using **Extensions: Install from VSIX…**.
This entry does not represent a Marketplace or GitHub release.

Validation: `npm run check` (96 automated tests), all 23 browser tests and local VSIX packaging
passed. Native Cursor startup, installation and live generation remain unverified.

## 1.0.1 — 2026-10-02

- Generate focused previews with at most two requests in parallel, one shared deadline, actual
  completion counts and cancellation of the whole operation on failure. Preserve the previous
  comparison until all results and styles are ready. Consent discloses request count and usage.
- Compile static Tailwind preview classes locally with a bundled preset. Export the same CSS;
  reject common missing style dependencies without loading project configuration or running React.
- Load previews on first visibility and keep visited frames alive. Isolate comparison rendering
  from instruction drafts and coalesce preview diagnostics during resizing.
- Focus the initial form on source, instruction and provider; move constraints and suggestions
  under Options. Keep reviewed component replacement and curated sample behavior.

Local package: `spectra-1.0.1.vsix`. Install using **Extensions: Install from VSIX…**.
This entry does not represent a Marketplace or GitHub release.

Validation: `npm run check` (85 automated tests), all 22 browser tests and local VSIX packaging
passed. Native Cursor and live provider latency remain unverified.

## 1.0.0 — 2026-09-30

Spectra lets you capture a component in Cursor, compare three design directions, refine or remix
them, and bring a reviewed result back to your project.

- Compare an AI reconstruction of the original with three independent, interactive previews.
- Generate through your Cursor CLI account or a direct OpenAI / Anthropic API key.
- Choose a Cursor model from a searchable native picker. Cursor generation allows up to ten
  minutes, with elapsed time, cancellation and preservation of the previous canvas on failure.
- Generate separate React + Tailwind code for TSX/JSX components. Inspect and copy the code, or
  review a native diff and confirm replacement of the captured range with Undo and conflict checks.
- Keep revision history, refine one direction, remix two and specify design constraints.
- Copy a manual Cursor handoff, export standalone HTML or try the offline curated sample.

### Installation

Download [spectra-1.0.0.vsix](https://github.com/Aletheie/Spectra/releases/download/v1.0.0/spectra-1.0.0.vsix),
then run **Extensions: Install from VSIX…** in Cursor and reload if prompted. Configure a provider
with **Spectra: Configure AI Provider**, or start with **Spectra: Open Curated Sample**.

Cursor CLI generation supports macOS, Linux and WSL extension hosts. Direct API providers are
available without Cursor CLI. React output expects Tailwind to already be configured in the project.
Previews are AI approximations of the captured source; they do not run your React component.

### Verification

`npm run check` passed lint, formatting, 76 automated tests and the production build.
`npm run test:browser` passed 19 browser tests using the harness and simulated editor messages.
Native editor flows and live model generation were not re-run for this release.
