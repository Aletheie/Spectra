import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { generateComparison } from './generation'
import { generationMessage, parseProviderResult, type GenerationInput } from './providers'
import { original, demoVariants } from '../src/variants'
import type { GenerationProgress } from '../src/domain/protocol'
import type { Variant } from '../src/domain/types'

const input: GenerationInput = {
  action: 'generate',
  prompt: 'Improve hierarchy',
  intent: 'Improve hierarchy',
  original: null,
  sources: [],
  source: {
    id: 'source',
    relativePath: 'card.html',
    language: 'html',
    code: '<button>Save</button>',
    startLine: 1,
    endLine: 1,
    selection: false,
  },
}
const prepare = async (variant: Variant) => ({ ...variant, css: `${variant.css}\n/* prepared */` })

test('comparison runs two tasks at a time, returns ordered styled results and counts only completed work', async () => {
  const waiting = new Map<string, () => void>()
  const calls: string[] = []
  const progress: GenerationProgress[] = []
  let active = 0
  let peak = 0
  const promise = generateComparison(
    input,
    new AbortController().signal,
    async (task) => {
      const target = task.target!
      calls.push(target)
      peak = Math.max(peak, ++active)
      await new Promise<void>((resolve) => waiting.set(target, resolve))
      active--
      return target === 'original'
        ? { original, variants: [] }
        : { variants: [{ ...demoVariants[0], id: target }] }
    },
    prepare,
    (update) => progress.push(update),
  )
  await setImmediate()
  assert.deepEqual(calls, ['original', 'A'])
  waiting.get('A')!()
  await setImmediate()
  assert.deepEqual(calls, ['original', 'A', 'B'])
  waiting.get('B')!()
  await setImmediate()
  waiting.get('C')!()
  waiting.get('original')!()
  const result = await promise
  assert.equal(peak, 2)
  assert.deepEqual(
    result.variants.map((variant) => variant.id),
    ['A', 'B', 'C'],
  )
  assert.ok(
    [result.original!, ...result.variants].every((variant) =>
      variant.css.endsWith('/* prepared */'),
    ),
  )
  assert.deepEqual(
    progress.map((update) => update.completed),
    [0, 1, 2, 3, 4],
  )
})

test('a failed task aborts its sibling, waits for cleanup and never starts queued work or returns partial results', async () => {
  let calls = 0
  let cleaned = false
  await assert.rejects(
    generateComparison(
      input,
      new AbortController().signal,
      async (_task, signal) => {
        if (++calls === 1) throw new Error('Provider quota reached')
        await new Promise<void>((resolve) =>
          signal.addEventListener(
            'abort',
            () => {
              cleaned = true
              resolve()
            },
            { once: true },
          ),
        )
        return { variants: [demoVariants[0]] }
      },
      prepare,
      () => undefined,
    ),
    /quota/,
  )
  assert.equal(calls, 2)
  assert.equal(cleaned, true)
})

test('cancellation and bad styling retain atomicity; existing baselines are not reconstructed', async () => {
  const targets: GenerationInput['target'][] = []
  const result = await generateComparison(
    { ...input, original },
    new AbortController().signal,
    async (task) => {
      targets.push(task.target)
      return { variants: [demoVariants[0]] }
    },
    prepare,
    () => undefined,
  )
  assert.deepEqual(targets, ['A', 'B', 'C'])
  assert.equal(result.original, undefined)
  await assert.rejects(
    generateComparison(
      input,
      AbortSignal.abort(),
      async () => {
        throw new Error('must not run')
      },
      prepare,
      () => undefined,
    ),
    /abort/i,
  )
  await assert.rejects(
    generateComparison(
      { ...input, original },
      new AbortController().signal,
      async () => ({ variants: [demoVariants[0]] }),
      async () => {
        throw new Error('missing styles')
      },
      () => undefined,
    ),
    /missing styles/,
  )
})

test('shared generation deadline stops running tasks and leaves queued tasks unstarted', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const abort = new AbortController()
  setTimeout(() => abort.abort(), 90000)
  const calls: GenerationInput['target'][] = []
  const promise = generateComparison(
    input,
    abort.signal,
    async (task, signal) => {
      calls.push(task.target)
      await new Promise<void>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }),
      )
      return { variants: [] }
    },
    prepare,
    () => undefined,
  )
  const rejected = assert.rejects(promise, /cancelled/)
  context.mock.timers.tick(90000)
  await rejected
  assert.deepEqual(calls, ['original', 'A'])
})

test('each task has explicit output cardinality, context and a distinct design brief', () => {
  const originalTask = { ...input, target: 'original' as const }
  assert.equal(
    parseProviderResult(JSON.stringify({ original, variants: [] }), originalTask).original?.id,
    'original',
  )
  const briefs = new Set<string>()
  for (const target of ['A', 'B', 'C'] as const) {
    const task = { ...input, target }
    const message = JSON.parse(generationMessage(task))
    assert.equal(message.reconstructOriginal, false)
    assert.deepEqual(message.capturedSource, input.source)
    briefs.add(message.task.brief)
    assert.equal(
      parseProviderResult(JSON.stringify({ variants: [demoVariants[0]] }), task).variants.length,
      1,
    )
    assert.throws(() =>
      parseProviderResult(JSON.stringify({ original, variants: [demoVariants[0]] }), task),
    )
    assert.throws(() => parseProviderResult(JSON.stringify({ variants: demoVariants }), task))
  }
  assert.equal(briefs.size, 3)
})
