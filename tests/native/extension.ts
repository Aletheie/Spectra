import assert from 'node:assert/strict'
import { access, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import * as vscode from 'vscode'

/** Executed by the real editor extension host, never by the browser harness. */
export const run = async () => {
  const directory = process.env.SPECTRA_NATIVE_RUN_DIRECTORY
  assert.ok(directory, 'The native runner must supply its isolated run directory.')
  const checks: string[] = []
  const publish = async (phase: string, error?: string) => {
    const report = {
      phase,
      appName: vscode.env.appName,
      apiVersion: vscode.version,
      checks,
      ...(error ? { error } : {}),
    }
    const path = join(directory, 'host.json')
    await writeFile(`${path}.tmp`, JSON.stringify(report, null, 2))
    await rename(`${path}.tmp`, path)
  }
  const inspect = async (phase: string) => {
    await publish(phase)
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      try {
        await access(join(directory, `${phase}.ack`))
        return
      } catch {
        await delay(100)
      }
    }
    throw new Error(`The rendered ${phase} inspection did not finish within 60 seconds.`)
  }
  const panels = () =>
    vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter((tab) => tab.label === 'Spectra' && tab.input instanceof vscode.TabInputWebview)
  const expectPanel = async () => {
    const deadline = Date.now() + 5000
    while (panels().length !== 1 && Date.now() < deadline) await delay(50)
    assert.equal(panels().length, 1, 'The native workbench publishes one Spectra webview tab.')
  }
  try {
    assert.equal(vscode.workspace.workspaceFolders?.length, 1)
    assert.equal(vscode.workspace.workspaceFolders[0].uri.fsPath, join(directory, 'workspace'))
    assert.equal(vscode.workspace.isTrusted, true, 'Only the temporary fixture is trusted.')
    checks.push('Isolated local fixture workspace is trusted.')

    const extension = vscode.extensions.getExtension('spectra-local.spectra')
    assert.ok(extension, 'The development extension is installed in this test host.')
    await extension.activate()
    assert.equal(extension.isActive, true)
    const commands = await vscode.commands.getCommands(true)
    for (const name of ['open', 'exploreSelection', 'configureProvider', 'loadSample'])
      assert.ok(commands.includes(`spectra.${name}`), `Command spectra.${name} is registered.`)
    checks.push('Extension activates and all four public commands are registered.')

    for (const asset of [
      'dist/extension.cjs',
      'dist/react-validation.cjs',
      'dist/preview-base.css',
      'dist/webview/index.js',
      'dist/webview/index.css',
    ])
      assert.ok(
        (await readFile(join(extension.extensionPath, asset))).length > 0,
        `${asset} exists.`,
      )
    checks.push('Host bundle, deferred parser, preview preset and webview assets are present.')

    await vscode.commands.executeCommand('spectra.open')
    await expectPanel()
    await inspect('empty')
    await vscode.commands.executeCommand('spectra.loadSample')
    await expectPanel()
    await inspect('sample')
    checks.push('Native open and load-sample commands render the same Spectra panel.')
    assert.equal(await vscode.window.tabGroups.close(panels(), true), true)

    const uri = vscode.Uri.file(join(directory, 'workspace', 'Button.tsx'))
    const document = await vscode.workspace.openTextDocument(uri)
    const editor = await vscode.window.showTextDocument(document)
    const saved = await readFile(uri.fsPath, 'utf8')
    assert.ok(
      await editor.edit((edit) =>
        edit.replace(
          new vscode.Range(
            0,
            0,
            document.lineCount - 1,
            document.lineAt(document.lineCount - 1).text.length,
          ),
          saved.replace('Saved fixture', 'Unsaved native fixture'),
        ),
      ),
    )
    const selectedLine = 1
    editor.selection = new vscode.Selection(
      selectedLine,
      0,
      selectedLine,
      document.lineAt(selectedLine).text.length,
    )
    await vscode.commands.executeCommand('spectra.exploreSelection')
    await expectPanel()
    await inspect('capture')
    assert.equal(document.isDirty, true)
    assert.equal(await readFile(uri.fsPath, 'utf8'), saved)
    checks.push(
      'Capture displays the unsaved selected TSX line and leaves the fixture file unchanged.',
    )
    assert.equal(await vscode.window.tabGroups.close(panels(), true), true)
    await vscode.window.showTextDocument(document)
    await vscode.commands.executeCommand('workbench.action.files.revert')
    assert.equal(document.isDirty, false)
    await publish('passed')
  } catch (error) {
    await publish('failed', error instanceof Error ? error.message : String(error))
    throw error
  }
}
