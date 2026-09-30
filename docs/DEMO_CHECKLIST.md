# Spectra: test checklist

Use this before a demo or release. Tick an item only after checking it, and record the environment
and result. Keep automated tests, browser checks, editor checks, and live requests separate.
An unchecked item means it still needs testing.

## Build and install

- [ ] `npm install` completes.
- [ ] `npm run check` succeeds (lint, format check, tests, TypeScript and production build).
- [ ] `npm run test:browser` succeeds with Playwright Chromium available. These tests cover the
      browser harness and simulated host only, not native editor or live provider behavior.
- [ ] `dist/extension.cjs`, `dist/webview/index.js` and `dist/webview/index.css` exist after building.
- [ ] `npm run package` creates a local VSIX with the built assets. Inspect its contents for secrets
      or unintended source fixtures before installation.
- [ ] Install with **Extensions: Install from VSIX…** in Cursor and reload if prompted.
- [ ] The package identifies itself as `spectra-local.spectra` with display name Spectra. When replacing
      a differently named build, disable the old extension and reconfigure custom settings/API keys;
      previous extension settings and secrets are not automatically migrated.
- [ ] Alternatively press F5 using `.vscode/launch.json` to open an **Extension Development Host**.
- [ ] All four Spectra commands appear. Open Comparison Canvas opens an empty panel beside the
      editor; running it again reveals the same panel.
- [ ] In a trusted workspace, Use editor selection and Add key are enabled after opening the panel.
      Check the installed extension too: Cursor hides window.parent before loading the UI.

## Capture source in Cursor

- [ ] Trust a suitable test workspace, open a supported component, select source and run
      **Spectra: Explore Component** from the palette or editor context menu.
- [ ] Relative filename, language, inclusive line range and selection indicator are correct.
- [ ] Unsaved source edits appear in the snapshot; imports/dependencies are not read automatically.
- [ ] With no selection, the entire document is captured. Empty/over-60,000-character input fails.
- [ ] Unsupported, hidden, generated, and obvious secret files, plus outside-workspace symlinks,
      are rejected without losing the canvas. Review ordinary source for embedded secrets yourself.
- [ ] Clicking Use editor selection from the webview targets the last active editor document, not an
      older supported component after the user switched to an unsupported document.
- [ ] Review captured source shows the captured code as text. Open source reveals the current file
      while keeping the saved snapshot unchanged.
- [ ] Re-capture/load sample asks before replacing an exploration; cancel preserves existing work.
- [ ] Untrusted workspace permits explicit samples only, not source access, keys, live AI or exports.

## Configure a direct API provider

- [ ] **Spectra: Configure AI Provider** opens the native picker. Selecting OpenAI or Anthropic
      opens the editor's password prompt.
- [ ] Add, replace and remove a test key. Keys persist in editor SecretStorage, not workspace files,
      webview messages, logs, bundle configuration or `.env`.
- [ ] Settings show that the key is saved and explain that a connection has not been checked.
- [ ] Model settings default to `gpt-4.1` and `claude-sonnet-4-20250514`; explicitly set another
      supported account model if necessary. Direct API keys are separate from Cursor CLI login.
- [ ] Before each live generate/refine/remix, a native consent dialog names vendor/model and exact
      categories of context sent. Cancellation makes no provider call and recovers the controls.
- [ ] The presenter understands what source is sent and which account pays for API requests.

## Connect and use Cursor CLI

- [ ] Install the official CLI on the extension host (macOS/Linux/WSL). Verify missing executable and
      invalid `spectra.cursorCliPath` produce actionable errors without changing the canvas.
- [ ] AI providers → Cursor account → Sign in to Cursor opens native CLI browser login in the dedicated
      Spectra configuration. CLI credential storage may be shared with other CLI sessions. No password
      or token is entered into the webview or copied by the extension.
- [ ] Opening the panel detects an existing CLI login. After browser sign-in, returning to Cursor
      updates readiness without another setup step. With a captured component and valid instruction,
      Generate 3 directions becomes available. Source, instruction, and previews remain unchanged.
- [ ] Finish browser login after returning focus early: bounded polling or closing the login terminal
      still enables Generate. Check Cursor retries directly, without reopening the provider picker.
- [ ] A missing CLI or failed status check shows its reason beside the prompt; a keychain error for
      direct API keys does not disable Cursor or prevent initial source state from reaching the UI.
- [ ] Configuring an available API provider selects it, preserving the instruction and existing canvas.
- [ ] Check connection still reports setup errors. Signed-out or malformed status leaves it unavailable.
      The UI distinguishes login detection from model/quota checks. Untrusted workspaces do not check
      CLI login automatically, and a late result after sign-out or panel close cannot restore readiness.
