import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generationMessage, type GenerationInput } from './providers'
import { original, demoVariants } from '../src/variants'

test('provider context adds a bounded advisory role without changing snapshot, explicit intent or exact revision sources', () => {
  const source = {
    id: 'capture',
    relativePath: 'src/Contact.tsx',
    language: 'typescriptreact',
    code: '<form><input required /><button>Save</button></form>',
    startLine: 3,
    endLine: 3,
    selection: true,
  }
  for (const action of ['generate', 'refine', 'remix'] as const) {
    const input: GenerationInput = {
      action,
      source,
      original: action === 'generate' ? null : original,
      sources:
        action === 'generate'
          ? []
          : action === 'refine'
            ? [demoVariants[1]]
            : [demoVariants[2], demoVariants[0]],
      intent: 'Keep the form on a dark surface',
      prompt: 'Keep transparency. Focus on validation feedback.',
    }
    const before = structuredClone(input)
    const message = JSON.parse(generationMessage(input))
    assert.equal(message.componentContext.kind, 'form')
    assert.equal(message.componentContext.inferred, true)
    assert.match(message.componentContext.guidance, /local validation/)
    assert.deepEqual(message.capturedSource, source)
    assert.deepEqual(message.sourceVariants, input.sources)
    assert.deepEqual(message.original, input.original)
    assert.equal(message.instruction, input.prompt)
    assert.equal(message.intent, input.intent)
    assert.equal(message.reconstructOriginal, action === 'generate')
    assert.deepEqual(input, before)
  }
})
