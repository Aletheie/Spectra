import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHandoff } from '../src/domain/handoff'
import { initialEditorState, type EditorState, type SourceContext } from '../src/domain/protocol'
import { original, demoVariants as previewVariants } from '../src/variants'
import { applyGeneration, resolveSources, type GenerationCommand } from './session'
import { isWithin, validateSource } from './source'

const demoVariants = previewVariants.map((variant) => ({
  ...variant,
  react: {
    language: 'tsx' as const,
    code: 'export const Card = () => <article className="rounded-xl p-4">Card</article>',
  },
}))

const source: SourceContext = {
  id: 'snapshot',
  relativePath: 'src/Card.tsx',
  language: 'typescriptreact',
  code: '<Card>```</Card>',
  startLine: 3,
  endLine: 7,
  selection: true,
}
const state: EditorState = { ...initialEditorState, source }
const generate: GenerationCommand = { command: 'generate', provider: 'openai', prompt: 'Clearer' }

test('session commits reconstruction atomically then keeps original and exact revision sources', () => {
  const ready = applyGeneration(state, generate, { original, variants: demoVariants })
  assert.equal(state.original, null)
  assert.equal(state.variants.length, 0)
  assert.equal(ready.baselineKind, 'reconstructed')
  assert.equal(ready.intent, 'Clearer')
  const command: GenerationCommand = {
    command: 'refine',
    provider: 'openai',
    prompt: 'minimal',
    sourceIds: [ready.variants[1].id],
  }
  assert.equal(resolveSources(ready, command)[0], ready.variants[1])
  const revised = { ...ready.variants[1], id: 'revised' }
  const next = applyGeneration(ready, command, { variants: [revised] })
  assert.equal(next.original, original)
  assert.equal(next.intent, ready.intent)
  assert.equal(next.variants.length, 4)
  assert.equal(next.variants.at(-1)?.id, revised.id)
  assert.equal(next.variants.at(-1)?.html, revised.html)
  assert.equal(next.variants.at(-1)?.css, revised.css)
  assert.equal(next.variants.at(-1)?.js, revised.js)
  assert.deepEqual(next.variants.at(-1)?.constraints, ready.constraints)
  assert.equal(ready.variants.length, 3)
  assert.throws(() => applyGeneration(ready, command, { variants: [ready.variants[1]] }))
  assert.throws(() => applyGeneration(ready, generate, { original, variants: demoVariants }))
  assert.throws(() => applyGeneration(state, generate, { variants: demoVariants }))
  assert.throws(() => resolveSources(ready, { ...command, sourceIds: ['stale-id'] }))
  const full = {
    ...ready,
    variants: Array.from({ length: 15 }, (_, index) => ({ ...revised, id: String(index) })),
  }
  assert.throws(() => resolveSources(full, { ...command, sourceIds: ['0'] }), /15 directions/)
  const fresh = applyGeneration(full, generate, { variants: demoVariants })
  assert.equal(fresh.variants.length, 3)
  assert.equal(fresh.original, original)
})

test('source guard rejects hidden/sensitive/generated/outside files and unsupported or oversized buffers', () => {
  for (const file of [
    'src/Component.tsx',
    'src/Card.vue',
    'src/Card.svelte',
    'src/card.html',
    'src/card.css',
  ])
    validateSource(file, 'typescriptreact', 'source')
  for (const file of [
    '.env.ts',
    '.private/card.tsx',
    'src/secrets.ts',
    'node_modules/card.tsx',
    'dist/index.js',
    'src/data.json',
    'src/.hidden.tsx',
  ]) {
    assert.throws(() => validateSource(file, 'typescriptreact', 'source'))
  }
  assert.throws(() => validateSource('src/card.tsx', 'json', 'source'))
  assert.throws(() => validateSource('src/card.tsx', 'typescriptreact', '  '))
  assert.throws(() => validateSource('src/card.tsx', 'typescriptreact', 'x'.repeat(60001)))
  assert.equal(isWithin('/workspace', '/workspace/src/card.tsx'), true)
  assert.equal(isWithin('/workspace', '/workspace-other/card.tsx'), false)
  assert.equal(isWithin('/workspace', '/etc/secret.ts'), false)
  assert.equal(isWithin('/workspace', '/workspace'), false)
})

test('handoff contains exact snapshot and selected implementation with safe markdown fences and honest warnings', () => {
  const handoff = createHandoff(source, 'Clearer', demoVariants[1])
  assert.ok(handoff.includes(source.code))
  assert.ok(handoff.includes(demoVariants[1].html))
  assert.ok(handoff.includes(demoVariants[1].css))
  assert.match(handoff, /lines 3–7/)
  assert.match(handoff, /````typescriptreact/)
  assert.match(handoff, /React \+ Tailwind/)
  assert.match(handoff, /does not apply any edits/)
  assert.match(handoff, /omits the preview CSP/)
  assert.match(createHandoff(null, 'Sample', demoVariants[0]), /curated Orbit sample/)
})
