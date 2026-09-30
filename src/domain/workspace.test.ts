import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withLineage, directionLabel } from './lineage'
import { demoVariants, original } from '../variants'
import { validEditorState, validHostMessage } from './validation'
import { initialEditorState } from './protocol'
import { validateSource } from '../../extension/source'
import { documentFor, exportDocument } from './document'

test('host lineage records exact parents and stable revision families', () => {
  const directions = withLineage(demoVariants, [], 'generate')
  const first = withLineage([{ ...directions[0], id: 'a2' }], directions, 'refine', [
    directions[0].id,
  ])[0]
  const previous = [...directions, first]
  const second = withLineage([{ ...first, id: 'a3' }], previous, 'refine', [first.id])[0]
  assert.equal(directionLabel(first), 'A v2')
  assert.equal(directionLabel(second), 'A v3')
  assert.deepEqual(second.lineage?.sourceIds, ['a2'])
  const mix = withLineage([{ ...first, id: 'mix1' }], previous, 'remix', [
    directions[2].id,
    first.id,
  ])[0]
  assert.deepEqual(mix.lineage?.sourceIds, [directions[2].id, 'a2'])
  const state = {
    ...initialEditorState,
    baselineKind: 'sample' as const,
    original,
    variants: [...previous, second, mix],
  }
  assert.equal(validEditorState(state), true)
  assert.equal(validEditorState({ ...state, variants: [second, ...previous, mix] }), false)
})

test('status deltas allow only operation status, never replacement source or implementations', () => {
  const status = {
    busy: true,
    activity: { command: 'copyHandoff', phase: 'running' },
    providers: [],
    trusted: true,
  }
  assert.equal(validHostMessage({ type: 'status', status }), true)
  assert.equal(
    validHostMessage({ type: 'status', status: { ...status, variants: demoVariants } }),
    false,
  )
  assert.equal(
    validHostMessage({
      type: 'status',
      status: { ...status, activity: { command: 'runShell', phase: 'running' } },
    }),
    false,
  )
  assert.equal(validHostMessage({ type: 'status', status: { ...status, busy: false } }), false)
  assert.equal(
    validHostMessage({ type: 'response', id: 'cancelled', ok: false, cancelled: true }),
    true,
  )
  assert.equal(
    validHostMessage({ type: 'response', id: 'invalid', ok: true, cancelled: true }),
    false,
  )
})

test('design token styles are capturable without admitting credential files or directories', () => {
  for (const file of [
    'src/styles/tokens.css',
    'src/styles/design-tokens.scss',
    'src/styles/token.css',
  ])
    validateSource(file, 'css', ':root { --accent: blue }')
  for (const file of [
    'src/tokens.ts',
    'src/access-token.js',
    'src/secrets/tokens.css',
    'src/credentials/design-tokens.scss',
    '.private/tokens.css',
    'node_modules/tokens.css',
  ])
    assert.throws(() => validateSource(file, 'css', 'source'))
})

test('preview diagnostics inherit the nonce and never appear in exports', () => {
  const html = documentFor(original, true, 'safe_nonce', 'preview-id')
  assert.match(html, /spectra-preview/)
  assert.match(html, /<script nonce="safe_nonce">/)
  assert.doesNotMatch(documentFor(original, true, undefined, "bad'id"), /spectra-preview/)
  assert.doesNotMatch(exportDocument(original), /spectra-preview|Content-Security-Policy/)
})
