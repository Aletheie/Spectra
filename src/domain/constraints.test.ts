import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  constraintsSummary,
  emptyConstraints,
  MAX_CONSTRAINTS_LENGTH,
  validConstraints,
} from './constraints'
import { initialEditorState } from './protocol'
import { validEditorCommand, validEditorState } from './validation'
import { createHandoff } from './handoff'
import { original, demoVariants as previewVariants } from '../variants'
import { applyGeneration, resolveConstraints } from '../../extension/session'
import {
  generationMessage,
  parseProviderResult,
  validateInput,
  type GenerationInput,
} from '../../extension/providers'

const demoVariants = previewVariants.map((variant) => ({
  ...variant,
  react: { language: 'tsx' as const, code: '<button className="p-4">Save</button>' },
}))

const constraints = {
  ...emptyConstraints,
  preserveText: true,
  preserveBrandColors: true,
  elements: 'Keep the main button’s label, style and action.',
}
const source = {
  id: 'capture',
  relativePath: 'src/Button.tsx',
  code: '<button>Save</button>',
  language: 'typescriptreact',
  startLine: 1,
  endLine: 1,
  selection: true,
}
const input: GenerationInput = {
  action: 'generate',
  prompt: 'Change layout',
  intent: 'Change layout',
  constraints,
  source,
  original: null,
  sources: [],
}

test('constraints boundary validates complete booleans, bounded notes and allowlisted fields on all actions', () => {
  assert.equal(validConstraints(constraints), true)
  assert.equal(
    validConstraints({ ...constraints, elements: 'x'.repeat(MAX_CONSTRAINTS_LENGTH) }),
    true,
  )
  const invalid = [
    null,
    {},
    { ...constraints, preserveText: 'true' },
    { ...constraints, elements: 123 },
    { ...constraints, elements: 'x'.repeat(MAX_CONSTRAINTS_LENGTH + 1) },
    { ...constraints, source: '/secret' },
  ]
  for (const value of invalid) {
    assert.equal(validConstraints(value), false)
    assert.equal(validEditorState({ ...initialEditorState, constraints: value }), false)
    for (const command of ['generate', 'refine', 'remix'])
      assert.equal(
        validEditorCommand({
          command,
          provider: 'cursor',
          prompt: 'Layout',
          ...(command === 'generate'
            ? {}
            : { sourceIds: command === 'refine' ? ['a'] : ['a', 'b'] }),
          constraints: value,
        }),
        false,
      )
  }
  for (const command of ['generate', 'refine', 'remix'])
    assert.equal(
      validEditorCommand({
        command,
        provider: 'cursor',
        prompt: 'Layout',
        ...(command === 'generate' ? {} : { sourceIds: command === 'refine' ? ['a'] : ['a', 'b'] }),
        constraints,
      }),
      true,
    )
  assert.match(
    constraintsSummary(constraints),
    /Text · Brand colors · Elements: Keep the main button/,
  )
})

test('all providers receive constraints as structured data; model-supplied constraints are not trusted', () => {
  assert.deepEqual(JSON.parse(generationMessage(input)).designConstraints, constraints)
  assert.deepEqual(
    JSON.parse(generationMessage({ ...input, constraints: undefined })).designConstraints,
    emptyConstraints,
  )
  assert.throws(() =>
    validateInput({ ...input, constraints: { ...constraints, elements: 'x'.repeat(1001) } }),
  )
  const result = parseProviderResult(
    JSON.stringify({
      original,
      variants: demoVariants.map((variant) => ({ ...variant, constraints: emptyConstraints })),
    }),
    input,
  )
  assert.equal(result.variants[0].constraints, undefined)
})

test('constraints persist across revisions, stay attached to earlier versions and appear in exact-version handoff', () => {
  const state = { ...initialEditorState, source }
  const command = {
    command: 'generate' as const,
    provider: 'cursor' as const,
    prompt: 'Change layout',
    constraints,
  }
  const first = applyGeneration(state, command, { original, variants: demoVariants })
  assert.deepEqual(first.constraints, constraints)
  const refine = {
    command: 'refine' as const,
    provider: 'cursor' as const,
    prompt: 'More compact',
    sourceIds: [first.variants[0].id] as [string],
  }
  assert.deepEqual(resolveConstraints(first, refine), constraints)
  const changed = { ...emptyConstraints, preserveDimensions: true, elements: 'Keep the icon.' }
  const next = applyGeneration(
    first,
    { ...refine, constraints: changed },
    { variants: [{ ...demoVariants[0], id: 'new-revision' }] },
  )
  assert.equal(next.original, first.original)
  assert.equal(next.variants[0], first.variants[0])
  assert.deepEqual(next.constraints, changed)
  assert.deepEqual(next.variants[0].constraints, constraints)
  assert.deepEqual(next.variants.at(-1)?.constraints, changed)
  assert.match(
    createHandoff(source, next.intent, next.variants[0]),
    /Text · Brand colors · Elements: Keep the main button/,
  )
  assert.doesNotMatch(createHandoff(source, next.intent, next.variants[0]), /Keep the icon/)
  assert.match(
    createHandoff(source, next.intent, next.variants.at(-1)!),
    /Dimensions · Elements: Keep the icon/,
  )
  assert.throws(() => applyGeneration(next, { ...refine, constraints }, { variants: [] }))
  assert.deepEqual(next.constraints, changed)
  assert.deepEqual(
    resolveConstraints(next, {
      command: 'remix',
      provider: 'openai',
      prompt: 'Combine',
      sourceIds: [next.variants[0].id, next.variants[1].id],
    }),
    changed,
  )
  assert.throws(
    () => resolveConstraints(first, { ...command, provider: 'demo' }),
    /Curated presets/,
  )
  assert.deepEqual(resolveConstraints(first, { ...refine, provider: 'demo' }), emptyConstraints)
})
