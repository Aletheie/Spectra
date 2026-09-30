# Cursor generation timeout fix — 2026-09-30

Spectra 0.2.5 gives Cursor generate/refine/remix ten minutes instead of the shared 90-second
direct-provider deadline. The editor bridge waits thirteen minutes for those requests, including
confirmation/transport time, instead of timing out at three minutes. Other requests retain their
existing deadlines. Native generation progress reports elapsed waiting time and remains cancellable.
The model, source, output contract, subprocess isolation and no-retry behavior are preserved.

The source changes are in `extension/cursor.ts`, `extension/extension.ts`,
`src/domain/timeouts.ts` and `src/services/editor.ts`, with regression tests beside the adapters.

## Verification performed

- An isolated release snapshot at `/private/tmp/spectra-timeout-release` passed `npm run check`:
  lint, formatting, 69 tests, TypeScript, Vite and esbuild.
- Tests advance virtual deadlines while using real fixture subprocesses: a complete response
  survives the old 90/180-second cutoffs; the new full deadline still kills the process and removes
  its temporary workspace. No model request or user source is involved in these tests.
- Bridge tests accept delayed results for Cursor generate, refine and remix and still reject an
  unresponsive host at the full transport deadline. Host tests cover progress cleanup, cancellation,
  late results and preservation of the existing canvas.
- The 33 affected Cursor/host/bridge tests also passed in the working repository after adapting the
  new HTML fixture to concurrent React-output fixture changes.
- `npm run package` produced `spectra-0.2.5.vsix`; its version, host and webview assets were checked
  against the tested build. SHA-256: `5d7e26c722a48a03a594c87526f4eee355e31bcd1330280183e2731f10e9f500`.
- Cursor CLI installed the package and reported `spectra-local.spectra@0.2.5`.

## Release scope and remaining rehearsal

Other React replacement and demo changes were being edited concurrently. The installed hotfix uses
the previous verified Spectra source snapshot plus the timeout changes; those concurrent edits were
left in the working repository. The release snapshot was assembled from repository base `4ddba97`
and the captured 0.2.4 source files in `/private/tmp/spectra-timeout-fix-s4zrk8p0`, with this fix applied.
The full working-tree check was not claimed for that concurrent feature work.

No live AI generation or native notification interaction was performed for this fix. Reload the
Cursor window, capture the previously failing section and retry. A server/model failure can still
occur; this fix removes Spectra's premature local deadlines without promising provider availability.
