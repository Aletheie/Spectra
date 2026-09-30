import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialEditorState, type EditorCommand, type EditorRequest } from '../domain/protocol'
import { CURSOR_GENERATION_TIMEOUT_MS, EDITOR_REQUEST_TIMEOUT_MS } from '../domain/timeouts'

// Exercise the real client boundary without granting tests an editor/file capability.
test('editor bridge sends commands and accepts only host responses, not iframe messages', async (t) => {
  const messages: EditorRequest[] = []
  let transportFails = false
  const target = new EventTarget()
  const parentWindow = {}
  const hostOrigin = 'vscode-webview://spectra-test'
  const fakeWindow = {
    // Cursor deletes window.parent/top/frameElement before loading extension scripts.
    origin: hostOrigin,
    acquireVsCodeApi: () => ({
      postMessage: (message: EditorRequest) => {
        if (transportFails) throw new Error('Transport disposed')
        messages.push(message)
      },
    }),
    addEventListener: target.addEventListener.bind(target),
  }
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true })
  const bridge = await import('./editor')
  assert.equal(bridge.isEditor, true)
  const received: unknown[] = []
  const unsubscribe = bridge.subscribeEditor((state) => received.push(state))
  t.after(() => {
    unsubscribe()
    Reflect.deleteProperty(globalThis, 'window')
  })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const emit = (data: unknown) =>
    target.dispatchEvent(new MessageEvent('message', { data, origin: hostOrigin }))
  const promise = bridge.sendToEditor({
    command: 'refine',
    provider: 'anthropic',
    prompt: 'Simplify',
    sourceIds: ['chosen-revision'],
  })
  assert.equal(messages.length, 1)
  assert.deepEqual(messages[0], {
    type: 'request',
    id: messages[0].id,
    command: 'refine',
    provider: 'anthropic',
    prompt: 'Simplify',
    sourceIds: ['chosen-revision'],
  })
  const forged = new Event('message')
  Object.defineProperties(forged, {
    source: { value: {} },
    origin: { value: 'null' },
    data: { value: { type: 'state', state: { ...initialEditorState, intent: 'forged' } } },
  })
  target.dispatchEvent(forged)
  assert.equal(received.length, 0)
  emit({ type: 'state', state: { variants: [null] } })
  emit({ type: 'state', state: { ...initialEditorState, providers: null } })
  assert.equal(received.length, 0)
  target.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'state', state: initialEditorState },
      origin: hostOrigin,
    }),
  )
  assert.equal(received.length, 1)
  const parentMessage = new Event('message')
  Object.defineProperties(parentMessage, {
    source: { value: parentWindow },
    origin: { value: hostOrigin },
    data: { value: { type: 'state', state: initialEditorState } },
  })
  target.dispatchEvent(parentMessage)
  assert.equal(received.length, 2, 'accept the editor wrapper even without window.parent')
  for (const origin of ['null', 'https://unrelated.example', '']) {
    target.dispatchEvent(
      new MessageEvent('message', {
        origin,
        data: { type: 'state', state: { ...initialEditorState, trusted: true } },
      }),
    )
  }
  assert.equal(received.length, 2, 'opaque preview frames and unrelated origins cannot set trust')
  emit({ type: 'state', state: { ...initialEditorState, trusted: 'false' } })
  assert.equal(received.length, 2)
  emit({ type: 'response', id: 'unknown-request', ok: true })
  for (const invalid of [
    { ok: 'false' },
    { ok: undefined },
    { ok: true, message: {} },
    { ok: false, error: [] },
  ])
    emit({ type: 'response', id: messages[0].id, ...invalid })
  target.dispatchEvent(
    new MessageEvent('message', { data: { type: 'state', state: { variants: [] } } }),
  )
  assert.equal(received.length, 2)
  target.dispatchEvent(
    new MessageEvent('message', { data: { type: 'response', id: messages[0].id, ok: 'true' } }),
  )
  // The malformed response must not settle/consume the request before the valid one.
  target.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'response', id: messages[0].id, ok: true, message: 'Revision ready' },
      origin: hostOrigin,
    }),
  )
  assert.equal(await promise, 'Revision ready')
  const failed = bridge.sendToEditor({ command: 'generate', provider: 'openai', prompt: 'Premium' })
  target.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'response', id: messages[1].id, ok: false, error: 'Provider quota reached' },
      origin: hostOrigin,
    }),
  )
  await assert.rejects(failed, /Provider quota reached/)

  await assert.rejects(
    bridge.sendToEditor({ command: 'generate', provider: 'demo', prompt: ' ' }),
    /Invalid editor command/,
  )
  assert.equal(messages.length, 2, 'invalid commands must not reach the host')

  const clearTimer = t.mock.method(globalThis, 'clearTimeout')
  transportFails = true
  await assert.rejects(bridge.sendToEditor({ command: 'getState' }), /Could not send/)
  assert.equal(clearTimer.mock.callCount(), 1, 'transport failure must clear its request timer')
  transportFails = false

  const recovered = bridge.sendToEditor({ command: 'getState' })
  emit({ type: 'response', id: messages[2].id, ok: true })
  assert.equal(await recovered, undefined)
  emit({ type: 'response', id: messages[2].id, ok: true, message: 'duplicate' })

  const timedOut = bridge.sendToEditor({ command: 'getState' })
  const timeoutAssertion = assert.rejects(timedOut, /editor did not respond/)
  t.mock.timers.tick(180000)
  await timeoutAssertion
  emit({ type: 'response', id: messages[3].id, ok: true, message: 'late' })

  const afterTimeout = bridge.sendToEditor({ command: 'getState' })
  emit({ type: 'response', id: messages[4].id, ok: true, message: 'Recovered' })
  assert.equal(await afterTimeout, 'Recovered')

  // Cursor generate/refine/remix may outlast both former 90s/180s deadlines.
  for (const command of [
    { command: 'generate', provider: 'cursor', prompt: 'Clarify the section' },
    { command: 'refine', provider: 'cursor', prompt: 'Simplify', sourceIds: ['chosen'] },
    { command: 'remix', provider: 'cursor', prompt: 'Combine', sourceIds: ['a', 'b'] },
  ] satisfies EditorCommand[]) {
    const pending = bridge.sendToEditor({ ...command })
    const request = messages.at(-1)!
    const unexpectedTimeout = assert.doesNotReject(pending)
    t.mock.timers.tick(CURSOR_GENERATION_TIMEOUT_MS)
    emit({ type: 'response', id: request.id, ok: true, message: 'Directions ready' })
    assert.equal(await pending, 'Directions ready')
    await unexpectedTimeout
  }

  const stalled = bridge.sendToEditor({ command: 'generate', provider: 'cursor', prompt: 'Try' })
  const stalledId = messages.at(-1)!.id
  const stalledAssertion = assert.rejects(stalled, /editor did not respond/)
  t.mock.timers.tick(CURSOR_GENERATION_TIMEOUT_MS + EDITOR_REQUEST_TIMEOUT_MS)
  await stalledAssertion
  emit({ type: 'response', id: stalledId, ok: true, message: 'late' })

  const cancel = bridge.sendToEditor({ command: 'cancelGeneration' })
  const cancelId = messages.at(-1)!.id
  const cancelAssertion = assert.rejects(cancel, /editor did not respond/)
  t.mock.timers.tick(EDITOR_REQUEST_TIMEOUT_MS)
  await cancelAssertion
  emit({ type: 'response', id: cancelId, ok: true, message: 'late' })

  unsubscribe()
  emit({ type: 'state', state: initialEditorState })
  assert.equal(received.length, 2)
})
