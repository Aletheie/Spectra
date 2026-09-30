# Spectra: product behavior

Spectra helps a developer try different designs for an existing component inside Cursor.
The main workspace compares the original with three directions. From there, the developer can
refine one, combine two, and take the selected result back to their project.

This document defines the expected behavior. Use the [test checklist](DEMO_CHECKLIST.md) to record
what has been verified in the editor and with live providers.

## Capture a component

**Spectra: Open Comparison Canvas** opens an empty panel with actions to capture source or load a
sample. **Spectra: Explore Component**, also in the editor context menu, captures the selection.
With no selection, it captures the whole active document.

The snapshot includes unsaved edits, relative path, language, and line range. It is limited to
60,000 characters and must come from an existing local file in a trusted workspace. Supported
extensions are `.tsx`, `.jsx`, `.ts`, `.js`, `.vue`, `.svelte`, `.html`, `.htm`, `.css`, and `.scss`,
with a supported editor language.

Capture rejects empty or oversized content, unsupported files, hidden or generated paths,
dependency folders, obvious sensitive filenames, and symlinks outside the workspace. These checks
cannot detect secrets embedded in ordinary source code. Show the captured code for review before
generation.

Ordinary stylesheet names such as `src/styles/tokens.css` and `design-tokens.scss` are allowed.
Sensitive directory names and credential-like non-stylesheet files remain guarded.

Only the selection or document is collected. Imports, stylesheets, dependencies, and other project
files are left out. **Open source** opens the current file; the snapshot changes only when the
developer captures it again. Ask before replacing an existing exploration or sample.

Closing the panel clears the comparison session. Saved exports and provider credentials remain;
Cursor CLI may also retain its own conversation history.

## Generate a comparison

The first live request for custom source returns an **AI reconstruction** of the original and
exactly three alternatives in one validated response. This applies to HTML too. The original
approximates the captured code; it is not a screenshot or the running component. Imports, assets,
application state, providers, and CSS context may be missing. CSS-only input has no associated markup.

Explain those limits beside the source and preview. Never compile arbitrary JSX, mount the
captured component, or install its dependencies in the panel.

Keep the reconstructed original fixed for that source session. Regeneration replaces the three
directions only after success. Refine and remix add revisions. Capturing new source starts a new
baseline; changing the provider or model does not.

Instructions must be nonblank and at most 3,000 characters. Offer a starting instruction appropriate
to the captured component and support Cmd/Ctrl+Enter to generate.

Infer an advisory focus from the captured markup: control, form, navigation, table/list, overlay,
section/page, or styles only. Unknown or mixed snippets keep a general focus. Filenames and imports
are not evidence of a component's role. Offer editable suggestions; changing the suggested focus
alone must not overwrite a draft. Applying a suggestion explicitly replaces the instruction.
Provider/status updates preserve drafts. The shared provider prompt preserves the component's scope,
known theme and transparency and never adds a surrounding page or white card to a small control
without a source or instruction reason. CSS-only demonstrations must be visibly illustrative.

## Providers

| Engine             | Connection                             | Default model              |
| ------------------ | -------------------------------------- | -------------------------- |
| Cursor account     | Local Cursor CLI login                 | `auto`                     |
| OpenAI             | Direct API with a key in SecretStorage | `gpt-4.1`                  |
| Anthropic / Claude | Direct API with a key in SecretStorage | `claude-sonnet-4-20250514` |
| Curated demo       | Prepared Orbit sample and preset edits | None                       |

Cursor account is the default engine for custom source. Its setup provides sign-in, a connection
check, model listing, sign-out, and installation instructions. The connection check detects a CLI
login; model access and quota are checked during generation. In a trusted workspace, detect an
existing login when the panel opens and after returning to Cursor, until login is detected.
Keep Check Cursor and Sign in to Cursor CLI beside a blocked generation control, with the
actual checking/signed-out/error state. After starting login, detect completion even if browser
focus returns before credentials are saved; poll for at most three minutes and observe terminal
closure. A slow older status refresh cannot overwrite newer readiness. Configuring an available
provider in the panel selects that provider. Failure to read a direct API key must not block Cursor. Editor chat history and its model selection
are separate from the CLI.