- [ ] Confirm model `auto` and an account-supported explicit `spectra.cursorModel`. Confirm editor chat
      selection/history is not inherited. Record actual model IDs and CLI version.
- [ ] Consent names Cursor and includes snapshot/range, model, usage/billing and CLI history persistence.
      Declining starts no generation. Spectra's CLI configuration does not alter normal Cursor configuration.
- [ ] List models shows CLI account model IDs; Sign out of Cursor CLI explains the shared login impact.
- [ ] Rehearse successful first generation, regenerate, exact-source refine, ordered two-source remix,
      choose and manual handoff. Original remains fixed; previous revisions stay available.
- [ ] Verify CLI file read/write, shell, web fetch and MCP denials in actual CLI execution. Use an
      innocuous outside-workspace test file and confirm it is neither read nor changed. Mock tests
      verifying configuration do not establish real tool isolation or absence of implicit context.
- [ ] Check cancellation, panel close, timeout, quota, unsupported model and malformed output. Confirm
      process termination, temporary workspace cleanup, unchanged canvas and recovered controls.
- [ ] Verify browser harness cannot configure or invoke Cursor CLI. Check direct API providers still work.

## Try a real component

1. Capture a small, self-contained component and review the snapshot for sensitive data.
2. Enter a specific hierarchy/layout/interaction instruction and choose a configured provider.
3. Confirm transmission. Explain that Original is an **AI reconstruction** of the captured source.
4. Compare Original | A | B | C and explain the meaningful difference in each design hypothesis.
5. Choose a direction, refine its exact implementation, and inspect the new chosen revision.
6. Copy for Cursor; inspect the clipboard brief, then paste it manually into Cursor when ready.
7. Save HTML through the native dialog and review its code before opening it outside isolation.

- [ ] Verify at least one successful initial request with each supported vendor. Record model IDs.
- [ ] First generation returns an original and exactly three directions together. Check HTML/CSS
      input as well as React. An incomplete response must leave the previous canvas intact.
- [ ] Directions differ beyond colors; names, hypotheses, concrete changes, Choose and Refine exist.
- [ ] Independently interactive previews work inside the actual editor's inherited parent/iframe CSP.
- [ ] Regeneration, refine, remix and provider/model changes keep the original reconstruction fixed.
- [ ] Refinement preserves its source and selects its new version only after success in chosen view.
- [ ] Selecting exactly two sources enables remix; one coherent implementation returns in source order.
- [ ] Up to 15 directions are retained. At the limit, the UI asks for a fresh comparison and keeps
      the existing revisions until regeneration succeeds.
- [ ] Source/output product facts remain intact; illustrative proof is visibly labeled.

## Copy for Cursor and Save HTML

- [ ] Clipboard brief includes exact snapshot, file/range, intent, chosen hypothesis, changes and
      selected HTML/CSS/JS, including the latest refinement rather than stale code.
- [ ] Copy is a manual handoff, not automatic chat/agent launch or modification of a project file.
- [ ] Export warning explains that standalone HTML omits preview CSP and iframe isolation.
- [ ] Native save dialog writes the exact selected version to the chosen location only; cancellation
      writes nothing. Errors do not lose the selection. Review the output before opening it.
- [ ] Saved HTML is self-contained and does not require React, Tailwind or a build step.
- [ ] Closing/reopening the panel clears its in-memory session without deleting saved files or keys.

## Errors and cancellation

- [ ] Blank/oversized instructions and forged extra command fields fail before provider access.
- [ ] Duplicate actions while busy are rejected; native notification can cancel generation.
- [ ] Missing key, invalid model, authorization, quota, network and timeout errors are actionable.
- [ ] Invalid JSON, truncated/refused output, wrong cardinality, invalid/oversized fields and stale
      source IDs preserve the last valid canvas, chosen direction and recoverable instruction.
- [ ] Live failure never returns curated data silently. Busy state always recovers.
- [ ] Close the panel mid-request: abort occurs and no late result reopens or updates a new session.
- [ ] Provider keys, raw error bodies and sensitive source are not emitted to logs or error messages.
- [ ] Child-frame postMessage cannot trigger host commands or mutate trusted UI state.
- [ ] Preview sandbox is exactly `allow-scripts`, with no same-origin/forms/popups/top navigation.
- [ ] In the real editor, local preview JS works while external scripts/assets, fetch and real form
      submissions are blocked. Do not infer runtime CSP behavior merely from string-based unit tests.
- [ ] Preview and export copy explains the limits of isolation and asks users to review generated code.

## Try the prepared sample

Use **Spectra: Open Curated Sample** explicitly; demo mode is not available for imported components.

1. Explain that Orbit uses prepared directions and preset edits.
2. Use “Make this feel premium and make the yearly plan the obvious choice.”
3. Generate three presets; compare; choose; refine with “Make it more minimal.”
4. Optionally remix two sample directions and explain the preset transformation.
5. Save the selected sample HTML or use the editor's manual handoff.

