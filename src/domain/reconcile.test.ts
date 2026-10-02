import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyConstraints } from './constraints'
import { withLineage } from './lineage'
import { initialEditorState, type EditorState, type SourceContext } from './protocol'
import { reconcileEditorState } from './reconcile'
import type { Variant } from './types'
import { demoVariants, original } from '../variants'

const fixture = (): EditorState => ({
  ...initialEditorState,
  source: {
    id: 'snapshot',
    relativePath: 'src/Action.tsx',
    language: 'typescriptreact',
    code: '<button>Save</button>',
    startLine: 1,
    endLine: 1,
    selection: true,
  },
  baselineKind: 'reconstructed',
  original,
  variants: withLineage(
    demoVariants.map((variant) => ({
      ...variant,
      constraints: { ...emptyConstraints },
      react: { language: 'tsx', code: 'export const Action = () => <button>Save</button>' },
    })),
    [],
    'generate',
  ),
})

test('full updates reuse unchanged source, original, variants and constraints', () => {
  const before = fixture()
  const next = {
    ...structuredClone(before),
    busy: true,
    activity: { command: 'generate', phase: 'running' },
    providers: [{ id: 'openai', label: 'OpenAI', model: 'configured-model', configured: true }],
  } satisfies EditorState
  const result = reconcileEditorState(before, next)
  assert.equal(result.source, before.source)
  assert.equal(result.original, before.original)
  assert.equal(result.variants, before.variants)
  assert.equal(result.constraints, before.constraints)
  assert.equal(result.activity, next.activity)
  assert.equal(result.providers, next.providers)
  assert.equal(result.busy, true)
  assert.equal(reconcileEditorState(undefined, next), next)
  assert.equal(reconcileEditorState(before, before), before)
})

test('appending or reordering revisions retains each unchanged implementation', () => {
  const before = fixture()
  const incoming = structuredClone(before)
  const revision = withLineage(
    [{ ...incoming.variants[0], id: 'revision' }],
    incoming.variants,
    'refine',
    [incoming.variants[0].id],
  )[0]
  incoming.variants.push(revision)
  const appended = reconcileEditorState(before, incoming)
  assert.equal(appended.source, before.source)
  assert.equal(appended.original, before.original)
  assert.notEqual(appended.variants, before.variants)
  for (const [index, variant] of before.variants.entries())
    assert.equal(appended.variants[index], variant)
  assert.equal(appended.variants.at(-1), revision)
  const reordered = reconcileEditorState(before, {
    ...structuredClone(before),
    variants: structuredClone([...before.variants].reverse()),
  })
  for (const [index, variant] of before.variants.entries())
    assert.equal(reordered.variants[before.variants.length - 1 - index], variant)
})

test('changed implementation and metadata fields always reach the UI', () => {
  const before = fixture()
  const variant = before.variants[0]
  assert.ok(variant.lineage && variant.sample && variant.react && variant.constraints)
  const changes: Partial<Variant>[] = [
    { id: 'new-direction' },
    { name: 'Updated name' },
    { hypothesis: 'Updated hypothesis' },
    { changes: ['Updated change'] },
    { html: '<button>Updated preview</button>' },
    { css: 'button { color: navy }' },
    { js: 'document.body.dataset.updated = "true"' },
    { react: { ...variant.react, code: 'export const Action = () => <button>Updated</button>' } },
    { react: { ...variant.react, language: 'jsx' } },
    { react: undefined },
    { constraints: { ...variant.constraints, preserveText: true } },
    { constraints: { ...variant.constraints, preserveBrandColors: true } },
    { constraints: { ...variant.constraints, preserveDimensions: true } },
    { constraints: { ...variant.constraints, elements: 'Primary action' } },
    { constraints: undefined },
    { sample: { ...variant.sample, layout: 'original' } },
    { sample: { ...variant.sample, emphasis: 'original' } },
    { sample: { ...variant.sample, cta: 'original' } },
    { sample: { ...variant.sample, compact: !variant.sample.compact } },
    { sample: undefined },
    { lineage: { ...variant.lineage, action: 'refine' } },
    { lineage: { ...variant.lineage, rootId: 'new-root' } },
    { lineage: { ...variant.lineage, label: 'New label' } },
    { lineage: { ...variant.lineage, revision: 2 } },
    { lineage: { ...variant.lineage, sourceIds: ['source'] } },
    { lineage: undefined },
  ]
  for (const change of changes) {
    const next = structuredClone(before)
    next.variants[0] = { ...next.variants[0], ...change }
    const result = reconcileEditorState(before, next)
    assert.equal(result.variants[0], next.variants[0], JSON.stringify(change))
    assert.equal(result.variants[1], before.variants[1])
  }
  const next = structuredClone(before)
  assert.ok(next.original)
  next.original.html = '<button>Updated reconstruction</button>'
  assert.equal(reconcileEditorState(before, next).original, next.original)
})

test('changes with embedded newlines are compared as separate entries', () => {
  const before = fixture()
  before.variants[0].changes = ['a\nb', 'c']
  const next = structuredClone(before)
  next.variants[0].changes = ['a', 'b\nc']
  const result = reconcileEditorState(before, next)
  assert.equal(result.variants[0], next.variants[0])
  assert.deepEqual(result.variants[0].changes, ['a', 'b\nc'])
})

test('source changes and new sessions never retain a stale snapshot', () => {
  const before = fixture()
  const changes: Partial<SourceContext>[] = [
    { id: 'recaptured' },
    { relativePath: 'src/Updated.tsx' },
    { language: 'javascriptreact' },
    { code: '<button>Updated source</button>' },
    { startLine: 2, endLine: 3 },
    { endLine: 2 },
    { selection: false },
  ]
  for (const change of changes) {
    const next = structuredClone(before)
    assert.ok(next.source)
    next.source = { ...next.source, ...change }
    assert.equal(reconcileEditorState(before, next).source, next.source)
    if (change.id) assert.equal(reconcileEditorState(before, next), next)
  }
  const cleared = { ...initialEditorState }
  assert.equal(reconcileEditorState(before, cleared), cleared)
})

test('full updates keep submitted constraint changes distinct from the previous values', () => {
  const before = fixture()
  const next = {
    ...structuredClone(before),
    constraints: { ...emptyConstraints, preserveText: true },
  }
  assert.equal(reconcileEditorState(before, next).constraints, next.constraints)
})
