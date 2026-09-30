# Working on Spectra

## Product

Spectra is a Cursor extension built with the standard VS Code extension API. The user approved
replacing the earlier website. Do not restore Express, a localhost API, environment-file
credentials, fake accounts or teams, or Orbit as the default source. Use Spectra as the product name.

The core flow is: select a component → capture source → describe a change → compare three
directions → refine or remix → choose → copy for Cursor or save HTML. Keep the workspace focused
on comparing designs.

## Read before working

- `docs/PRODUCT.md`: product behavior, scope, and limitations.
- `docs/LLM_CONTRACT.md`: source, messages, providers, and preview isolation.
- `docs/DEMO_CHECKLIST.md`: checks to perform and record.
- `src/domain/protocol.ts` and relevant source before changing behavior. Specifications state
  requirements; inspected source and performed checks establish implementation status.

## Architecture

- The root package is the extension: `name: spectra`, display name `Spectra`, entry
  `dist/extension.cjs`. `spectra-local` is local package identity, not an official publisher claim.
- `extension/extension.ts` owns commands, a `WebviewPanel`, native editor interactions, trust,
  captured source, and per-panel session state. `extension/providers.ts` calls OpenAI/Anthropic
  directly; `extension/cursor.ts` runs the authorized local Cursor CLI adapter;
  `extension/session.ts` validates atomic updates; `extension/source.ts` guards capture;
  `extension/webview.ts` builds nonce-protected local panel HTML.
- React + TypeScript render the editor-native comparison workspace. Vite builds local
  `dist/webview/index.js` and CSS; esbuild bundles the extension host. No HTTP service is needed.
- `src/domain/protocol.ts` defines the allowlisted webview/host protocol; `src/domain/handoff.ts`
  assembles the manual Cursor handoff. Shared domain modules own variants, validation, and documents.
- `src/variants.ts` and demo transformations are curated sample content only. Preserve them without
  making them the baseline for imported components.
- `npm run dev` is **only a browser development harness**: show a Browser harness banner and explicit
  sample data. Real source capture and provider commands are unavailable there.

## Behavior to preserve

1. `spectra.open` opens the panel; `spectra.exploreSelection` captures selected text or the active
   component document. `spectra.configureProvider` opens provider setup; `spectra.loadSample` explicitly
   loads the curated Orbit sample.
2. Capture only the current document/selection snapshot, including unsaved text, relative path,
   language, and line range. Limit source to 60,000 characters and intent to 3,000 characters.
   Require an existing local workspace file; reject outside symlinks, hidden/generated and obvious
   sensitive paths. These guards do not detect embedded secrets. Do not crawl imports, styles,
   dependencies or the workspace. Confirm before replacing a captured exploration.
3. Show the snapshot and context limitations before generation. For **all custom source, including
   HTML**, Original is an **AI reconstruction**, not the running component or a rendered capture.
   Imports, styles, providers, and application context may be missing. Never compile arbitrary React/JSX.
4. First live generation for captured source returns a reconstructed baseline plus exactly three
   meaningful design/UX directions. Keep that original fixed for the captured-source session.
   Compare ORIGINAL | A | B | C; show names, hypotheses, changes, independent previews, Choose, Refine.
5. Refine one exact host-stored variant; remix exactly two. Resolve source IDs in the host, return
   one new result, and preserve earlier versions. Palette-only directions do not satisfy generation.
6. Choose shows Original ↔ Selected. **Copy for Cursor** writes a handoff to the clipboard for manual
   pasting; **Save HTML** uses a native save dialog. Neither automatically edits project files or
   starts a Cursor agent/chat. Do not label this as automatic Apply.
7. Keep the last valid canvas and selection on errors, cancellation, or malformed output; prevent
   duplicate work and recover controls. Closing the panel ends its in-memory session.

## Trust, secrets, and isolation

- Require a trusted workspace for source access, live generation, and exports. Confirm the source
  snapshot/prompt transmission to the selected vendor with a native dialog before live requests.
