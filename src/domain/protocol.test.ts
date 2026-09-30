import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoVariants, original } from '../variants'
import {
  initialEditorState,
  MAX_PROMPT_LENGTH,
  MAX_SOURCE_LENGTH,
  type EditorState,
  type SourceContext,
} from './protocol'
import {
  validEditorCommand,
  validEditorRequest,
  validEditorState,
  validHostMessage,
} from './validation'

const source: SourceContext = {
  id: 'snapshot-1',
  relativePath: 'src/Card.tsx',
  language: 'typescriptreact',
  code: 'export const Card = () => <article>Card</article>',
  startLine: 1,
  endLine: 1,
  selection: true,
}
const sample: EditorState = {
  ...initialEditorState,
  baselineKind: 'sample',
  original,
  variants: demoVariants,
}

// These are deliberately untyped inputs: the wire boundary cannot trust TS types.
test('editor commands enforce the allowlist, intent limits and exact source cardinality', () => {
  const generate = { command: 'generate', provider: 'demo', prompt: 'Simplify' }
  const refine = { command: 'refine', provider: 'openai', prompt: 'Simplify', sourceIds: ['a'] }
  const remix = {
    command: 'remix',
    provider: 'anthropic',
    prompt: 'Combine',
    sourceIds: ['a', 'b'],
  }
  for (const command of [
    { command: 'getState' },
    { command: 'captureSource' },
    { command: 'loadSample' },
    { command: 'openSource' },
    { command: 'configureProvider', provider: 'openai' },
    { command: 'copyHandoff', variantId: 'a' },
    { command: 'exportHtml', variantId: 'a' },
    generate,
    refine,
    remix,
    { ...generate, prompt: 'x'.repeat(MAX_PROMPT_LENGTH) },
  ])
    assert.equal(validEditorCommand(command), true, JSON.stringify(command))

  for (const command of [
    null,
    [],
    { command: 'executeCommand', editorCommand: 'workbench.action.closeWindow' },
    { command: 'captureSource', uri: 'file:///private/file' },
    { command: 'configureProvider', provider: 'demo' },
    { command: 'exportHtml', variantId: '' },
    { command: 'copyHandoff', variantId: 'x'.repeat(201) },
    { ...generate, provider: 'other' },
    { ...generate, prompt: '  ' },
    { ...generate, prompt: 123 },
    { ...generate, prompt: 'x'.repeat(MAX_PROMPT_LENGTH + 1) },
    { ...generate, sourceIds: ['a'] },
    { ...refine, sourceIds: [] },
    { ...refine, sourceIds: ['a', 'b'] },
    { ...refine, sourceIds: [null] },
    { ...refine, sourceIds: [' '] },
    { ...remix, sourceIds: ['a', 'a'] },
    { ...remix, sourceIds: ['a', 'b', 'c'] },
    { ...remix, sources: demoVariants },
  ])
    assert.equal(validEditorCommand(command), false, JSON.stringify(command))
})

test('request envelopes preserve the command allowlist', () => {
  const request = {
    type: 'request',
    id: 'request-1',
    command: 'generate',
    provider: 'openai',
    prompt: 'Simplify',
  }
  assert.equal(validEditorRequest(request), true)
  for (const invalid of [
    { ...request, id: '' },
    { ...request, type: 'response' },
    { ...request, source: original },
    { ...request, prompt: ' ' },
    { type: 'request', id: 'request-1', command: 'captureSource', uri: 'file:///private/file' },
  ])
    assert.equal(validEditorRequest(invalid), false)
})

test('host state accepts valid capture, reconstruction and revision history', () => {
  assert.equal(validEditorState(initialEditorState), true)
  assert.equal(validEditorState({ ...initialEditorState, source }), true)
  assert.equal(validEditorState(sample), true)
  const revisions = Array.from({ length: 16 }, (_, index) => ({
    ...demoVariants[0],
    id: `revision-${index}`,
  }))
  assert.equal(validEditorState({ ...sample, variants: revisions.slice(0, 15) }), true)
  assert.equal(validEditorState({ ...sample, variants: revisions }), false)
  assert.equal(
    validEditorState({
      ...sample,
      baselineKind: 'reconstructed',
      source: { ...source, code: 'x'.repeat(MAX_SOURCE_LENGTH) },
      trusted: true,
      providers: [{ id: 'openai', label: 'OpenAI', model: 'gpt-4.1', configured: true }],
      variants: [...demoVariants, { ...demoVariants[0], id: 'revision-1' }],
    }),
    true,
  )
})

