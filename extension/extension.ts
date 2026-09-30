import { constraintsSummary, emptyConstraints } from '../src/domain/constraints'
import * as vscode from 'vscode'
import { randomBytes, randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { demoResult } from '../src/domain/demo'
import { exportDocument } from '../src/domain/document'
import { createHandoff } from '../src/domain/handoff'
import { OperationCancelled } from '../src/domain/errors'
import {
  initialEditorState,
  samplePrompt,
  type EditorCommand,
  type EditorState,
  type HostMessage,
  type LiveProvider,
  type ProviderInfo,
} from '../src/domain/protocol'
import { suggestedComponentPrompt } from '../src/domain/component'
import { parseGeneratedVariants, validEditorRequest } from '../src/domain/validation'
import { original as sampleOriginal } from '../src/variants'
import { generateWithProvider, type GenerationResult } from './providers'
import {
  applyGeneration,
  resolveConstraints,
  resolveSources,
  type GenerationCommand,
} from './session'
import { isWithin, validateSource } from './source'
import { createWebviewHtml } from './webview'
import {
  checkCursorConnection,
  cursorEnvironment,
  generateWithCursor,
  prepareCursorProfile,
  resolveCursorExecutable,
} from './cursor'

const defaults = { cursor: 'auto', openai: 'gpt-4.1', anthropic: 'claude-sonnet-4-20250514' }
const labels = { cursor: 'Cursor account', openai: 'OpenAI', anthropic: 'Anthropic / Claude' }
const providers = ['cursor', 'openai', 'anthropic'] as const
const secretName = (provider: LiveProvider) => `spectra.${provider}.apiKey`
const modelFor = (provider: LiveProvider) => {
  const value: unknown = vscode.workspace.getConfiguration('spectra').get(`${provider}Model`)
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 200
    ? value.trim()
    : defaults[provider]
}
const trust = () => {
  if (!vscode.workspace.isTrusted)
    throw new Error(
      'Trust this workspace in Cursor before accessing source, configuring keys, using AI or exporting.',
    )
}
const webviewHtml = (webview: vscode.Webview, root: vscode.Uri) =>
  createWebviewHtml(
    webview.asWebviewUri(vscode.Uri.joinPath(root, 'index.js')).toString(),
    webview.asWebviewUri(vscode.Uri.joinPath(root, 'index.css')).toString(),
    webview.cspSource,
    randomBytes(24).toString('base64'),
  )

const createPanel = (
  context: vscode.ExtensionContext,
  getEditor: () => vscode.TextEditor | undefined,
) => {
  const assets = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')
  const panel = vscode.window.createWebviewPanel(
    'spectra.canvas',
    'Spectra',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      enableCommandUris: false,
      retainContextWhenHidden: true,
      localResourceRoots: [assets],
    },
  )
  panel.iconPath = {
    light: vscode.Uri.joinPath(context.extensionUri, 'media', 'spectra-light.svg'),
    dark: vscode.Uri.joinPath(context.extensionUri, 'media', 'spectra-dark.svg'),
  }
  let state: EditorState = { ...initialEditorState, trusted: vscode.workspace.isTrusted }
  let sourceUri: vscode.Uri | undefined
  let disposed = false
  let controller: AbortController | undefined
  let cursorReady = false
  let cursorConnectionState: ProviderInfo['connection'] = 'signed-out'
  let cursorDetail = 'Check Cursor CLI login or sign in.'
  let loginPoll: ReturnType<typeof setInterval> | undefined
  const loginTerminals = new Set<vscode.Terminal>()
  let providerRefresh = 0
  let cursorStatusController: AbortController | undefined
  let cursorAutoCheck = true
  let cursorCheckAfterBusy = false
  const cursorConnection = async () => ({
    executable: await resolveCursorExecutable(
      vscode.workspace.getConfiguration('spectra').get<string>('cursorCliPath', ''),
    ),
    configDir: join(context.globalStorageUri.fsPath, 'cursor-cli'),
  })
  const subscriptions: vscode.Disposable[] = []
  const ensureOpen = () => {
    if (disposed) throw new Error('Spectra was closed. Reopen the comparison canvas.')
  }
  const post = (message: HostMessage) => {
    if (!disposed) void panel.webview.postMessage(message)
  }
  let published: EditorState | undefined
  const publish = (force = false) => {
    const unchanged =
      published &&
      published.source === state.source &&
      published.original === state.original &&
      published.variants === state.variants &&
      published.intent === state.intent &&
      published.constraints === state.constraints &&
      published.baselineKind === state.baselineKind
    if (unchanged && !force) {
      const { providers: info, busy, activity, trusted } = state
      post({ type: 'status', status: { providers: info, busy, activity, trusted } })
    } else post({ type: 'state', state })
    published = state
  }
  const running = () => {
    if (state.activity) state = { ...state, activity: { ...state.activity, phase: 'running' } }
    publish()
  }
  const refreshProviders = async () => {
    const refresh = ++providerRefresh
    const keys = await Promise.all(
      (['openai', 'anthropic'] as const).map(async (id) => {
        try {
          return { id, configured: Boolean(await context.secrets.get(secretName(id))) }
        } catch {
          return {
            id,
            configured: false,
            detail:
              'Could not read the saved key. Unlock your system keychain and check this provider again.',
          }
        }
      }),
    )
    if (disposed || refresh !== providerRefresh) return
    // Read current Cursor readiness after asynchronous key reads, never a stale snapshot.
    const info: ProviderInfo[] = [
      {
        id: 'cursor',
        label: labels.cursor,
        model: modelFor('cursor'),
        configured: cursorReady,
        connection: cursorConnectionState,
        detail: cursorDetail,
      },
      ...keys.map((key) => ({ ...key, label: labels[key.id], model: modelFor(key.id) })),
    ]
    state = { ...state, providers: info, trusted: vscode.workspace.isTrusted }
    publish()
  }
  const guardedRefresh = () => {
    void refreshProviders().catch(() => {
      if (!disposed)
        void vscode.window.showErrorMessage(
          'Spectra could not read provider status from SecretStorage. Unlock your system keychain and try again.',
        )
    })
  }
  const resetCursorStatus = () => {
    cursorStatusController?.abort()
    cursorStatusController = undefined
    cursorReady = false
    cursorConnectionState = 'signed-out'
    cursorDetail = 'Check Cursor CLI login or sign in.'
    clearInterval(loginPoll)
    loginPoll = undefined
  }
  const detectCursorLogin = async () => {
    if (
      disposed ||
      !vscode.workspace.isTrusted ||
      cursorReady ||
      !cursorAutoCheck ||
      cursorStatusController
    )
      return
    if (state.busy) {
      cursorCheckAfterBusy = true
      return
    }
    cursorCheckAfterBusy = false
    const abort = new AbortController()
    cursorStatusController = abort
    cursorConnectionState = 'checking'
    cursorDetail = 'Checking Cursor CLI login…'
    try {
      await refreshProviders()
      const connection = await cursorConnection()
      if (disposed || abort.signal.aborted) return
      const connected = await checkCursorConnection(connection, abort.signal)
      if (disposed || abort.signal.aborted || !vscode.workspace.isTrusted) return
      cursorReady = connected
      cursorConnectionState = connected ? 'ready' : 'signed-out'
      cursorDetail = connected
        ? 'CLI login detected · Model access is checked when generating.'
        : 'Cursor CLI is signed out. Sign in to enable generation.'
      if (connected) {
        clearInterval(loginPoll)
        loginPoll = undefined
      }
      await refreshProviders()
    } catch (error) {
      if (!disposed && !abort.signal.aborted) {
        cursorConnectionState = 'error'
        cursorDetail =
          error instanceof Error
            ? error.message.slice(0, 1200)
            : 'Could not check Cursor CLI. Try Check Cursor again.'
        await refreshProviders()
      }
    } finally {
      if (cursorStatusController === abort) cursorStatusController = undefined
    }
  }
  const confirmReset = async () => {
    if (!state.source && !state.original) return
    const answer = await vscode.window.showWarningMessage(
      'Replace the current Spectra exploration?',
      {
        modal: true,
        detail:
          'The captured snapshot and directions are stored only in this panel. Copy or save anything you need before replacing them.',
      },
      'Replace exploration',
    )
    ensureOpen()
    if (answer !== 'Replace exploration')
      throw new OperationCancelled('Replacement cancelled. Your canvas is unchanged.')
  }

  const capture = async () => {
    trust()
    const editor = getEditor()
    if (!editor || editor.document.isClosed || editor.document.uri.scheme !== 'file') {
      throw new Error(
        'Open a component file in this workspace, select the source if needed, then run Spectra: Explore Component.',
      )
    }
    const document = editor.document
    const folder = vscode.workspace.getWorkspaceFolder(document.uri)
    if (!folder || folder.uri.scheme !== 'file')
      throw new Error('The component must be a local file inside an open workspace folder.')
    // Read the editor buffer now, including unsaved edits. Never crawl imports or read an arbitrary webview path.
    const selection = !editor.selection.isEmpty
    const range = selection
      ? editor.selection
      : new vscode.Range(
          0,
          0,
          document.lineCount - 1,
          document.lineAt(document.lineCount - 1).text.length,
        )
    const code = document.getText(range)
    const relativePath = vscode.workspace.asRelativePath(document.uri, true)
    validateSource(relativePath, document.languageId, code)
    let rootPath: string
    let filePath: string
    try {
      ;[rootPath, filePath] = await Promise.all([
        realpath(folder.uri.fsPath),
        realpath(document.uri.fsPath),
      ])
    } catch {
      throw new Error(
        'The component file is unavailable on disk. Save it inside the workspace and try again.',
      )
    }
    if (!isWithin(rootPath, filePath))
      throw new Error('Source files linked outside the workspace cannot be captured.')
    await confirmReset()
    ensureOpen()
    trust()
    sourceUri = document.uri
    state = {
      ...state,
      source: {
        id: randomUUID(),
        relativePath,
        language: document.languageId,
        code,
        startLine: range.start.line + 1,
        endLine: Math.max(
          range.start.line + 1,
          range.end.line + (range.end.character === 0 && selection ? 0 : 1),
        ),
        selection,
      },
      original: null,
      variants: [],
      baselineKind: 'none',
      constraints: { ...emptyConstraints },
      intent: suggestedComponentPrompt({ code, language: document.languageId }),
    }
    return 'Source snapshot captured. Review it before sending to a provider; imports and dependencies are not collected.'
  }

  const configure = async (specified?: LiveProvider, requestedAction?: 'check' | 'login') => {
    trust()
    const provider =
      specified ??
      (
        await vscode.window.showQuickPick(
          providers.map((id) => ({ label: labels[id], id })),
          {
            title: 'Spectra · Configure AI provider',
            placeHolder: 'Connect your Cursor account or configure a direct provider API key.',
          },
        )
      )?.id
    ensureOpen()
    if (!provider) return 'Provider configuration cancelled.'
    if (provider === 'cursor') {
      cursorStatusController?.abort()
      cursorStatusController = undefined
      cursorCheckAfterBusy = false
      if (!cursorReady) {
        cursorConnectionState = 'signed-out'
        cursorDetail = 'Check Cursor CLI login or sign in.'
        await refreshProviders()
      }
      const action =
        requestedAction === 'check'
          ? 'Check connection'
          : requestedAction === 'login'
            ? 'Sign in to Cursor'
            : await vscode.window.showQuickPick(
                [
                  'Check connection',
                  'Sign in to Cursor',
                  'List models',
                  'Sign out of Cursor CLI',
                  'Installation instructions',
                ],
                {
                  title: 'Spectra · Cursor account',
                  placeHolder:
                    'Uses Cursor CLI login with separate Spectra configuration. Sign-out affects other CLI sessions.',
                },
              )
      ensureOpen()
      trust()
      if (!action) {
        if (cursorConnectionState === 'checking') {
          cursorConnectionState = 'signed-out'
          cursorDetail = 'Cursor setup cancelled. Use Check Cursor to retry.'
          await refreshProviders()
        }
        return 'Cursor setup cancelled.'
      }
      if (action === 'Installation instructions') {
        await vscode.env.openExternal(vscode.Uri.parse('https://cursor.com/docs/cli/installation'))
        return 'Install Cursor CLI, then use Check connection or Sign in to Cursor in AI providers.'
      }
      if (action !== 'List models') {
        resetCursorStatus()
        cursorAutoCheck = action !== 'Sign out of Cursor CLI'
        await refreshProviders()
      }
      const connection = await cursorConnection()
      ensureOpen()
      if (
        action === 'Sign in to Cursor' ||
        action === 'List models' ||
        action === 'Sign out of Cursor CLI'
      ) {
        await prepareCursorProfile(connection.configDir)
        ensureOpen()
        trust()
        const env: Record<string, string | null> = Object.fromEntries(
          Object.keys(process.env).map((name) => [name, null]),
        )
        Object.assign(env, cursorEnvironment(connection.configDir))
        const terminal = vscode.window.createTerminal({
          name: 'Spectra · Cursor account',
          shellPath: connection.executable,
          shellArgs: [
            action === 'List models'
              ? 'models'
              : action === 'Sign out of Cursor CLI'
                ? 'logout'
                : 'login',
          ],
          cwd: tmpdir(),
          env,
        })
        context.subscriptions.push(terminal)
        terminal.show()
        if (action === 'List models')
          return 'Available Cursor models are shown in the terminal. Set a model ID in spectra.cursorModel.'
        if (action === 'Sign in to Cursor') {
          loginTerminals.add(terminal)
          const deadline = Date.now() + 180000
          loginPoll = setInterval(() => {
            if (disposed || cursorReady || Date.now() >= deadline) {
              clearInterval(loginPoll)
              loginPoll = undefined
              return
            }
            void detectCursorLogin()
          }, 3000)
          loginPoll.unref()
        }
        if (action === 'Sign out of Cursor CLI')
          return 'Cursor CLI sign-out started in the terminal. This affects other CLI sessions and does not delete conversation history.'
        return 'Complete Cursor sign-in in the browser, then return to Cursor. Spectra will check the login automatically. Check connection is also available in AI providers.'
      }
      const abort = new AbortController()
      controller = abort
      running()
      cursorConnectionState = 'checking'
      cursorDetail = 'Checking Cursor CLI login…'
      await refreshProviders()
      try {
        const connected = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Spectra · Checking Cursor CLI login',
            cancellable: true,
          },
          async (_progress, token) => {
            const cancel = token.onCancellationRequested(() => abort.abort())
            if (token.isCancellationRequested) abort.abort()
            try {
              return await checkCursorConnection(connection, abort.signal)
            } finally {
              cancel.dispose()
            }
          },
        )
        ensureOpen()
        trust()
        if (abort.signal.aborted) throw new OperationCancelled('Cursor connection check cancelled.')
        cursorReady = connected
        cursorConnectionState = connected ? 'ready' : 'signed-out'
        cursorDetail = connected
          ? 'CLI login detected · Model access is checked when generating.'
          : 'Cursor CLI is signed out. Sign in to enable generation.'
        await refreshProviders()
        if (!connected)
          throw new Error(
            'Cursor CLI is not signed in. Choose Sign in to Cursor, then Check connection.',
          )
        return 'Cursor CLI login detected. Model access and usage limits are checked when you generate. Select Cursor account as the engine.'
      } catch (error) {
        cursorConnectionState = abort.signal.aborted ? 'signed-out' : 'error'
        cursorDetail = abort.signal.aborted
          ? 'Cursor connection check cancelled. Check again to enable generation.'
          : error instanceof Error
            ? error.message.slice(0, 1200)
            : 'Could not check Cursor CLI.'
        await refreshProviders()
        if (abort.signal.aborted) throw new OperationCancelled('Cursor connection check cancelled.')
        throw error
      } finally {
        controller = undefined
      }
    }
    const existing = Boolean(await context.secrets.get(secretName(provider)))
    if (existing) {
      const action = await vscode.window.showQuickPick(['Replace saved key', 'Remove saved key'], {
        title: `Spectra · ${labels[provider]}`,
      })
      ensureOpen()
      if (!action) return 'Provider configuration cancelled.'
      if (action === 'Remove saved key') {
        trust()
        await context.secrets.delete(secretName(provider))
        await refreshProviders()
        return `${labels[provider]} key removed.`
      }
    }
    const key = await vscode.window.showInputBox({
      title: `Spectra · ${labels[provider]} API key`,
      password: true,
      ignoreFocusOut: true,
      prompt:
        'Stored only in editor SecretStorage. Never paste a key into the component or webview.',
      validateInput: (value) =>
        !value.trim() || value.trim().length > 1024 || /\s/.test(value.trim())
          ? 'Enter a nonempty API key without whitespace (maximum 1,024 characters).'
          : undefined,
    })
    ensureOpen()
    if (key === undefined) return 'Provider configuration cancelled.'
    trust()
    try {
      await context.secrets.store(secretName(provider), key.trim())
    } catch {
      throw new Error(
        'Could not save the key in SecretStorage. Check the system keychain and try again.',
      )
    }
    await refreshProviders()
    return `${labels[provider]} key saved. This is not a connectivity check.`
  }

  const generate = async (command: GenerationCommand) => {
    const sources = resolveSources(state, command)
    const constraints = resolveConstraints(state, command)
    let result: GenerationResult
    if (command.provider === 'demo') {
      if (state.baselineKind !== 'sample')
        throw new Error(
          'Curated demo transformations work only on the explicit Orbit sample, not imported components.',
        )
      result = {
        variants: parseGeneratedVariants(
          { variants: demoResult(command.command, sources, command.prompt) },
          command.command === 'generate' ? 3 : 1,
        ),
      }
    } else {
      trust()
      if (!state.source && !state.original)
        throw new Error('Capture a component or explicitly load the sample first.')
      const provider = command.provider
      const model = modelFor(provider)
      const key =
        provider === 'cursor' ? undefined : await context.secrets.get(secretName(provider))
      if (provider === 'cursor' && !cursorReady)
        throw new Error(
          'Connect Cursor CLI using AI providers → Cursor account → Check connection.',
        )
      if (provider !== 'cursor' && !key)
        throw new Error(`No ${labels[provider]} key saved. Use Spectra: Configure AI Provider.`)
      const connection = provider === 'cursor' ? await cursorConnection() : undefined
      const answer = await vscode.window.showInformationMessage(
        `Send this exploration to ${labels[provider]}?`,
        {
          modal: true,
          detail: `${state.source ? `${state.source.relativePath}, lines ${state.source.startLine}–${state.source.endLine} (${state.source.code.length.toLocaleString()} characters, possibly unsaved edits)` : 'Curated Orbit sample'}\n\nSends the captured source, original preview if available, current intent, instruction and design constraints, and ${sources.length} exact selected implementation(s). Model: ${model}. Design constraints: ${constraintsSummary(constraints) || 'None specified'}. No other project files are collected. Review the source for secrets first. ${provider === 'cursor' ? 'Uses Cursor CLI with its signed-in Cursor account, a temporary workspace and denied file/shell/MCP tools. Cursor account limits, billing, data policies and CLI history storage apply. This does not use your editor chat history or its selected model.' : 'Direct API charges and the provider’s data policies apply.'}`,
        },
        'Send to provider',
      )
      ensureOpen()
      trust()
      if (answer !== 'Send to provider')
        throw new OperationCancelled(
          'Generation cancelled. Your canvas and instruction are unchanged.',
        )
      const abort = new AbortController()
      controller = abort
      running()
      try {
        result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Spectra · ${labels[provider]} is generating`,
            cancellable: true,
          },
          async (_progress, token) => {
            const cancel = token.onCancellationRequested(() => abort.abort())
            if (token.isCancellationRequested) abort.abort()
            try {
              const input = {
                action: command.command,
                prompt: command.prompt,
                intent: command.command === 'generate' ? command.prompt : state.intent,
                constraints,
                source: state.source,
                original: state.original,
                sources,
              }
              return connection
                ? await generateWithCursor(connection, model, input, abort.signal)
                : await generateWithProvider(provider, model, key ?? '', input, abort.signal)
            } finally {
              cancel.dispose()
            }
          },
        )
        if (abort.signal.aborted)
          throw new OperationCancelled('Generation cancelled. Your canvas is unchanged.')
      } catch (error) {
        if (abort.signal.aborted)
          throw new OperationCancelled('Generation cancelled. Your canvas is unchanged.')
        throw error
      } finally {
        controller = undefined
      }
    }
    ensureOpen()
    state = applyGeneration(state, command, result)
    return command.provider === 'demo'
      ? 'Curated sample updated. Instructions use limited preset transformations.'
      : 'Directions ready. AI previews are approximations; review generated code before use.'
  }

  const execute = async (command: EditorCommand): Promise<string | undefined> => {
    ensureOpen()
    if (command.command === 'getState') {
      await refreshProviders()
      publish(true)
      void detectCursorLogin()
      return
    }
    if (command.command === 'cancelGeneration') {
      if (state.activity && ['generate', 'refine', 'remix'].includes(state.activity.command))
        controller?.abort()
      return
    }
    if (state.busy)
      throw new Error(
        'Another Spectra action is in progress. Complete or cancel the native prompt first.',
      )
    const confirming =
      command.command === 'exportHtml' ||
      command.command === 'configureProvider' ||
      (['generate', 'refine', 'remix'].includes(command.command) &&
        'provider' in command &&
        command.provider !== 'demo')
    state = {
      ...state,
      busy: true,
      activity: { command: command.command, phase: confirming ? 'confirming' : 'running' },
    }
    publish()
    try {
      switch (command.command) {
        case 'captureSource':
          return await capture()
        case 'configureProvider':
          return await configure(command.provider, command.action)
        case 'loadSample':
          await confirmReset()
          sourceUri = undefined
          state = {
            ...state,
            source: null,
            original: sampleOriginal,
            variants: [],
            baselineKind: 'sample',
            constraints: { ...emptyConstraints },
            intent: samplePrompt,
          }
          return 'Curated Orbit sample loaded. This is not live AI.'
        case 'openSource': {
          trust()
          if (!sourceUri || !state.source) throw new Error('Capture a component first.')
          const document = await vscode.workspace.openTextDocument(sourceUri)
          ensureOpen()
          const start = Math.min(state.source.startLine - 1, document.lineCount - 1)
          const end = Math.min(state.source.endLine - 1, document.lineCount - 1)
          await vscode.window.showTextDocument(document, {
            viewColumn: vscode.ViewColumn.One,
            selection: new vscode.Range(start, 0, end, document.lineAt(end).text.length),
          })
          return 'Opened current source. The Spectra snapshot does not update automatically.'
        }
        case 'generate':
        case 'refine':
        case 'remix':
          return await generate(command)
        case 'copyHandoff':
        case 'exportHtml': {
          trust()
          const variant = state.variants.find((item) => item.id === command.variantId)
          if (!variant)
            throw new Error(
              'That direction is no longer available. Choose a direction on this canvas.',
            )
          if (command.command === 'copyHandoff') {
            await vscode.env.clipboard.writeText(createHandoff(state.source, state.intent, variant))
            return 'Implementation brief copied. Paste it manually into Cursor; no project files were changed.'
          }
          const review = await vscode.window.showWarningMessage(
            'Save generated code outside the preview sandbox?',
            {
              modal: true,
              detail:
                'This file omits the preview CSP and iframe isolation. Review all generated code and illustrative content before opening or production use. It is HTML/CSS/JS, not a drop-in framework component.',
            },
            'Choose save location',
          )
          ensureOpen()
          if (review !== 'Choose save location')
            throw new OperationCancelled('Export cancelled. No file was written.')
          const destination = await vscode.window.showSaveDialog({
            title: 'Save Spectra direction as standalone HTML',
            saveLabel: 'Save HTML',
            filters: { HTML: ['html'] },
          })
          ensureOpen()
          trust()
          if (!destination) throw new OperationCancelled('Export cancelled. No file was written.')
          running()
          await vscode.workspace.fs.writeFile(
            destination,
            Buffer.from(exportDocument(variant), 'utf8'),
          )
          return 'HTML saved to your chosen location. Review generated code before opening or production use.'
        }
      }
    } catch (error) {
      // Also surface setup failures before the status subprocess starts (missing
      // executable/profile), so inline Check Cursor never fails invisibly.
      if (
        command.command === 'configureProvider' &&
        command.provider === 'cursor' &&
        !cursorReady &&
        !(error instanceof OperationCancelled)
      ) {
        cursorConnectionState = 'error'
        cursorDetail =
          error instanceof Error && error.message
            ? error.message.slice(0, 1200)
            : 'Could not configure Cursor CLI. Check the installation and try again.'
        await refreshProviders()
      }
      throw error
    } finally {
      state = { ...state, busy: false, activity: null }
      publish()
      if (
        cursorCheckAfterBusy ||
        command.command === 'captureSource' ||
        (command.command === 'configureProvider' && command.action === 'login')
      )
        void detectCursorLogin()
    }
  }

  subscriptions.push(
    panel.webview.onDidReceiveMessage((message: unknown) => {
      // Never execute arbitrary editor commands or trust webview-supplied implementations/paths.
      if (!validEditorRequest(message)) return
      void execute(message).then(
        (text) => post({ type: 'response', id: message.id, ok: true, message: text }),
        (error) =>
          post({
            type: 'response',
            id: message.id,
            ok: false,
            cancelled: error instanceof OperationCancelled,
            error:
              error instanceof Error
                ? error.message.slice(0, 12000)
                : 'Spectra could not complete the action.',
          }),
      )
    }),
  )
  subscriptions.push(
    context.secrets.onDidChange((event) => {
      if (providers.some((id) => event.key === secretName(id))) guardedRefresh()
    }),
  )
  subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('spectra.cursorCliPath')) {
        resetCursorStatus()
        void detectCursorLogin()
      }
      if (event.affectsConfiguration('spectra')) guardedRefresh()
    }),
  )
  subscriptions.push(
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      guardedRefresh()
      void detectCursorLogin()
    }),
    vscode.window.onDidCloseTerminal((terminal) => {
      if (loginTerminals.delete(terminal)) void detectCursorLogin()
    }),
    vscode.window.onDidChangeWindowState((windowState) => {
      if (windowState.focused) void detectCursorLogin()
    }),
  )
  panel.onDidDispose(() => {
    disposed = true
    controller?.abort()
    cursorStatusController?.abort()
    clearInterval(loginPoll)
    for (const subscription of subscriptions) subscription.dispose()
  })
  panel.webview.html = webviewHtml(panel.webview, assets)
  guardedRefresh()
  void detectCursorLogin()
  return { panel, execute }
}

export const activate = (context: vscode.ExtensionContext) => {
  let current: ReturnType<typeof createPanel> | undefined
  let lastEditor = vscode.window.activeTextEditor
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      // Keep the most recently focused document even if unsupported, so a click
      // in the webview cannot silently capture an older component instead.
      if (editor) lastEditor = editor
    }),
  )
  const getEditor = () => vscode.window.activeTextEditor ?? lastEditor
  const open = () => {
    if (!current) {
      current = createPanel(context, getEditor)
      current.panel.onDidDispose(() => {
        current = undefined
      })
    } else current.panel.reveal(vscode.ViewColumn.Beside, true)
    return current
  }
  const run = async (command: EditorCommand) => {
    try {
      const message = await open().execute(command)
      if (message) void vscode.window.showInformationMessage(message)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Spectra could not complete the action.'
      if (error instanceof OperationCancelled) void vscode.window.showInformationMessage(message)
      else void vscode.window.showErrorMessage(message)
    }
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('spectra.open', () => {
      open()
    }),
    vscode.commands.registerCommand('spectra.exploreSelection', () =>
      run({ command: 'captureSource' }),
    ),
    vscode.commands.registerCommand('spectra.loadSample', () => run({ command: 'loadSample' })),
    vscode.commands.registerCommand('spectra.configureProvider', async () => {
      if (!vscode.workspace.isTrusted) {
        void vscode.window.showErrorMessage(
          'Trust this workspace before configuring a Spectra provider.',
        )
        return
      }
      const provider = await vscode.window.showQuickPick(
        providers.map((id) => ({ label: labels[id], id })),
        { title: 'Spectra · Configure AI provider' },
      )
      if (provider) await run({ command: 'configureProvider', provider: provider.id })
    }),
    { dispose: () => current?.panel.dispose() },
  )
}

export const deactivate = () => {}