**List models** loads the CLI account's model list in a cancellable background process, then opens
a native searchable model picker. Selecting a model updates the user-level `spectra.cursorModel`
setting for future generate/refine/remix requests. Listing sends no component source and opens no
terminal. Cancellation or a failed listing keeps the current model and comparison unchanged.

Cursor CLI supports macOS, Linux, and WSL extension hosts. `spectra.cursorModel` selects a CLI model;
`spectra.cursorCliPath` optionally supplies an absolute executable path without arguments. Run each
request in a temporary workspace, pipe the generation context through stdin, and deny file reads,
writes, shell, web fetch, and MCP tools. Keep configuration in Spectra's extension storage.
The CLI owns its credentials, which may be shared with other CLI sessions. Sign-out can affect
those sessions, and CLI history can remain after the comparison panel closes.

OpenAI and Anthropic keys are collected through a native password prompt and stored in editor
SecretStorage. Settings show whether a key is saved, without claiming the connection has been
checked. Model IDs are configured in `spectra.openaiModel` and `spectra.anthropicModel`; custom API
endpoints are not supported.

Before every live request, show an editor confirmation with the provider, model, file and range,
and the data being sent: snapshot, instructions, original if available, and selected variants.
Declining leaves the canvas unchanged and starts no request. Cursor account limits and billing
apply to CLI use. Direct OpenAI and Anthropic usage is billed separately.

## Compare, refine, and remix

Show **Original | A | B | C** with independent interactive previews. Each direction needs a short
name, a hypothesis explaining the proposed improvement, concrete changes, **Choose**, and **Refine**.
Hypotheses describe expected effects; they are not measured results.

Directions should differ in layout, hierarchy, copy, or interactions. Color changes alone are not
enough. Derive the proposals from the captured component and instruction. Output validation checks
the response format, so design quality still needs review.

Keep comparisons readable in narrow panels, with mobile-sized previews and an expanded view for
closer inspection. Host status updates must preserve interactions in unchanged previews.

The canvas surface is a viewing aid, separate from the component: white by default (Light), with
Dark and Transparency grid available on demand. It is never copied into exports. Share surface and dimensions across the comparison and chosen
views. Offer exact 375/768/1280px widths and Fit column, plus compact 240px, standard 560px and tall
720px heights. Show the actual iframe dimensions; exact widths scroll rather than shrink. Use a
compact initial height for recognized controls/navigation. Changing these controls must preserve
iframe interactions and the selected implementation. Expanded inspection uses the same controls.

Keep Choose/Refine before the preview and selected-direction export actions before the comparison.
Collapse the instruction after successful generation and keep Edit intent available. Reveal and
focus a new revision after success; mark the chosen direction on return to comparison. Selecting a
third remix source must not silently replace either of the chosen pair; show their order explicitly.

Use all columns on wide panels; on narrower panels pin Original beside the active direction and
provide direction tabs. At phone-sized widths, switch between Original and the active direction.
Keep rationale height bounded, with the complete explanation in expanded inspection. Refinement
stays in a panel above the previews, with provider readiness and a path to setup. Cmd/Ctrl+Enter
submits generate, refine and remix consistently. Host-owned lineage labels identify revisions
such as **A → A v2** and their exact parents.

**New comparison** explicitly confirms replacement of all existing directions and revisions.
Commit the replacement only after success; cancellation preserves the canvas and drafts.

**Refine** sends the exact selected implementation, original, snapshot, intent, and new instruction.
It returns one new direction while keeping its source. If the source was chosen, select the new
revision after success. On failure, preserve the choice and the unfinished instruction.

**Remix** sends exactly two distinct implementations in the selected order, with an instruction
about what to borrow from each. It returns one combined result and keeps both sources.

A session holds up to 15 directions. At the limit, ask the developer to generate a fresh comparison
before refining or remixing again. Never silently discard older revisions.

## Choose and export

Choosing a direction opens **Original ↔ Selected**, including the selected rationale and changes.
The comparison iframes stay mounted so local form/billing state survives Choose and return to
Compare. Expanded inspection is a separate preview and explicitly starts with fresh interaction
state. Reset intentionally reloads a preview; exports contain the implementation, not runtime state.

- **Copy for Cursor** writes a brief to the clipboard with the snapshot, relative path and range,
  intent, selected rationale, exact HTML/CSS/JS and React code when present. The developer pastes
  it into Cursor to review and adapt the result. Copying does not start an agent or change files.