- [ ] Demo prices stay $30/month or $24/month billed yearly ($288/year), savings $72/year (20%),
      with ten team members included, not per-member pricing.
- [ ] Monthly/yearly toggles update price, period, total and savings consistently in independent frames.
- [ ] Ratings, logos, quotes, and counts keep their illustrative labels after edits and export.
- [ ] If live AI fails, explain it and explicitly switch to a sample; never pretend it is live output.

## Browser layout and accessibility

- [ ] `npm run dev` serves only the labeled Browser harness. No API server, API keys, editor source
      import or native handoff is available. Sample HTML download is intentionally browser-only.
- [ ] Rehearse generate/compare/choose/refine/remix and sample export in the harness, noting that this
      does not verify native commands, secrets, editor CSP, live AI, installation or F5.
- [ ] Wide layouts show useful simultaneous comparison; narrow editor panels scroll without tiny text
      or inaccessible controls. Mobile preview and expanded inspection are usable.
- [ ] Light/dark/high-contrast editor themes remain readable. Focus is visible and labels are clear.
- [ ] Keyboard users can reach actions, use Cmd/Ctrl+Enter, close safe dialogs, and have focus restored.
- [ ] Dialog focus is contained; errors/loading are announced; reduced-motion preference is respected.
- [ ] Host busy/key/model status updates do not reload unchanged iframe previews or reset local controls.
- [ ] Choose and return to Compare preserve a tested billing/form state. Expanded inspection explains
      its separate state. Regeneration finishing during inspection closes an obsolete direction.
- [ ] Copy, save, configuration and consent use the correct activity labels. An export failure does
      not invalidate refinement; cancelling a native dialog preserves the draft without an error.
- [ ] Long valid hypotheses do not misalign previews. Choose/Refine and chosen export actions stay
      reachable at 1440, 720, 600 and 360px panel widths.
- [ ] Remix all ordered sample pairs, including a revision: one plan and one CTA, coherent billing,
      no duplicate page fragments. Visible sample text is at least 12px with contrast of 4.5:1.
- [ ] Broken preview JavaScript offers an advisory diagnostic, Inspect code and Reset. Empty content
      has an explanation; plain text and temporarily hidden frames do not produce false empty notices.
- [ ] A large retained session uses small status deltas; typing and switching views preserve frames.

## Check different component types

- [ ] Capture a button, a form, a navigation snippet and CSS-only source. Check the suggested focus
      and starting instruction; unknown/mixed snippets must remain general. Applying a suggestion
      replaces the text only after the explicit button click; provider updates preserve drafts.
- [ ] Compare a transparent light-text control and a small dark panel on Light, Dark and Transparency
      grid canvases. Confirm the component's authored background remains and canvas controls do not
      appear in exported HTML/CSS or the handoff.
- [ ] Test exact 375, 768 and 1280px widths in a narrow panel, including after several revisions.
      Confirm the measured viewport agrees, horizontal scrolling is available, and Fit column is
      labeled with the actual width rather than called desktop.
- [ ] Switch compact/standard/tall heights and surfaces after interacting in an iframe. State must
      survive these changes and host status updates. Repeat in expanded inspection.
- [ ] Choose/Refine and chosen-view export actions are available before previews at narrow widths.
      After generation the instruction collapses; Edit intent remains available.
- [ ] Add a revision with Cmd/Ctrl+Enter, confirm it is revealed and focused, and return from chosen
      view to see the selected marker. With two remix sources selected, a third cannot displace one;
      both source labels and their order are visible.

## Check what stays unchanged

- [ ] Choose Text, Brand colors and/or Dimensions beside the instruction; name specific elements to keep.
      Confirm keyboard operation, labels, 1,000-character limit and readable narrow-panel layout.
- [ ] With live AI, confirm the native dialog includes constraints and each provider receives them as
      separate structured data. Rehearse “Change layout, preserve text and the main button.” Inspect
      actual text, colors, sizing and button behavior; schema validation alone does not prove compliance.
- [ ] Refine one exact result and remix two with the same constraints; change the constraints for a new
      revision and confirm earlier revisions and the original remain unchanged.
- [ ] Copy an older result for Cursor and verify its original constraints appear rather than the latest
      draft. Verify error/cancellation keeps both the last canvas and draft constraint choices.
- [ ] Capture a different source or load a sample: constraints reset. Demo controls explain why they are
      disabled; forged demo requests with nonempty constraints fail without changing the canvas.

## Record the results

Record the date, environment, commands run, results, and package path. Include CLI version and model
IDs for live checks. Note anything you could not test, the reason, and the next check to run.