test('malformed host state cannot replace a valid canvas', () => {
  for (const state of [
    null,
    { variants: [] },
    { ...sample, variants: [null] },
    { ...sample, variants: [demoVariants[0], demoVariants[0]] },
    { ...sample, variants: [{ ...demoVariants[0], changes: [] }] },
    { ...sample, variants: [{ ...demoVariants[0], id: 'original' }] },
    { ...sample, original: { ...original, id: demoVariants[0].id } },
    { ...sample, original: { ...original, html: ' ' } },
    { ...sample, original: null },
    { ...sample, baselineKind: 'none' },
    { ...sample, baselineKind: 'reconstructed' },
    { ...sample, source },
    { ...sample, busy: 'false' },
    { ...sample, trusted: 1 },
    { ...sample, intent: 'x'.repeat(MAX_PROMPT_LENGTH + 1) },
    { ...sample, providers: undefined },
    { ...sample, providers: [{ id: 'demo', label: 'Demo', model: 'preset', configured: true }] },
    {
      ...sample,
      providers: [
        { id: 'openai', label: 'OpenAI', model: 'gpt-4.1', configured: true },
        { id: 'openai', label: 'OpenAI', model: 'gpt-4.1', configured: false },
      ],
    },
  ])
    assert.equal(validEditorState(state), false)

  // Structured clone preserves sparse arrays; Array.every alone skips their holes.
  assert.equal(validEditorState({ ...sample, variants: Array(1) }), false)
  assert.equal(validEditorState({ ...sample, providers: Array(1) }), false)
  assert.equal(
    validEditorState({ ...sample, variants: [{ ...demoVariants[0], changes: Array(1) }] }),
    false,
  )
  assert.equal(
    validEditorCommand({
      command: 'refine',
      provider: 'demo',
      prompt: 'Simplify',
      sourceIds: Array(1),
    }),
    false,
  )

  for (const invalidSource of [
    { ...source, code: 'x'.repeat(MAX_SOURCE_LENGTH + 1) },
    { ...source, code: '' },
    { ...source, startLine: 0 },
    { ...source, endLine: 0 },
    { ...source, startLine: 1.5 },
    { ...source, endLine: Infinity },
    { ...source, selection: 'true' },
    { ...source, relativePath: null },
  ])
    assert.equal(validEditorState({ ...initialEditorState, source: invalidSource }), false)
})

test('host responses require actual booleans and string messages before settling a request', () => {
  const response = { type: 'response', id: 'request-1', ok: true }
  assert.equal(validHostMessage(response), true)
  assert.equal(validHostMessage({ ...response, message: 'Ready' }), true)
  assert.equal(validHostMessage({ ...response, ok: false, error: 'Rate limit reached' }), true)
  assert.equal(validHostMessage({ type: 'state', state: sample }), true)
  for (const message of [
    null,
    { type: 'state', state: { variants: [null] } },
    { ...response, type: 'unknown' },
    { ...response, id: ' ' },
    { ...response, ok: 'false' },
    { ...response, ok: undefined },
    { ...response, message: {} },
    { ...response, error: [] },
    { ...response, error: 'x'.repeat(12001) },
  ])
    assert.equal(validHostMessage(message), false)
})

test('Cursor setup actions and connection details are bounded allowlisted messages', () => {
  for (const action of ['check', 'login']) {
    assert.equal(
      validEditorCommand({ command: 'configureProvider', provider: 'cursor', action }),
      true,
    )
    assert.equal(
      validEditorCommand({ command: 'configureProvider', provider: 'openai', action }),
      false,
    )
  }
  assert.equal(
    validEditorCommand({ command: 'configureProvider', provider: 'cursor', action: 'logout' }),
    false,
  )
  const provider = {
    id: 'cursor',
    label: 'Cursor account',
    model: 'auto',
    configured: false,
    connection: 'checking',
    detail: 'Checking login…',
  }
  assert.equal(validEditorState({ ...initialEditorState, providers: [provider] }), true)
  for (const invalid of [
    { ...provider, configured: true },
    { ...provider, connection: 'executing-shell' },
    { ...provider, detail: 'x'.repeat(1201) },
    { ...provider, detail: { token: 'secret' } },
  ])
    assert.equal(validEditorState({ ...initialEditorState, providers: [invalid] }), false)
})
