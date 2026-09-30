import * as vscode from 'vscode'
import { randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import type { SourceContext } from '../src/domain/protocol'
import type { Variant } from '../src/domain/types'
import { reactLanguageFor, validReactImplementation } from '../src/domain/react'
import { OperationCancelled } from '../src/domain/errors'
import { isWithin, validateSource } from './source'
import { prepareReplacement, type ReplacementSnapshot } from './replacement'

export type ReplacementTarget = {
  uri: vscode.Uri
  canonicalPath: string
  snapshot: ReplacementSnapshot
}

export const createEditorReplacement = (ensureOpen: () => void, trust: () => void) => {
  const previews = new Map<string, string>()
  let provider: vscode.Disposable | undefined
  const dispose = () => {
    provider?.dispose()
    previews.clear()
  }
  const replace = async (source: SourceContext, target: ReplacementTarget, variant: Variant) => {
    trust()
    ensureOpen()
    const implementation = variant.react
    if (
      !validReactImplementation(implementation) ||
      implementation.language !== reactLanguageFor(source)
    )
      throw new Error(
        'This direction has no matching React replacement. Capture a TSX or JSX component and generate again.',
      )
    const readCurrent = async () => {
      trust()
      ensureOpen()
      const folder = vscode.workspace.getWorkspaceFolder(target.uri)
      if (!folder || folder.uri.scheme !== 'file')
        throw new Error('The captured workspace is no longer open. Capture the component again.')
      const [root, file] = await Promise.all([
        realpath(folder.uri.fsPath),
        realpath(target.uri.fsPath),
      ])
      if (file !== target.canonicalPath || !isWithin(root, file))
        throw new Error(
          'The source file moved or its link changed. Capture it again before replacing.',
        )
      const document = await vscode.workspace.openTextDocument(target.uri)
      ensureOpen()
      trust()
      validateSource(
        vscode.workspace.asRelativePath(target.uri, true),
        document.languageId,
        source.code,
      )
      return document
    }
    const document = await readCurrent()
    const prepared = prepareReplacement(document.getText(), target.snapshot, implementation)
    if (prepared.document === document.getText())
      return 'This React direction already matches the editor. No changes made.'
    provider ??= vscode.workspace.registerTextDocumentContentProvider('spectra-change', {
      provideTextDocumentContent: (uri) => previews.get(uri.toString()) ?? '',
    })
    previews.clear()
    const reviewId = randomUUID()
    const before = vscode.Uri.parse(`spectra-change:/${reviewId}/before.${implementation.language}`)
    const after = vscode.Uri.parse(`spectra-change:/${reviewId}/after.${implementation.language}`)
    previews.set(before.toString(), document.getText())
    previews.set(after.toString(), prepared.document)
    await vscode.commands.executeCommand(
      'vscode.diff',
      before,
      after,
      `Spectra · ${source.relativePath} · ${variant.name}`,
      { preview: true },
    )
    ensureOpen()
    const answer = await vscode.window.showInformationMessage(
      `Review the React + Tailwind diff for ${source.relativePath}. Replace the captured ${source.selection ? 'selection' : 'file'}? This supports Undo and follows your editor's Auto Save setting.`,
      'Replace component',
    )
    ensureOpen()
    if (answer !== 'Replace component')
      throw new OperationCancelled('Replacement cancelled. Your source is unchanged.')
    const current = await readCurrent()
    // Focus can yield to another editor action. Check again immediately before the versioned edit.
    const editor = await vscode.window.showTextDocument(current, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
    })
    ensureOpen()
    trust()
    const checked = prepareReplacement(current.getText(), target.snapshot, implementation)
    const range = new vscode.Range(
      current.positionAt(target.snapshot.startOffset),
      current.positionAt(target.snapshot.endOffset),
    )
    const applied = await editor.edit((edit) => edit.replace(range, checked.code), {
      undoStopBefore: true,
      undoStopAfter: true,
    })
    if (!applied)
      throw new Error(
        'The document changed while applying the edit. Your replacement was not applied; capture it again.',
      )
    target.snapshot = checked.snapshot
    return `React component replaced in ${source.relativePath}. Use Undo to revert; your editor's Auto Save setting still applies. Verify it with your project’s typecheck and Tailwind setup.`
  }
  return { replace, dispose }
}
