import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exportDocument } from '../domain/document'
import type { EditorCommand, EditorState } from '../domain/protocol'

test('browser harness is explicit sample-only and preserves state on unsupported actions', async (t) => {
  Object.defineProperty(globalThis, 'window', {
    value: { addEventListener: () => {} },
    configurable: true,
  })
  const bridge = await import('./editor')
  assert.equal(bridge.isEditor, false)
  const snapshots: EditorState[] = []
  const unsubscribe = bridge.subscribeEditor((state) => snapshots.push(state))
  t.after(() => {
    unsubscribe()
    Reflect.deleteProperty(globalThis, 'window')
    Reflect.deleteProperty(globalThis, 'document')
  })
  await bridge.sendToEditor({ command: 'getState' })
  assert.equal(snapshots.at(-1)?.source, null)
  assert.equal(snapshots.at(-1)?.original, null)
  await assert.rejects(
    bridge.sendToEditor({ command: 'captureSource' }),
    /extension in your editor/,
  )
  await assert.rejects(
    bridge.sendToEditor({ command: 'generate', provider: 'demo', prompt: 'Generate' }),
    /extension in your editor/,
  )
  await bridge.sendToEditor({ command: 'loadSample' })
  assert.equal(snapshots.at(-1)?.baselineKind, 'sample')
  await bridge.sendToEditor({ command: 'generate', provider: 'demo', prompt: 'Premium' })
  const generated = snapshots.at(-1)!
  assert.equal(generated.variants.length, 3)
  await assert.rejects(
    bridge.sendToEditor({ command: 'generate', provider: 'openai', prompt: 'Premium' }),
    /extension in your editor/,
  )
  assert.equal(snapshots.at(-1), generated)
  await bridge.sendToEditor({
    command: 'refine',
    provider: 'demo',
    prompt: 'Minimal',
    sourceIds: [generated.variants[0].id],
  })
  const refined = snapshots.at(-1)!
  assert.equal(refined.variants.length, 4)
  assert.equal(refined.original, generated.original)
  assert.deepEqual(refined.variants.slice(0, 3), generated.variants)
  await bridge.sendToEditor({
    command: 'remix',
    provider: 'demo',
    prompt: 'combine',
    sourceIds: [generated.variants[2].id, generated.variants[0].id],
  })
  assert.equal(snapshots.at(-1)?.variants.length, 5)
  const remixed = snapshots.at(-1)!.variants[4]
  assert.equal(remixed.sample?.layout, generated.variants[2].sample?.layout)
  assert.equal(remixed.sample?.cta, generated.variants[0].sample?.cta)
  assert.ok(remixed.hypothesis.includes(generated.variants[2].name))
  assert.deepEqual(snapshots.at(-1)!.variants.slice(0, 4), refined.variants)
  await assert.rejects(
    bridge.sendToEditor({
      command: 'refine',
      provider: 'demo',
      prompt: 'Minimal',
      sourceIds: ['stale'],
    }),
    /no longer on the canvas/,
  )
  assert.equal(snapshots.at(-1)?.variants.length, 5)
  await assert.rejects(
    bridge.sendToEditor({ command: 'generate', provider: 'demo', prompt: '   ' }),
    /intent/,
  )
  assert.equal(snapshots.at(-1)?.variants.length, 5)
  const lastValid = snapshots.at(-1)!
  const invalidCommands: unknown[] = [
    { command: 'refine', provider: 'demo', prompt: 'Minimal', sourceIds: [] },
    {
      command: 'remix',
      provider: 'demo',
      prompt: 'Combine',
      sourceIds: [generated.variants[0].id, generated.variants[0].id],
    },
    { command: 'generate', provider: 'demo', prompt: 'x'.repeat(3001) },
    { command: 'generate', provider: 'demo', prompt: 'Replace', sourceIds: ['a'] },
    { command: 'captureSource', uri: 'file:///private/source' },
  ]
  for (const command of invalidCommands) {
    await assert.rejects(bridge.sendToEditor(command as EditorCommand), /Invalid editor command/)
    assert.equal(snapshots.at(-1), lastValid)
  }

  t.mock.timers.enable({ apis: ['setTimeout'] })
  const blobs: Blob[] = []
  const createUrl = t.mock.method(URL, 'createObjectURL', (blob: Blob) => {
    blobs.push(blob)
    return 'blob:sample-export'
  })
  const revokeUrl = t.mock.method(URL, 'revokeObjectURL', () => {})
  const click = t.mock.fn()
  const anchor = { href: '', download: '', click }
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: (tag: string) => {
        assert.equal(tag, 'a')
        return anchor
      },
    },
    configurable: true,
  })
  const selected = lastValid.variants.at(-1)!
  await bridge.sendToEditor({ command: 'exportHtml', variantId: selected.id })
  assert.equal(createUrl.mock.callCount(), 1)
  assert.equal(await blobs[0].text(), exportDocument(selected))
  assert.equal(blobs[0].type, 'text/html')
  assert.equal(anchor.href, 'blob:sample-export')
  assert.equal(anchor.download, 'spectra-sample.html')
  assert.equal(click.mock.callCount(), 1)
  assert.equal(revokeUrl.mock.callCount(), 0)
  t.mock.timers.tick(1000)
  assert.deepEqual(revokeUrl.mock.calls[0].arguments, ['blob:sample-export'])
  await assert.rejects(
    bridge.sendToEditor({ command: 'exportHtml', variantId: 'stale' }),
    /Choose a direction/,
  )
  assert.equal(createUrl.mock.callCount(), 1)
  assert.equal(snapshots.at(-1), lastValid)

  click.mock.mockImplementation(() => {
    throw new Error('Download unavailable')
  })
  await assert.rejects(
    bridge.sendToEditor({ command: 'exportHtml', variantId: selected.id }),
    /Download unavailable/,
  )
  t.mock.timers.tick(1000)
  assert.equal(revokeUrl.mock.callCount(), 2, 'failed downloads must release their object URL')
  assert.equal(snapshots.at(-1), lastValid)

  await bridge.sendToEditor({ command: 'loadSample' })
  assert.equal(snapshots.at(-1)?.variants.length, 0)
  assert.equal(snapshots.at(-1)?.baselineKind, 'sample')
})
