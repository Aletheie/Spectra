# Spectra editor compatibility

Spectra 1.0.3 targets desktop editors that accept VSIX packages and implement the VS Code 1.96+
extension API in a Node extension host. It uses standard commands, webviews, SecretStorage,
clipboard, native dialogs and reviewed text edits. No Cursor-specific editor API is required.
Its source boundary requires local workspace files. Browser-only editors and virtual workspaces
are not supported. See the [VS Code host model](https://code.visualstudio.com/api/advanced-topics/extension-host).

## Providers and installation

Install `spectra-1.0.3.vsix` using **Extensions: Install from VSIX…**, then open a trusted local
workspace. Configure OpenAI or Anthropic through **Spectra: Configure AI Provider**. Both work
without Cursor installed. Keys are entered in a native password prompt and stored in that editor
profile's SecretStorage; configure them separately when moving to another editor/profile.

Cursor lists its CLI first; other editors list OpenAI and Anthropic first. Spectra selects the first
configured provider, otherwise the first listed. Selecting a provider or generating fixes that
choice through status refreshes. Cursor CLI remains optional on macOS/Linux/WSL. Outside Cursor,
Spectra does not probe the CLI on open/focus unless its executable is explicitly configured or the
user checks/signs in during the session. CLI sign-out stops background checks.

Spectra does not reuse Copilot, Antigravity, Windsurf or editor-chat subscriptions, credentials or
model choices. Live generation uses the selected API key or the explicitly connected Cursor CLI
account. **Copy brief** works with manual pasting into any editor's AI chat. Offline samples need
neither a CLI nor a key.

## Antigravity products

Google documents [Antigravity IDE](https://antigravity.google/docs/ide/overview/) separately from
[Antigravity 2.0 desktop](https://antigravity.google/docs/overview/), which operates independently of
an IDE. The installed Antigravity 2.8.1 desktop application is not a verified VSIX extension host.
Do not treat its presence as an Antigravity IDE compatibility test.

Antigravity IDE is a compatibility candidate only if that release supports local VSIX installation
and the required VS Code APIs. Its native runtime has not been tested here. Google also offers an
[Antigravity extension for VS Code](https://antigravity.google/docs/ide/extensions/vscode/); this
does not provide an implicit model/login integration for Spectra.

## Verification

Recorded on 2026-10-02, macOS arm64, local 1.0.3 working tree:

| Editor                               | Evidence                                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VS Code 1.140.0                      | Native activation, styled webview, interactive sample, curated generation/Choose and unsaved selection capture passed.                                                                                                |
| Cursor 3.22.12 (VS Code API 1.128.0) | Native activation/assets/empty panel passed. The run exposed the corrected narrow-preview bug. Final guarded launch was blocked by nested macOS/Chromium sandbox initialization; full native flow remains unverified. |
| Antigravity IDE                      | Native runtime not available here; VSIX/API compatibility still requires a test.                                                                                                                                      |
| Antigravity desktop 2.8.1            | Separate desktop agent product; not tested or declared as a Spectra VSIX host.                                                                                                                                        |
| VSCodium, Windsurf and other forks   | Standard API target and simulated host coverage; no native runtime check performed.                                                                                                                                   |

Final native VS Code report/screenshots are in the ignored local directory
`dist/native-test-results/native-code-1790942518017/`. This is an Extension Development Host check,
not a VSIX installation or a live-AI run. All 99 unit and 27 browser tests passed.

Unit tests simulate provider ordering and independent capture/generation/export in VS Code,
Antigravity IDE, VSCodium and Windsurf host identities. Simulated app names do not prove native
compatibility. Browser tests cover the actual UI with host messages; provider calls use fixtures.
Record actual desktop versions and checks in [the checklist](DEMO_CHECKLIST.md).

Build first, then run a real editor with an isolated profile and temporary fixture workspace:

```sh
npm run build
npm run test:native -- --editor "/absolute/path/to/editor/executable"
```

On macOS, use the executable inside the app, for example
`/Applications/Visual Studio Code.app/Contents/MacOS/Code`. The runner does not use the normal
editor profile or installed extensions. It must fail visibly if the chosen application does not
support the extension-host test interface. Native smoke checks do not prove live provider quality,
keychain persistence, actual reviewed replacement or compatibility with every fork/version.

The Cursor test runner currently requires macOS `sandbox-exec` and denies reads/writes to the
ordinary `.cursor`, `.config/cursor` and `Library/Application Support/Cursor` directories. This
protects against Cursor-owned services that can outlive profile boundaries. The runner refuses
an unguarded Cursor run on another OS; this restriction concerns the test harness, not direct API
use in the Spectra extension. Editor-owned networking is outside Spectra's provider test coverage.