- TSX/JSX directions include React + Tailwind project code alongside the approximate HTML preview.
  **Copy React** copies that exact revision. **Replace component…** opens a native before/after
  diff and asks for confirmation before editing only the captured file or selection. It supports
  Undo and follows the editor's Auto Save setting. It does not start an agent or install dependencies.
- **Save HTML** shows a review warning, then a native save dialog for the selected revision.
  Cancelling writes nothing. The browser harness offers sample HTML download only.
- Code inspection, preview, clipboard content, and export must use the same selected revision.

Editor clipboard and file exports require a trusted workspace. Standalone HTML omits the preview
CSP and runs outside iframe isolation. Ask the developer to review the code before opening it or
using it in production. Validation and sandboxing do not replace a code review.

Replacement also requires trust and the original local file. If its contents or resolved path
changed, capture it again before replacing. Check again after the diff and editor focus changes;
cancellation or a failed edit preserves the comparison. After a successful replacement, track the
new range for subsequent replacements while keeping the captured source and reconstructed Original
fixed. Parse replacement syntax without executing it; check exports, imports and file directives.
These checks do not prove type correctness, prop compatibility or behavior. Existing Tailwind
configuration and project validation remain the developer's responsibility.

## Prepared sample

**Spectra: Open Curated Sample** loads the Orbit pricing example for offline use. Label its
variants and edits as curated. Demo presets apply only to the sample; a failed live request must
never silently substitute sample results.

Keep the pricing consistent: $30/month on monthly billing, or $24/month billed yearly ($288/year).
The yearly saving is $72, or 20%. Both include ten team members; prices are not per member.
Fictional ratings, logos, quotes, and counts must be visibly labeled in previews and exports.
Demo remix uses typed recipes: the first source supplies layout and the second supplies emphasis
and the action. Render one coherent template; never splice HTML with regular expressions. Billing
controls, total, savings and action update together. Presets describe actual changes from Original.

## Reliability and accessibility

Accept only validated protocol messages. The host owns source URIs and implementations; the webview
selects stored IDs. Keep one mutating action active at a time. Errors, cancellation, timeouts, and
invalid responses must preserve the last valid canvas and release the controls. Do not retry
requests automatically.

Name the active operation and distinguish confirmation from execution. Copying, saving and provider
setup must not say Generating. Scope errors to the operation that failed; normal cancellation is
neutral. Status-only host updates omit source and implementations.

Cursor generation has a ten-minute timeout so reconstructing the original and three complete
directions is not cut off at 90 seconds. Its cancellable native notification shows elapsed waiting
time, not an estimated percentage. The panel waits for the full generation budget plus three
minutes for confirmation/transport. Direct API generation keeps its 90-second timeout.
Closing the panel aborts the request; a late result must not reopen it.

The parent webview uses local nonce-protected scripts and blocks network access. Generated code
runs only in `srcdoc` frames with `sandbox="allow-scripts"` and a restrictive CSP. Never add
same-origin, forms, popups, or top-navigation privileges, or execute generated JavaScript in React
or the extension host. These restrictions reduce risk but do not guarantee that arbitrary code is safe.

Preview diagnostics offer advisory script-error, empty-content and unavailable-status notices,
with code inspection and reset. They do not prove that interactions work or that code is safe.
The footer says **No automatic project edits**: Save HTML can write to a user-chosen project path.

Support keyboard navigation, visible focus, labeled controls, dialog focus management, announced
errors and status, reduced motion, and readable light, dark, and high-contrast editor themes.

## Architecture and scope

The extension host handles editor access, source snapshots, provider requests, secrets, session
state, confirmations, clipboard access, and save dialogs. A React and TypeScript webview renders
the comparison using editor theme tokens. Vite builds its local assets; esbuild bundles the host.
There is no HTTP service. `npm run dev` is a sample-only **Browser harness** with no editor access
or live provider calls.

Keep the work focused on capture, comparison, refinement, and manual handoff. Dependency collection,
rendered capture, automatic project edits, Marketplace publication, app accounts, databases, teams,
billing features, GitHub/Figma/MCP integrations, analytics, and generated React compilation are
outside the current scope. The earlier standalone website architecture has been retired.
