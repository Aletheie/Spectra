import assert from 'node:assert/strict'
import { test } from 'node:test'
import { original, demoVariants as previewVariants } from '../src/variants'
import type { SourceContext } from '../src/domain/protocol'
import {
  generateWithProvider,
  MAX_RESPONSE_BYTES,
  parseProviderResult,
  validateInput,
  type GenerationInput,
} from './providers'

const demoVariants = previewVariants.map((variant) => ({
  ...variant,
  react: {
    language: 'tsx' as const,
    code: 'export const Card = () => <article className="rounded-xl p-4">Card</article>',
  },
}))

const source: SourceContext = {
  id: 'capture',
  relativePath: 'src/Card.tsx',
  language: 'typescriptreact',
  code: '<Card price={30} />',
  startLine: 1,
  endLine: 1,
  selection: false,
}
const input: GenerationInput = {
  action: 'generate',
  intent: 'Clearer',
  prompt: 'Clearer',
  source,
  original: null,
  sources: [],
}
const output = { original, variants: demoVariants }
const signal = () => new AbortController().signal
const openai = (content: unknown, finish = 'stop') =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: finish, message: { content: JSON.stringify(content) } }],
    }),
  )

test('initial generation requires reconstructed baseline and three validated directions with host IDs', () => {
  const result = parseProviderResult(JSON.stringify(output), input)
  assert.equal(result.original?.id, 'original')
  assert.equal(result.variants.length, 3)
  assert.equal(new Set(result.variants.map((item) => item.id)).size, 3)
  assert.notEqual(result.variants[0].id, demoVariants[0].id)
  for (const data of [
    null,
    {},
    { variants: demoVariants },
    { original, variants: [demoVariants[0]] },
    { ...output, variants: demoVariants.map((item) => ({ ...item, changes: [] })) },
    { ...output, original: { ...original, html: ' ' } },
    { ...output, extra: true },
  ]) {
    assert.throws(() => parseProviderResult(JSON.stringify(data), input))
  }
  assert.throws(() => parseProviderResult('```json\n{}\n```', input), /valid JSON/)
})

test('subsequent generation and refinement cannot replace original and require exact counts', () => {
  const subsequent = { ...input, original }
  assert.throws(() => parseProviderResult(JSON.stringify(output), subsequent), /shape/)
  const refine: GenerationInput = { ...subsequent, action: 'refine', sources: [demoVariants[1]] }
  assert.equal(
    parseProviderResult(JSON.stringify({ variants: [demoVariants[2]] }), refine).variants.length,
    1,
  )
  assert.throws(() => parseProviderResult(JSON.stringify({ variants: demoVariants }), refine))
  assert.throws(() => validateInput({ ...refine, sources: [] }))
  assert.throws(() => validateInput({ ...input, sources: [original] }))
  assert.throws(() => validateInput({ ...input, source: null }))
  assert.throws(() => validateInput({ ...input, prompt: 'x'.repeat(3001) }))
  assert.throws(() => validateInput({ ...input, source: { ...source, code: 'x'.repeat(60001) } }))
})

test('OpenAI sends source and intent directly using server-side authorization and rejects redirects', async () => {
  let called = false
  const request: typeof fetch = async (url, options) => {
    called = true
    assert.equal(url, 'https://api.openai.com/v1/chat/completions')
    assert.equal(options?.redirect, 'error')
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer test-key')
    assert.ok(options?.signal)
    const body = JSON.parse(String(options?.body))
    assert.deepEqual(body.response_format, { type: 'json_object' })
    assert.equal(body.model, 'gpt-4.1')
    const user = JSON.parse(body.messages[1].content)
    assert.deepEqual(user.capturedSource, source)
    assert.equal(user.reconstructOriginal, true)
    assert.deepEqual(user.sourceVariants, [])
    assert.equal(user.instruction, input.prompt)
    assert.ok(!String(options?.body).includes('test-key'))
    return openai(output)
  }
  assert.equal(
    (await generateWithProvider('openai', 'gpt-4.1', 'test-key', input, signal(), request)).variants
      .length,
    3,
  )
  assert.equal(called, true)
})

