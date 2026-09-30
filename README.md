# Spectra

Try three design directions for a component, side by side in Cursor.

Select some code, describe what you want to change, and compare the results with an AI
reconstruction of the original. Refine a direction, combine two, then copy your choice into
Cursor chat or save it as HTML.

Spectra runs as a local Cursor extension. It can generate through your Cursor CLI account,
OpenAI, or Anthropic. There's also a prepared sample you can try without an account or API key.

For a complete source-capture walkthrough, try [Perseid](examples/perseid/README.md): three
self-contained interactive HTML components, ready-to-copy prompts, and a step-by-step guide in Czech.
Open [the demo launcher](examples/perseid/index.html) in a browser, then capture a component in Cursor.

## Install in Cursor

From the project folder:

```sh
npm install
npm run package
```

Open the command palette in Cursor (**Cmd+Shift+P** on macOS, **Ctrl+Shift+P** on Windows/Linux).
Run **Extensions: Install from VSIX…**, select `spectra-0.2.3.vsix`, and reload if prompted.

To try it straight away, run **Spectra: Open Curated Sample**. The Orbit pricing example uses
prepared variants and preset edits; it works offline and doesn't call an AI provider.

If you have an older build under a different name, disable or uninstall it first. Spectra uses
`spectra-local.spectra` as its extension ID, so you'll need to enter API keys and custom settings
again. An existing Cursor CLI login can be reused after **Check connection**.

## Connect AI

Open a workspace you trust, then run **Spectra: Configure AI Provider** from the command palette.

### Cursor account

1. Install the [Cursor CLI](https://cursor.com/docs/cli/installation) on the machine running the
   extension. This option supports macOS, Linux, and WSL.
2. Spectra detects an existing CLI login when you open the panel. To sign in, select
   **Cursor account → Sign in to Cursor**, finish the browser login, then return to Cursor.
   Use **Check Cursor** beside the prompt to retry directly. The panel shows the actual setup
   error instead of silently keeping Generate disabled. **Check connection** remains in AI providers.
3. Select **Cursor account** in the comparison panel when generating.

This uses the CLI's Cursor account. You don't need an OpenAI or Anthropic key, but your Cursor
account's usage limits and billing apply. If login hasn't been detected yet, Spectra checks on
opening the panel, when you return to Cursor, and for up to three minutes after starting login. Model access and quota are checked when you generate.

The model defaults to `auto`. Use **AI providers → Cursor account → Connect / check → List models**
to load a searchable picker and select a specific model. Spectra saves the selection in user settings
as `spectra.cursorModel`; it applies to the next generate, refine or remix request. You can also edit
that setting manually. The model and conversation from Cursor's editor chat are separate.

Spectra looks for `~/.local/bin/agent` or `~/.local/bin/cursor-agent`. For another location, set
`spectra.cursorCliPath` to the executable's absolute path, without arguments. Remote workspaces
need the CLI installed and signed in on the extension host. Native Windows hosts can use the
direct API options below.

### OpenAI or Anthropic

Select the provider and enter its API key in the editor's password prompt. The key is saved in
SecretStorage. API usage is billed by the provider, separately from Cursor.

| Setting                  | Default                    |
| ------------------------ | -------------------------- |
| `spectra.cursorModel`    | `auto`                     |
| `spectra.openaiModel`    | `gpt-4.1`                  |
| `spectra.anthropicModel` | `claude-sonnet-4-20250514` |

A saved API key still needs a successful request to confirm that it works.

## Use your own component

1. Open a component file in your workspace. Select the part you want to explore, or leave the
   selection empty to use the whole file.
2. Run **Spectra: Explore Component** from the command palette or editor context menu.
3. Review the captured code and describe the change. For example: “Group the optional fields
   together and make the submit button easier to find.”
4. Choose a provider, generate, and confirm the source transmission in the editor dialog.
5. Compare **Original | A | B | C**. Use **Refine** to change one direction or select two to remix.
6. Choose a result. **Copy for Cursor** copies a brief and the selected code for you to paste into
   Cursor chat. **Save HTML** opens a save dialog for a standalone file.

**Original is an AI reconstruction**, including for HTML input. Spectra captures the selected
code and unsaved edits, but doesn't collect imports, stylesheets, or the rest of the app. Missing
context can affect the preview. Generated results use HTML, CSS, and vanilla JavaScript; adapting
them to your framework happens through the manual handoff.

The source limit is 60,000 characters; instructions can use up to 3,000. Closing the panel clears
its comparison history, so copy or save anything you want to keep.

## Source and privacy

Each live request asks for confirmation before sending the snapshot, instructions, and relevant
variants. Review the code for secrets first. Spectra checks file locations and obvious sensitive
filenames, but cannot detect every secret in source code.

The Cursor adapter starts the CLI in a temporary workspace with file, shell, web, and MCP tools
denied. Its configuration lives in extension storage. The CLI manages its own login and may keep
conversation history after you close the panel. Signing out of the CLI can affect other CLI
sessions. See the [CLI contract](docs/LLM_CONTRACT.md#cursor-cli) for the details and verification limits.

Previews run in sandboxed frames. Saved HTML runs outside that isolation and omits the preview
security policy. Review generated code before opening it or using it in production.

## Development

Open this repository in Cursor and press **F5** with **Run Spectra extension** selected. The launch
configuration builds the extension and opens an Extension Development Host. Open a test workspace
there and run one of the Spectra commands.

| Command                                   | What it does                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run build`                           | Typecheck and build the webview and extension host                             |
| `npm run watch`                           | Rebuild bundles as files change                                                |
| `npm run dev`                             | Open the sample-only browser harness; editor access and live AI require Cursor |
| `npm run package`                         | Build a local VSIX for installation                                            |
| `npm run lint`                            | Check code conventions: type aliases, arrow functions, loops and type safety   |
| `npm run test:browser`                    | Run Playwright browser regressions (harness and simulated host)                |
| `npm test`                                | Run automated tests                                                            |
| `npm run format` / `npm run format:check` | Format files / check formatting                                                |
| `npm run check`                           | Run lint, formatting checks, tests, and build                                  |

The extension uses the VS Code API, a React webview, Vite, and esbuild. It needs no local server.
Host code lives in `extension/`, the UI in `src/components/`, and shared contracts in `src/domain/`.

Use the [test checklist](docs/DEMO_CHECKLIST.md) to check installation, editor interactions, and live
providers. Automated tests use mocked editor and provider APIs; a passing build doesn't verify
those runtime flows. Browser tests need Playwright Chromium installed (`npx playwright install chromium`).
See the [UX implementation and verification record](docs/UX_FIXES_2026-09-30.md) for the latest checks.

- [Product behavior](docs/PRODUCT.md)
- [Source, provider, and preview contracts](docs/LLM_CONTRACT.md)
- [Contributor and agent instructions](AGENTS.md)
