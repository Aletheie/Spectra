import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { buildSync } from 'esbuild'
import { exportDocument } from '../src/domain/document'
import type { EditorCommand, HostMessage } from '../src/domain/protocol'
import { validHostMessage } from '../src/domain/validation'
import { demoVariants, original } from '../src/variants'
import type { GenerationInput } from './providers'
import { emptyConstraints } from '../src/domain/constraints'
const bundle = buildSync({
  entryPoints: [fileURLToPath(new URL('./extension.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode', './providers', './cursor'],
  write: false,
}).outputFiles[0].text

const uri = (path: string) => ({ scheme: 'file', fsPath: path, toString: () => `file://${path}` })
const disposable = () => ({ dispose: () => undefined })

const setup = () => {
  const commands = new Map<string, () => Promise<void>>()
  const messages: HostMessage[] = []
  const errors: string[] = []
  let messageListener: (message: unknown) => void = () => undefined
  const disposeListeners = new Set<() => void>()
  let providerCalls = 0
  let confirmations = 0
  let panels = 0
  let clipboard = ''
  let saved = ''
  let allowSend = false
  let cursorFailure = false
  let cursorSignedIn = false
  let cursorCheckFailure = false
  let cursorResolveFailure = false
  let keychainFailure = false
  let delayedKeyReads: { remaining: number; wait: Promise<void> } | undefined
  let terminalClosed: (terminal: unknown) => void = () => undefined
  const scheduledPolls = new Set<() => void>()
  let deferredCursorStatus: Promise<boolean> | undefined
  const cursorStatusSignals: AbortSignal[] = []
  let focusListener: (event: { focused: boolean }) => void = () => undefined
  let trustListener: () => void = () => undefined
  const cursorCalls: GenerationInput[] = []
  const consentDetails: string[] = []
  let cursorAction = 'Check connection'
  let selectedCursorModel: string | undefined = 'model-a'
  let cursorModelsFailure = false
  let deferredCursorModels: Promise<{ id: string; label: string }[]> | undefined
  const cursorModelSignals: AbortSignal[] = []
  const settings = new Map<string, unknown>()
  const settingsUpdates: { key: string; value: unknown; target: number }[] = []
  const terminals: {
    shellPath: string
    shellArgs: string[]
    cwd: string
    env: Record<string, string | null>
  }[] = []
  const preparedProfiles: string[] = []
  const secrets = new Map<string, string>()
  const document = {
    isClosed: false,
    uri: uri('/workspace/src/Card.tsx'),
    languageId: 'typescriptreact',
    lineCount: 12,
    getText: () => '<article>Unsaved selection</article>',
  }
  const panel = {
    webview: {
      html: '',
      cspSource: 'vscode-webview://test',
      asWebviewUri: (value: ReturnType<typeof uri>) => value,
      postMessage: async (message: HostMessage) => {
        assert.equal(validHostMessage(message), true, 'host must emit only valid state/responses')
        messages.push(message)
        return true
      },
      onDidReceiveMessage: (listener: typeof messageListener) => {
        messageListener = listener
        return disposable()
      },
    },
    onDidDispose: (listener: () => void) => {
      disposeListeners.add(listener)
      return {
        dispose: () => {
          disposeListeners.delete(listener)
        },
      }
    },
    reveal: () => undefined,
    dispose: () => {
      for (const listener of disposeListeners) listener()
      disposeListeners.clear()
    },
  }
  const vscode = {
    Uri: {
      joinPath: (base: ReturnType<typeof uri>, ...parts: string[]) =>
        uri([base.fsPath, ...parts].join('/')),
    },
    ViewColumn: { One: 1, Beside: -2 },
    ProgressLocation: { Notification: 15 },
    ConfigurationTarget: { Global: 1 },
    window: {
      activeTextEditor: {
        document,
        selection: {
          isEmpty: false,
          start: { line: 2, character: 0 },
          end: { line: 4, character: 0 },
        },
      },
      createWebviewPanel: () => {
        panels++
        return panel
      },
      onDidChangeActiveTextEditor: disposable,
      onDidCloseTerminal: (listener: typeof terminalClosed) => {
        terminalClosed = listener
        return disposable()
      },
      onDidChangeWindowState: (listener: typeof focusListener) => {
        focusListener = listener
        return disposable()
      },
      showErrorMessage: async (error: string) => {
        errors.push(error)
      },
      showWarningMessage: async (message: string) =>
        message.startsWith('Save') ? 'Choose save location' : 'Replace exploration',
      showQuickPick: async (
        items: readonly (string | { id?: string })[],
        options?: { title?: string },
      ) =>
        options?.title === 'Spectra · Choose Cursor model'
          ? items.find((item) => typeof item !== 'string' && item.id === selectedCursorModel)
          : cursorAction,
      createTerminal: (options: (typeof terminals)[number]) => {
        const terminal = { ...options, ...disposable(), show: () => undefined }
        terminals.push(terminal)
        return terminal
      },
      showInformationMessage: async (
        _message: string,
        options?: { modal?: boolean; detail?: string },
      ) => {
        if (!options?.modal) return undefined
        confirmations++
        consentDetails.push(options.detail ?? '')
        return allowSend ? 'Send to provider' : undefined
      },
      withProgress: async (
        _options: unknown,
        action: (progress: unknown, token: unknown) => Promise<unknown>,
      ) => action({}, { isCancellationRequested: false, onCancellationRequested: disposable }),
      showSaveDialog: async () => uri('/exports/selected.html'),
    },
    workspace: {
      isTrusted: true,
      asRelativePath: () => 'src/Card.tsx',
      getWorkspaceFolder: () => ({ uri: uri('/workspace') }),
      getConfiguration: () => ({
        get: (key: string) => settings.get(key),
        update: async (key: string, value: unknown, target: number) => {
          settingsUpdates.push({ key, value, target })
          settings.set(key, value)
        },
      }),
      onDidGrantWorkspaceTrust: (listener: typeof trustListener) => {
        trustListener = listener
        return disposable()
      },
      onDidChangeConfiguration: disposable,
      fs: {
        writeFile: async (_destination: unknown, data: Uint8Array) => {
          saved = Buffer.from(data).toString('utf8')
        },
      },
    },
    commands: {
      registerCommand: (name: string, callback: () => Promise<void>) => {
        commands.set(name, callback)
        return disposable()
      },
    },
    env: {
      clipboard: {
        writeText: async (value: string) => {
          clipboard = value
        },
      },
    },
  }
  const context = {
    extensionUri: uri('/extension'),
    globalStorageUri: uri('/extension-storage'),
    subscriptions: [],
    secrets: {
      get: async (name: string) => {
        if (keychainFailure) throw new Error('keychain locked')
        if (delayedKeyReads && delayedKeyReads.remaining-- > 0) await delayedKeyReads.wait
        return secrets.get(name)
      },
      store: async (name: string, value: string) => {
        secrets.set(name, value)
      },
      delete: async (name: string) => {
        secrets.delete(name)
      },
      onDidChange: disposable,
    },
  }
  const nativeRequire = createRequire(import.meta.url)
  const module = { exports: {} as { activate: (value: typeof context) => void } }
  runInNewContext(bundle, {
    module,
    exports: module.exports,
    require: (name: string) => {
      if (name === 'vscode') return vscode
      if (name === 'node:fs/promises') return { realpath: async (path: string) => path }
      if (name === './providers')
        return {
          generateWithProvider: async () => {
            providerCalls++
            throw new Error('Provider unavailable in test')
          },
        }
      if (name === './cursor')
        return {
          prepareCursorProfile: async (path: string) => {
            preparedProfiles.push(path)
          },
          cursorEnvironment: (path: string) => ({ CURSOR_CONFIG_DIR: path }),
          listCursorModels: async (_connection: unknown, signal: AbortSignal) => {
            cursorModelSignals.push(signal)
            if (cursorModelsFailure) throw new Error('Could not load Cursor models.')
            return (
              deferredCursorModels ?? [
                { id: 'auto', label: 'Auto' },
                { id: 'model-a', label: 'Model A' },
              ]
            )
          },
          resolveCursorExecutable: async () => {
            if (cursorResolveFailure) throw new Error('Cursor CLI was not found. Install the CLI.')
            return '/cli/agent'
          },
          checkCursorConnection: async (_connection: unknown, signal: AbortSignal) => {
            cursorStatusSignals.push(signal)
            if (cursorCheckFailure)
              throw new Error(
                'Cursor CLI was not found. Install it or check spectra.cursorCliPath.',
              )
            return deferredCursorStatus ?? cursorSignedIn
          },
          generateWithCursor: async (
            _connection: unknown,
            _model: string,
            input: GenerationInput,
          ) => {
            cursorCalls.push(input)
            if (cursorFailure) throw new Error('Cursor test failure')
            return {
              ...(input.original ? {} : { original }),
              variants: demoVariants
                .slice(0, input.action === 'generate' ? 3 : 1)
                .map((variant, i) => ({ ...variant, id: `cursor-${cursorCalls.length}-${i}` })),
            }
          },
        }
      return nativeRequire(name)
    },
    Buffer,
    Error,
    AbortController,
    setInterval: (callback: () => void) => {
      scheduledPolls.add(callback)
      return { callback, unref: () => undefined }
    },
    clearInterval: (timer?: { callback: () => void }) => {
      if (timer) scheduledPolls.delete(timer.callback)
    },
    crypto: webcrypto,
    process,
  })
  module.exports.activate(context)
  const latestState = () => {
    const state = messages.filter((message) => message.type === 'state').at(-1)
    assert.ok(state?.type === 'state')
    return messages
      .slice(messages.lastIndexOf(state) + 1)
      .reduce(
        (current, message) =>
          message.type === 'status' ? { ...current, ...message.status } : current,
        state.state,
      )
  }
  const request = async (command: EditorCommand) => {
    const id = webcrypto.randomUUID()
    messageListener({ type: 'request', id, ...command })
    for (let attempt = 0; attempt < 50; attempt++) {
      const response = messages.find((message) => message.type === 'response' && message.id === id)
      if (response?.type === 'response') return response
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
    throw new Error(`Host did not respond to ${command.command}`)
  }
  return {
    commands,
    messages,
    errors,
    panel,
    vscode,
    secrets,
    latestState,
    request,
    send: (message: unknown) => messageListener(message),
    allowSend: () => {
      allowSend = true
    },
    providerCalls: () => providerCalls,
    confirmations: () => confirmations,
    panels: () => panels,
    clipboard: () => clipboard,
    saved: () => saved,
    cursorCalls,
    consentDetails,
    failCursor: () => {
      cursorFailure = true
    },
    setCursorAction: (action: string) => {
      cursorAction = action
    },
    terminals,
    preparedProfiles,
    cursorStatusSignals,
    cursorModelSignals,
    settings,
    settingsUpdates,
    selectCursorModel: (id?: string) => {
      selectedCursorModel = id
    },
    failCursorModels: () => {
      cursorModelsFailure = true
    },
    deferCursorModels: (pending: Promise<{ id: string; label: string }[]>) => {
      deferredCursorModels = pending
    },
    delayFirstKeyReads: (wait: Promise<void>) => {
      delayedKeyReads = { remaining: 2, wait }
    },
    failKeychain: () => {
      keychainFailure = true
    },
    failCursorResolve: () => {
      cursorResolveFailure = true
    },
    failCursorCheck: (value: boolean) => {
      cursorCheckFailure = value
    },
    pollLogin: () => {
      for (const poll of scheduledPolls) poll()
    },
    closeLoginTerminal: () => terminalClosed(terminals.at(-1)),
    setCursorSignedIn: (value: boolean) => {
      cursorSignedIn = value
    },
    deferCursorStatus: (value: Promise<boolean>) => {
      deferredCursorStatus = value
    },
    focus: () => focusListener({ focused: true }),
    grantTrust: () => {
      vscode.workspace.isTrusted = true
      trustListener()
    },
  }
}

const flushHost = () => new Promise<void>((resolve) => setImmediate(resolve))

test('existing Cursor login is detected on open without sending source or generating', async () => {
  const host = setup()
  host.setCursorSignedIn(true)
  await host.commands.get('spectra.open')!()
  await flushHost()
  assert.equal(
    host.latestState().providers.find((provider) => provider.id === 'cursor')?.configured,
    true,
  )
  assert.equal(host.latestState().source, null)
  assert.equal(host.latestState().busy, false)
  assert.equal(host.confirmations(), 0)
  assert.equal(host.cursorCalls.length, 0)
})

test('returning from Cursor sign-in refreshes readiness without losing the captured source', async () => {
  const host = setup()
  await host.commands.get('spectra.exploreSelection')!()
  await flushHost()
  const source = host.latestState().source
  host.setCursorAction('Sign in to Cursor')
  assert.equal((await host.request({ command: 'configureProvider', provider: 'cursor' })).ok, true)
  assert.equal(
    host.latestState().providers.find((provider) => provider.id === 'cursor')?.configured,
    false,
  )
  host.setCursorSignedIn(true)
  host.focus()
  await flushHost()
  assert.equal(
    host.latestState().providers.find((provider) => provider.id === 'cursor')?.configured,
    true,
  )
  assert.deepEqual(host.latestState().source, source)
  assert.equal(host.latestState().busy, false)
  assert.equal(host.cursorCalls.length, 0)
  assert.equal(
    (await host.request({ command: 'generate', provider: 'cursor', prompt: 'Simplify' })).ok,
    false,
  )
  assert.equal(host.confirmations(), 1, 'generation still requires native transmission consent')
  assert.equal(host.cursorCalls.length, 0)
})

test('automatic login checks require trust, deduplicate focus events and abort on panel disposal', async () => {
  const host = setup()
  host.vscode.workspace.isTrusted = false
  await host.commands.get('spectra.open')!()
  await flushHost()
  host.focus()
  assert.equal(host.cursorStatusSignals.length, 0)
  let finish: (value: boolean) => void = () => undefined
  host.deferCursorStatus(
    new Promise<boolean>((resolve) => {
      finish = resolve
    }),
  )
  host.grantTrust()
  await flushHost()
  host.focus()
  host.focus()
  assert.equal(host.cursorStatusSignals.length, 1)
  host.panel.dispose()
  const messages = host.messages.length
  assert.equal(host.cursorStatusSignals[0].aborted, true)
  finish(true)
  await flushHost()
  assert.equal(host.messages.length, messages, 'a late login result cannot revive a closed panel')
})

test('sign-out invalidates pending automatic login results and suspends background checks', async () => {
  const host = setup()
  let finish: (value: boolean) => void = () => undefined
  host.deferCursorStatus(
    new Promise<boolean>((resolve) => {
      finish = resolve
    }),
  )
  await host.commands.get('spectra.open')!()
  await flushHost()
  host.setCursorAction('Sign out of Cursor CLI')
  assert.equal((await host.request({ command: 'configureProvider', provider: 'cursor' })).ok, true)
  assert.equal(host.cursorStatusSignals[0].aborted, true)
  finish(true)
  host.focus()
  await flushHost()
  assert.equal(
    host.latestState().providers.find((provider) => provider.id === 'cursor')?.configured,
    false,
  )
  assert.equal(host.cursorStatusSignals.length, 1)
})

test('Cursor login and logout use fixed native CLI commands, not webview credentials or shell strings', async () => {
  const host = setup()
  await host.commands.get('spectra.open')!()
  for (const [action, cliCommand] of [
    ['Sign in to Cursor', 'login'],
    ['Sign out of Cursor CLI', 'logout'],
  ]) {
    host.setCursorAction(action)
    assert.equal(
      (await host.request({ command: 'configureProvider', provider: 'cursor' })).ok,
      true,
    )
    const terminal = host.terminals.at(-1)!
    assert.equal(terminal.shellPath, '/cli/agent')
    assert.deepEqual(Array.from(terminal.shellArgs), [cliCommand])
    assert.notEqual(terminal.cwd, '/workspace')
    assert.equal(terminal.env.CURSOR_CONFIG_DIR, '/extension-storage/cursor-cli')
    assert.equal(host.secrets.size, 0)
    assert.equal(host.cursorCalls.length, 0)
  }
  assert.deepEqual(host.preparedProfiles, Array(2).fill('/extension-storage/cursor-cli'))
})

test('Cursor host flow requires setup and consent, then preserves baseline and exact revision sources', async () => {
  const host = setup()
  await host.commands.get('spectra.exploreSelection')!()
  const generate: EditorCommand = {
    command: 'generate',
    provider: 'cursor',
    prompt: 'Improve hierarchy',
    constraints: { ...emptyConstraints, preserveText: true, elements: 'Keep the main button.' },
  }
  assert.equal((await host.request(generate)).ok, false)
  assert.equal(host.cursorCalls.length, 0)
  host.setCursorSignedIn(true)
  assert.equal((await host.request({ command: 'configureProvider', provider: 'cursor' })).ok, true)
  assert.equal(host.secrets.size, 0)
  assert.equal(host.latestState().providers.find((p) => p.id === 'cursor')?.configured, true)
  assert.equal((await host.request(generate)).ok, false)
  assert.equal(host.cursorCalls.length, 0)
  host.allowSend()
  assert.equal((await host.request(generate)).ok, true)
  const baseline = host.latestState().original
  const variants = host.latestState().variants
  assert.deepEqual({ ...host.cursorCalls[0].constraints }, generate.constraints)
  assert.deepEqual({ ...host.latestState().constraints }, generate.constraints)
  assert.match(
    host.consentDetails.at(-1)!,
    /Design constraints: Text · Elements: Keep the main button/,
  )
  assert.equal(variants.length, 3)
  assert.match(host.consentDetails.at(-1)!, /Cursor account limits, billing/)
  assert.equal(
    (
      await host.request({
        command: 'refine',
        provider: 'cursor',
        prompt: 'Clearer CTA',
        sourceIds: [variants[1].id],
      })
    ).ok,
    true,
  )
  assert.deepEqual(host.cursorCalls[1].sources, [variants[1]])
  assert.deepEqual({ ...host.cursorCalls[1].constraints }, generate.constraints)
  assert.equal(
    (
      await host.request({
        command: 'remix',
        provider: 'cursor',
        prompt: 'Combine hierarchy',
        sourceIds: [variants[2].id, variants[0].id],
      })
    ).ok,
    true,
  )
  assert.deepEqual(host.cursorCalls[2].sources, [variants[2], variants[0]])
  assert.deepEqual({ ...host.cursorCalls[2].constraints }, generate.constraints)
  assert.deepEqual(host.latestState().original, baseline)
  assert.equal(host.latestState().variants.length, 5)
  const previous = host.latestState()
  host.failCursor()
  assert.equal((await host.request(generate)).ok, false)
  assert.deepEqual(host.latestState().variants, previous.variants)
  assert.deepEqual(host.latestState().original, baseline)
  assert.equal(host.latestState().busy, false)
  host.vscode.workspace.isTrusted = false
  assert.equal((await host.request(generate)).ok, false)
  assert.equal((await host.request({ command: 'configureProvider', provider: 'cursor' })).ok, false)
  assert.equal(host.cursorCalls.length, 4)
})

test('extension entry activates all manifest commands and serves a local nonce-protected panel', async () => {
  const host = setup()
  assert.deepEqual([...host.commands.keys()].sort(), [
    'spectra.configureProvider',
    'spectra.exploreSelection',
    'spectra.loadSample',
    'spectra.open',
  ])
  await host.commands.get('spectra.open')!()
  await host.commands.get('spectra.open')!()
  await host.request({ command: 'getState' })
  assert.equal(host.panels(), 1)
  assert.equal(host.latestState().original, null)
  assert.match(host.panel.webview.html, /dist\/webview\/index.js/)
  assert.match(host.panel.webview.html, /data-script-nonce=/)
  assert.match(host.panel.webview.html, /connect-src 'none'/)
  assert.equal(host.errors.length, 0)
})

test('sample generation, exact-source refinement, export and handoff use stored variants', async () => {
  const host = setup()
  await host.commands.get('spectra.loadSample')!()
  assert.equal(
    (await host.request({ command: 'generate', provider: 'demo', prompt: 'Premium' })).ok,
    true,
  )
  const initial = host.latestState()
  assert.equal(initial.variants.length, 3)
  const chosen = initial.variants[1]
  assert.equal(
    (
      await host.request({
        command: 'refine',
        provider: 'demo',
        prompt: 'minimal',
        sourceIds: [chosen.id],
      })
    ).ok,
    true,
  )
  const refined = host.latestState().variants.at(-1)!
  assert.equal(host.latestState().variants.length, 4)
  assert.equal(refined.sample?.layout, chosen.sample?.layout)
  assert.equal(refined.sample?.compact, true)
  assert.notEqual(refined.html, chosen.html)
  assert.deepEqual(host.latestState().variants.slice(0, 3), initial.variants)
  assert.equal(host.latestState().original, initial.original)
  assert.equal((await host.request({ command: 'copyHandoff', variantId: refined.id })).ok, true)
  assert.ok(host.clipboard().includes(refined.html))
  assert.equal((await host.request({ command: 'exportHtml', variantId: refined.id })).ok, true)
  assert.equal(host.saved(), exportDocument(refined))
  assert.equal(host.providerCalls(), 0)
})

test('capture uses unsaved selected source and live cancellation/failure preserve the last canvas', async () => {
  const host = setup()
  await host.commands.get('spectra.exploreSelection')!()
  const captured = host.latestState()
  assert.equal(captured.source?.code, '<article>Unsaved selection</article>')
  assert.equal(captured.source?.startLine, 3)
  assert.equal(captured.source?.endLine, 4)
  assert.equal(captured.source?.selection, true)
  assert.equal(captured.baselineKind, 'none')
  assert.equal(
    (await host.request({ command: 'generate', provider: 'demo', prompt: 'Premium' })).ok,
    false,
  )
  assert.equal(
    (await host.request({ command: 'generate', provider: 'openai', prompt: 'Premium' })).ok,
    false,
  )
  assert.equal(host.confirmations(), 0, 'missing credentials must not start a request')
  host.secrets.set('spectra.openai.apiKey', 'test-secret')
  const cancelled = await host.request({
    command: 'generate',
    provider: 'openai',
    prompt: 'Premium',
  })
  assert.equal(cancelled.ok, false)
  assert.match(cancelled.error!, /cancelled/)
  assert.equal(host.providerCalls(), 0)
  assert.equal(host.latestState().busy, false)
  host.allowSend()
  const failed = await host.request({ command: 'generate', provider: 'openai', prompt: 'Premium' })
  assert.equal(failed.ok, false)
  assert.equal(host.providerCalls(), 1)
  assert.equal(host.latestState().source, captured.source)
  assert.equal(host.latestState().original, null)
  assert.equal(host.latestState().variants.length, 0)
  assert.equal(host.latestState().busy, false)
  assert.ok(!JSON.stringify(host.messages).includes('test-secret'))
})

test('untrusted workspaces permit samples but reject source and exports; forged commands are ignored', async () => {
  const host = setup()
  host.vscode.workspace.isTrusted = false
  await host.commands.get('spectra.loadSample')!()
  const sample = host.latestState()
  assert.equal(sample.trusted, false)
  assert.equal((await host.request({ command: 'captureSource' })).ok, false)
  assert.equal(
    (await host.request({ command: 'generate', provider: 'demo', prompt: 'Premium' })).ok,
    true,
  )
  const variantId = host.latestState().variants[0].id
  assert.equal((await host.request({ command: 'exportHtml', variantId })).ok, false)
  assert.equal((await host.request({ command: 'copyHandoff', variantId })).ok, false)
  const count = host.messages.length
  host.send({ type: 'request', id: 'forged', command: 'captureSource', uri: 'file:///private/key' })
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(host.messages.length, count)
  assert.equal(host.latestState().busy, false)
  host.panel.dispose()
  await host.commands.get('spectra.open')!()
  await host.request({ command: 'getState' })
  assert.equal(host.latestState().original, null, 'closing the panel must discard its session')
})

test('webview HTML never loads a localhost app or grants network/script wildcards', async () => {
  const host = setup()
  await host.commands.get('spectra.open')!()
  const html = host.panel.webview.html
  assert.match(html, /script-src 'nonce-[a-zA-Z0-9+/=]+'/)
  assert.match(html, /<script type="module" nonce="[a-zA-Z0-9+/=]+"/)
  assert.match(html, /frame-src 'self'/)
  assert.match(html, /form-action 'none'/)
  assert.doesNotMatch(html, /localhost|127\.0\.0\.1|unsafe-eval|allow-same-origin/)
})

test('login completed after focus is detected by bounded polling and terminal closure', async () => {
  for (const trigger of ['poll', 'close'] as const) {
    const host = setup()
    await host.commands.get('spectra.exploreSelection')!()
    await flushHost()
    assert.equal(
      (await host.request({ command: 'configureProvider', provider: 'cursor', action: 'login' }))
        .ok,
      true,
    )
    host.focus()
    await flushHost()
    assert.equal(host.latestState().providers[0].configured, false)
    host.setCursorSignedIn(true)
    if (trigger === 'poll') host.pollLogin()
    else host.closeLoginTerminal()
    await flushHost()
    assert.equal(host.latestState().providers[0].configured, true)
    assert.equal(host.cursorCalls.length, 0)
    host.panel.dispose()
    const calls = host.cursorStatusSignals.length
    host.pollLogin()
    assert.equal(host.cursorStatusSignals.length, calls)
  }
})

test('failed automatic checks are visible and direct Check Cursor recovers without a picker', async () => {
  const host = setup()
  host.failCursorCheck(true)
  await host.commands.get('spectra.exploreSelection')!()
  await flushHost()
  assert.equal(host.latestState().providers[0].connection, 'error')
  assert.match(host.latestState().providers[0].detail ?? '', /not found/)
  host.failCursorCheck(false)
  host.setCursorSignedIn(true)
  host.setCursorAction('Sign out of Cursor CLI')
  assert.equal(
    (await host.request({ command: 'configureProvider', provider: 'cursor', action: 'check' })).ok,
    true,
  )
  assert.equal(host.latestState().providers[0].configured, true)
  assert.equal(host.terminals.length, 0)
  assert.equal(host.cursorCalls.length, 0)
})

test('a direct-provider keychain failure does not block captured source or Cursor readiness', async () => {
  const host = setup()
  host.failKeychain()
  host.setCursorSignedIn(true)
  await host.commands.get('spectra.exploreSelection')!()
  await flushHost()
  assert.equal((await host.request({ command: 'getState' })).ok, true)
  assert.equal(host.latestState().providers[0].configured, true)
  assert.match(host.latestState().providers[1].detail ?? '', /keychain/)
  assert.equal(host.latestState().source?.code, '<article>Unsaved selection</article>')
  host.allowSend()
  assert.equal(
    (await host.request({ command: 'generate', provider: 'cursor', prompt: 'Simplify' })).ok,
    true,
  )
})

test('an older slow provider refresh cannot overwrite a newly detected Cursor login', async () => {
  const host = setup()
  let release: () => void = () => undefined
  host.delayFirstKeyReads(
    new Promise<void>((resolve) => {
      release = resolve
    }),
  )
  host.setCursorSignedIn(true)
  await host.commands.get('spectra.open')!()
  await flushHost()
  assert.equal(host.latestState().providers[0].configured, true)
  release()
  await flushHost()
  assert.equal(host.latestState().providers[0].configured, true)
  assert.equal(host.latestState().providers[0].connection, 'ready')
})

test('inline Cursor setup exposes failures that happen before launching the CLI', async () => {
  const host = setup()
  await host.commands.get('spectra.exploreSelection')!()
  await flushHost()
  host.failCursorResolve()
  assert.equal(
    (await host.request({ command: 'configureProvider', provider: 'cursor', action: 'check' })).ok,
    false,
  )
  assert.equal(host.latestState().providers[0].connection, 'error')
  assert.match(host.latestState().providers[0].detail ?? '', /was not found/)
  assert.equal(host.latestState().busy, false)
})

test('List models opens a native model picker without a terminal and saves only the selected global model', async () => {
  const host = setup()
  await host.commands.get('spectra.exploreSelection')!()
  const source = host.latestState().source
  host.setCursorAction('List models')
  const response = await host.request({ command: 'configureProvider', provider: 'cursor' })
  assert.equal(response.ok, true)
  assert.match(response.message ?? '', /model-a/)
  assert.deepEqual(host.settingsUpdates, [{ key: 'cursorModel', value: 'model-a', target: 1 }])
  assert.equal(
    host.latestState().providers.find((provider) => provider.id === 'cursor')?.model,
    'model-a',
  )
  assert.deepEqual(host.latestState().source, source)
  assert.equal(host.latestState().busy, false)
  assert.equal(host.terminals.length, 0)
  assert.equal(host.cursorModelSignals.length, 1)
  assert.equal(host.cursorCalls.length, 0)
  assert.equal(host.secrets.size, 0)
})

test('Cancelling or failing model discovery preserves the current model and canvas and releases controls', async () => {
  const host = setup()
  await host.commands.get('spectra.loadSample')!()
  const original = host.latestState().original
  host.settings.set('cursorModel', 'existing-model')
  host.setCursorAction('List models')
  host.selectCursorModel(undefined)
  const cancelled = await host.request({ command: 'configureProvider', provider: 'cursor' })
  assert.equal(cancelled.cancelled, true)
  assert.equal(host.settings.get('cursorModel'), 'existing-model')
  assert.deepEqual(host.latestState().original, original)
  assert.equal(host.latestState().busy, false)
  host.failCursorModels()
  const failed = await host.request({ command: 'configureProvider', provider: 'cursor' })
  assert.equal(failed.ok, false)
  assert.match(failed.error ?? '', /Could not load Cursor models/)
  assert.equal(host.settingsUpdates.length, 0)
  assert.equal(host.settings.get('cursorModel'), 'existing-model')
  assert.deepEqual(host.latestState().original, original)
  assert.equal(host.latestState().busy, false)
  assert.equal(host.terminals.length, 0)
})

test('Closing the panel during model loading aborts discovery and cannot change settings later', async () => {
  const host = setup()
  await host.commands.get('spectra.open')!()
  let finish: (models: { id: string; label: string }[]) => void = () => undefined
  host.deferCursorModels(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  host.setCursorAction('List models')
  host.send({ type: 'request', id: 'models', command: 'configureProvider', provider: 'cursor' })
  await flushHost()
  assert.equal(host.cursorModelSignals.length, 1)
  host.panel.dispose()
  assert.equal(host.cursorModelSignals[0].aborted, true)
  finish([{ id: 'model-a', label: 'Model A' }])
  await flushHost()
  assert.equal(host.settingsUpdates.length, 0)
})
