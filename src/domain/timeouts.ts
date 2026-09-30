import type { EditorCommand } from './protocol'

// A CLI request may reconstruct the original and write three complete directions.
// Keep the bridge alive for that entire budget, plus time for native confirmation.
export const CURSOR_GENERATION_TIMEOUT_MS = 10 * 60 * 1000
export const EDITOR_REQUEST_TIMEOUT_MS = 3 * 60 * 1000

export const editorRequestTimeout = (command: EditorCommand) =>
  (command.command === 'generate' || command.command === 'refine' || command.command === 'remix') &&
  command.provider === 'cursor'
    ? CURSOR_GENERATION_TIMEOUT_MS + EDITOR_REQUEST_TIMEOUT_MS
    : EDITOR_REQUEST_TIMEOUT_MS
