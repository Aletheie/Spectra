import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { buildSync } from 'esbuild'
import { replacementSnapshot } from './replacement'
import { demoVariants } from '../src/variants'
import type { createEditorReplacement } from './editor-replacement'

const bundle = buildSync({
  entryPoints: [fileURLToPath(new URL('./editor-replacement.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode', 'typescript'],
  write: false,
}).outputFiles[0].text
const original = `'use client';\nexport const Button = ({ onSave }: { onSave: () => void }) => <button onClick={onSave}>Save</button>;`
const code = original.replace('<button onClick', '<button className="rounded-lg p-4" onClick')
const source = {
  id: 'snapshot',
  relativePath: 'src/Button.tsx',
  language: 'typescriptreact',
  code: original,
  startLine: 1,
  endLine: 2,
  selection: false,
}
const variant = { ...demoVariants[0], react: { language: 'tsx' as const, code } }

const harness = () => {
  let text = original
  let confirmed = true
  let closed = false
  let trusted = true
  let linked = false
  let editSucceeds = true
  let afterReview: () => void = () => undefined
  let afterFocus: () => void = () => undefined
  let edits = 0
  let undos: unknown
  const previews = new Map<string, string>()
  const uri = { fsPath: '/workspace/src/Button.tsx', scheme: 'file' }
  const target = {
    uri,
    canonicalPath: uri.fsPath,
    snapshot: replacementSnapshot(text, 0, text.length),
  }
  const document = {
    uri,
    languageId: 'typescriptreact',
    getText: () => text,
    positionAt: (offset: number) => ({ offset }),
  }
  const vscode = {
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    Range: class {
      start: { offset: number }
      end: { offset: number }
      constructor(start: { offset: number }, end: { offset: number }) {
        this.start = start
        this.end = end
      }
    },
    ViewColumn: { One: 1 },
    workspace: {
      getWorkspaceFolder: () => ({ uri: { scheme: 'file', fsPath: '/workspace' } }),
      asRelativePath: () => source.relativePath,
      openTextDocument: async (value: typeof uri) => {
        assert.equal(value, uri)
        return document
      },
      registerTextDocumentContentProvider: (
        _scheme: string,
        provider: { provideTextDocumentContent: (uri: { toString: () => string }) => string },
      ) => {
        contentProvider = provider
        return { dispose: () => undefined }
      },
    },
    commands: {
      executeCommand: async (
        command: string,
        before: { toString: () => string },
        after: { toString: () => string },
      ) => {
        assert.equal(command, 'vscode.diff')
        previews.set('before', contentProvider?.provideTextDocumentContent(before) ?? '')
        previews.set('after', contentProvider?.provideTextDocumentContent(after) ?? '')
      },
    },
    window: {
      showInformationMessage: async () => {
        afterReview()
        return confirmed ? 'Replace component' : undefined
      },
      showTextDocument: async () => {
        afterFocus()
        return {
          edit: async (
            build: (builder: {
              replace: (
                range: { start: { offset: number }; end: { offset: number } },
                code: string,
              ) => void
            }) => void,
            options: unknown,
          ) => {
            if (!editSucceeds) return false
            undos = options
            build({
              replace: (range, code) => {
                edits++
                text = text.slice(0, range.start.offset) + code + text.slice(range.end.offset)
              },
            })
            return true
          },
        }
      },
    },
  }
  let contentProvider:
    | { provideTextDocumentContent: (uri: { toString: () => string }) => string }
    | undefined
  const nativeRequire = createRequire(import.meta.url)
  const module = { exports: {} as { createEditorReplacement: typeof createEditorReplacement } }
  runInNewContext(bundle, {
    module,
    exports: module.exports,
    Buffer,
    require: (name: string) =>
      name === 'vscode'
        ? vscode
        : name === 'node:fs/promises'
          ? {
              realpath: async (path: string) =>
                linked && path === uri.fsPath ? '/outside/Button.tsx' : path,
            }
          : nativeRequire(name),
  })
  const controller = module.exports.createEditorReplacement(
    () => {
      if (closed) throw new Error('closed')
    },
    () => {
      if (!trusted) throw new Error('untrusted')
    },
  )
  // Only the test's native API stand-ins are cast; webview data is validated in the host.
  const replace = () =>
    controller.replace(source, target as Parameters<typeof controller.replace>[1], variant)
  return {
    replace,
    previews,
    getText: () => text,
    edits: () => edits,
    undos: () => undos,
    cancel: () => {
      confirmed = false
    },
    close: () => {
      closed = true
      controller.dispose()
    },
    untrust: () => {
      trusted = false
    },
    relink: () => {
      linked = true
    },
    failEdit: () => {
      editSucceeds = false
    },
    change: () => {
      text += '\n// unrelated user edit'
    },
    afterReview: (action: () => void) => {
      afterReview = action
    },
    afterFocus: (action: () => void) => {
      afterFocus = action
    },
  }
}

test('native replacement reviews exact documents and performs one undoable unsaved edit', async () => {
  const host = harness()
  assert.match(await host.replace(), /Undo.*Auto Save/)
  assert.equal(host.previews.get('before'), original)
  assert.equal(host.previews.get('after'), code)
  assert.equal(host.getText(), code)
  assert.equal(host.edits(), 1)
  assert.equal(
    JSON.stringify(host.undos()),
    JSON.stringify({ undoStopBefore: true, undoStopAfter: true }),
  )
  assert.match(await host.replace(), /already matches/)
  assert.equal(host.edits(), 1)
})

test('cancellation, changed files, loss of trust, changed links and disposal never overwrite source', async () => {
  const cancelled = harness()
  cancelled.cancel()
  await assert.rejects(cancelled.replace(), /cancelled/)
  assert.equal(cancelled.getText(), original)
  for (const phase of ['before', 'review', 'focus'] as const) {
    const host = harness()
    if (phase === 'before') host.change()
    if (phase === 'review') host.afterReview(host.change)
    if (phase === 'focus') host.afterFocus(host.change)
    await assert.rejects(host.replace(), /source changed/)
    assert.equal(host.edits(), 0)
    assert.ok(host.getText().endsWith('// unrelated user edit'))
  }
  for (const action of ['untrust', 'relink', 'close', 'failEdit'] as const) {
    const host = harness()
    host.afterReview(host[action])
    await assert.rejects(host.replace())
    assert.equal(host.edits(), 0)
  }
})
