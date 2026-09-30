# Changelog

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