- Collect keys only with a native password `InputBox`; store them in VS Code `SecretStorage`.
  Never put keys in webview messages, settings, `.env`, `VITE_*`, logs, bundles, or fixtures.
- Model settings: `spectra.openaiModel` defaults to `gpt-4.1`; `spectra.anthropicModel` defaults to
  `claude-sonnet-4-20250514`; `spectra.cursorModel` defaults to `auto`. The user authorized local Cursor
  CLI generation through CLI-owned account login with dedicated Spectra configuration. No Cursor SDK,
  MCP, cloud agents, implicit editor credentials or automatic repository edits. See the CLI boundary
  in `docs/LLM_CONTRACT.md`; preserve tool denials, temporary workspaces and bounded subprocesses.
- Validate all messages and provider output at runtime: commands, IDs, field types, non-empty
  implementations, cardinality, and size limits. Keep source `Uri` private in the host; a webview
  must not choose arbitrary files, run arbitrary editor commands, or supply replacement source code.
- Parent webview uses a restrictive CSP, nonce-protected local scripts, and no network access.
  Generated HTML/CSS/vanilla JS runs only in locked-CSP `srcdoc` iframes with
  `sandbox="allow-scripts"`; never add same-origin, forms, popups, or top-navigation privileges.
- Exports omit preview CSP and are outside iframe isolation. Keep the review-before-production
  warning; validation and sandboxing are not a code audit or an absolute safety guarantee.
- Label samples and preset transformations as curated, never live AI. Never silently replace a
  failed live request with fixtures. Preserve facts and billing units; mark fictional proof visibly.

## Development

Use npm; preserve user edits and useful existing domain/demo behavior. Prefer small typed functions,
project-owned arrow functions, existing styling conventions, accessible controls, and reduced motion.
Use native editor theme tokens; do not rebuild the marketing website or fake navigation sidebar.
Documentation-only tasks do not authorize unrelated source changes. Update contracts with behavior.

### Code conventions

- Use `type` aliases, including intersections for local extensions of external types; do not add
  `interface` declarations or widen global types for a single consumer.
- Use arrow functions for project-owned functions and callbacks, including curated preview scripts.
- Use `for...of` for side effects instead of `forEach`. Keep `map`, `filter`, `find`, `some` and
  `every` when their return values express the operation; keep independent async work parallel.
- Prefer `const`, type-only imports and strict equality. Validate `unknown` at boundaries rather
  than using `any` or unchecked assertions. Narrow DOM values before assigning domain types.
- Keep shared limits and guards in domain modules, and preserve existing runtime validation.
- `npm run lint` enforces these conventions in source and curated preview JavaScript. Captured
  user source and live model output are not rewritten to satisfy repository style rules.

### Checks

- `npm install`, then `npm run build`: typecheck host/UI, build webview assets and host bundle.
- Open the repository root in Cursor and use F5 / `.vscode/launch.json` to launch an Extension
  Development Host. `npm run watch` watches bundles during extension development.
- `npm run package`: build and create a local VSIX. Install manually with **Extensions: Install
  from VSIX…**. Packaging is not Marketplace publication; no publisher credentials are needed.
- `npm run lint`, `npm test`, `npm run format:check`, and `npm run check` are available. Inspect
  `package.json` before running scripts.
- After code edits, run appropriate diagnostics/build/tests and rehearse affected checklist items.
  A browser-harness check does not verify the extension host, trust, secrets, provider calls, or VSIX.
  Never claim F5, live AI, packaging, or any check passed without performing it.

## Scope and handoff

App accounts, databases, teams, billing features, GitHub/Figma integration, analytics, generated React
compilation, Marketplace publication, and automatic repository edits are out of scope. Optional
dependency context, rendered capture, and automated agent integration are future work.
Summarize changes, checks actually performed, remaining risks, and the smallest next step; distinguish
curated sample behavior from live AI and unverified requirements from working runtime behavior.