test('Anthropic sends exact selected implementations in order with Messages API headers', async () => {
  const remix: GenerationInput = {
    ...input,
    original,
    action: 'remix',
    sources: [demoVariants[2], demoVariants[0]],
  }
  const request: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages')
    assert.equal(new Headers(options?.headers).get('x-api-key'), 'test-key')
    assert.equal(new Headers(options?.headers).get('anthropic-version'), '2023-06-01')
    assert.equal(new Headers(options?.headers).get('authorization'), null)
    const body = JSON.parse(String(options?.body))
    const user = JSON.parse(body.messages[0].content)
    assert.equal(user.reconstructOriginal, false)
    assert.deepEqual(user.sourceVariants, remix.sources)
    assert.deepEqual(user.original, original)
    return new Response(
      JSON.stringify({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify({ variants: [demoVariants[1]] }) }],
      }),
    )
  }
  assert.equal(
    (
      await generateWithProvider(
        'anthropic',
        'claude-sonnet-4-20250514',
        'test-key',
        remix,
        signal(),
        request,
      )
    ).variants.length,
    1,
  )
})

test('provider errors, truncation and oversized responses fail without exposing provider bodies', async () => {
  const call = (request: typeof fetch) =>
    generateWithProvider('openai', 'gpt-4.1', 'test-key', input, signal(), request)
  for (const [status, pattern] of [
    [401, /authorization/],
    [403, /authorization/],
    [429, /quota/],
    [404, /model/],
    [500, /unavailable/],
  ] as const) {
    await assert.rejects(
      call(async () => new Response('secret-provider-error', { status })),
      (error) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, pattern)
        assert.doesNotMatch(error.message, /secret-provider-error|test-key/)
        return true
      },
    )
  }
  await assert.rejects(
    call(async () => openai(output, 'length')),
    /truncated/,
  )
  await assert.rejects(
    call(async () => new Response('not json')),
    /unreadable/,
  )
  await assert.rejects(
    call(
      async () =>
        new Response('{}', { headers: { 'content-length': String(MAX_RESPONSE_BYTES + 1) } }),
    ),
    /too large/,
  )
  await assert.rejects(
    call(async () => new Response('x'.repeat(MAX_RESPONSE_BYTES + 1))),
    /too large/,
  )
  await assert.rejects(
    call(async () => {
      throw new Error('network internals: test-key')
    }),
    /Could not reach/,
  )
  await assert.rejects(
    generateWithProvider('openai', 'bad model', 'test-key', input, signal(), async () => {
      throw new Error('must not run')
    }),
    /valid model/,
  )
})

test('cancellation aborts requests and never retries or returns demo results', async () => {
  const controller = new AbortController()
  controller.abort()
  let requests = 0
  const request: typeof fetch = async () => {
    requests++
    return openai(output)
  }
  await assert.rejects(
    generateWithProvider('openai', 'gpt-4.1', 'test-key', input, controller.signal, request),
    /cancelled/,
  )
  assert.equal(requests, 0)
  const running = new AbortController()
  await assert.rejects(
    generateWithProvider(
      'openai',
      'gpt-4.1',
      'test-key',
      input,
      running.signal,
      async (_url, options) => {
        running.abort()
        assert.equal(options?.signal?.aborted, true)
        throw new Error('aborted')
      },
    ),
    /cancelled/,
  )
})

test('React targets require exact-language project code on every revision and never synthesize it from preview HTML', () => {
  const reactOutput = { original, variants: demoVariants }
  assert.equal(
    parseProviderResult(JSON.stringify(reactOutput), input).variants[0].react?.code,
    demoVariants[0].react.code,
  )
  const missing = demoVariants.map(({ react: _react, ...variant }) => variant)
  for (const variants of [
    missing,
    demoVariants.map((variant) => ({ ...variant, react: { ...variant.react, language: 'jsx' } })),
    demoVariants.map((variant) => ({ ...variant, react: { ...variant.react, code: '' } })),
  ]) {
    assert.throws(() => parseProviderResult(JSON.stringify({ original, variants }), input))
  }
  const htmlInput = {
    ...input,
    source: { ...source, relativePath: 'src/card.html', language: 'html' },
  }
  assert.equal(
    parseProviderResult(JSON.stringify({ original, variants: missing }), htmlInput).variants[0]
      .react,
    undefined,
  )
  assert.throws(() => parseProviderResult(JSON.stringify(reactOutput), htmlInput), /project code/)
  const jsxInput = {
    ...input,
    source: { ...source, relativePath: 'src/Card.jsx', language: 'javascriptreact' },
  }
  const jsxOutput = {
    original,
    variants: demoVariants.map((variant) => ({
      ...variant,
      react: { language: 'jsx', code: 'export const Card = () => <article className="p-4" />' },
    })),
  }
  assert.equal(
    parseProviderResult(JSON.stringify(jsxOutput), jsxInput).variants[0].react?.language,
    'jsx',
  )
})
