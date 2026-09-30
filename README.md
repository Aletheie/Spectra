<p align="center">
  <img src="media/spectra-extension.png" alt="Spectra logo" width="96" height="96" />
</p>

<h1 align="center">Spectra</h1>

<p align="center">Compare three UI directions for your component, right inside Cursor.</p>

<p align="center">Built for the <strong>spaceXAI &amp; Cursor hackathon</strong>.</p>

Select a component, describe a change, and explore three designs side by side. Refine one,
remix two, then take your chosen result back to your project.

## Get started

```sh
npm install
npm run package
```

In Cursor, run **Extensions: Install from VSIX…** from the command palette, select the generated
`.vsix` file, and reload if prompted.

Open a trusted workspace and run **Spectra: Configure AI Provider**. Connect your account through
the [Cursor CLI](https://cursor.com/docs/cli/installation) (macOS, Linux, or WSL), or enter an
**OpenAI** or **Anthropic** API key. API keys are stored in editor SecretStorage; the selected
provider's usage limits and billing apply.

To try Spectra offline, run **Spectra: Open Curated Sample**. It uses prepared designs and preset
edits, with no account or API key required.

## Explore a component

1. Select code in your editor and run **Spectra: Explore Component**. An empty selection captures
   the whole file, including unsaved edits.
2. Describe your change, choose a provider, and confirm the source transmission.
3. Compare **Original | A | B | C**. **Refine** one direction or **Remix** two.
4. Choose a result. **Copy for Cursor** prepares a brief for manual pasting into Cursor chat;
   **Save HTML** exports a standalone preview.

**Original is an AI reconstruction.** Spectra captures only the selected source; imports,
stylesheets, and app context may be missing. Review generated code before use. Exported HTML runs
outside the preview sandbox. Copy or save your work before closing the panel; sessions are temporary.

For a guided example, see [Perseid](examples/perseid/README.md): three React + Tailwind components
and a walkthrough in Czech.

## Development

Open the repository in Cursor and press **F5** to launch an Extension Development Host.

```sh
npm run watch        # Rebuild extension bundles as you edit
npm run dev          # Sample-only browser harness
npm run check        # Lint, formatting, tests, and production build
```

[Product guide](docs/PRODUCT.md) · [Source & privacy](docs/LLM_CONTRACT.md) ·
[Verification checklist](docs/DEMO_CHECKLIST.md) · [Contributing](AGENTS.md)
