import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { isRecord } from '../src/domain/guards'
import { CURSOR_GENERATION_TIMEOUT_MS } from '../src/domain/timeouts'
import {
  generationMessage,
  MAX_RESPONSE_BYTES,
  parseProviderResult,
  systemPrompt,
  validateInput,
  type GenerationInput,
} from './providers'

export type CursorConnection = { executable: string; configDir: string }
export type CursorRun = {
  args: string[]
  cwd: string
  input?: string
  signal: AbortSignal
  timeoutMs: number
  timeoutMessage?: string
}
export type CursorRunner = (connection: CursorConnection, run: CursorRun) => Promise<string>
export type CursorModel = { id: string; label: string }

const validModelId = (model: string) =>
  model.length <= 200 &&
  /^[a-zA-Z0-9_.:/-]+(?:\[[a-zA-Z0-9_.-]+=[a-zA-Z0-9_.-]+(?:,[a-zA-Z0-9_.-]+=[a-zA-Z0-9_.-]+)*\])?$/.test(
    model,
  )

const cancelled = 'Cursor generation cancelled. Your previous canvas is unchanged.'
const failed =
  'Cursor CLI failed. Check your Cursor login, model access and usage limits in AI providers. Your canvas is unchanged.'

// Explicit deny rules override any allow rules. Never run in the user's project.
export const cursorPermissions = {
  allow: [],
  deny: ['Read(**)', 'Read(/**)', 'Write(**)', 'Write(/**)', 'Shell(*)', 'WebFetch(*)', 'Mcp(*:*)'],
}

export const resolveCursorExecutable = async (configuredPath = '') => {
  if (process.platform === 'win32')
    throw new Error(
      'Spectra Cursor CLI currently requires macOS, Linux or a WSL extension host. Direct API providers remain available on Windows.',
    )
  if (configuredPath && !isAbsolute(configuredPath))
    throw new Error(
      'spectra.cursorCliPath must be an absolute path to the Cursor CLI executable, without arguments.',
    )
  const candidates = configuredPath
    ? [configuredPath]
    : [join(homedir(), '.local', 'bin', 'agent'), join(homedir(), '.local', 'bin', 'cursor-agent')]
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      /* Try the other official installation name. */
    }
  }
  throw new Error(
    'Cursor CLI was not found. Install it from cursor.com/docs/cli/installation, or set spectra.cursorCliPath to its absolute executable path. Then open AI providers → Cursor account.',
  )
}

export const prepareCursorProfile = async (configDir: string) => {
  await mkdir(configDir, { recursive: true, mode: 0o700 })
  // This is a Spectra-owned profile, never ~/.cursor or a workspace config.
  await writeFile(
    join(configDir, 'cli-config.json'),
    JSON.stringify({
      version: 1,
      editor: { vimMode: false },
      permissions: cursorPermissions,
      approvalMode: 'allowlist',
    }),
    { mode: 0o600 },
  )
  await writeFile(join(configDir, 'mcp.json'), '{"mcpServers":{}}', { mode: 0o600 })
  await writeFile(join(configDir, 'hooks.json'), '{"version":1,"hooks":{}}', { mode: 0o600 })
}

export const cursorEnvironment = (configDir: string): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {}
  // Do not inherit vendor keys, Cursor endpoint overrides, NODE_OPTIONS or project variables.
  for (const name of [
    'HOME',
    'PATH',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'SHELL',
    'USER',
    'LOGNAME',
    'XDG_RUNTIME_DIR',
    'DBUS_SESSION_BUS_ADDRESS',
  ]) {
    if (process.env[name] !== undefined) env[name] = process.env[name]
  }
  return { ...env, CURSOR_CONFIG_DIR: configDir, CURSOR_DATA_DIR: configDir, NO_COLOR: '1' }
}

export const runCursor: CursorRunner = async (connection, run) => {
  if (run.signal.aborted) throw new Error(cancelled)
  return new Promise<string>((resolve, reject) => {
    const child = spawn(connection.executable, run.args, {
      cwd: run.cwd,
      env: cursorEnvironment(connection.configDir),
      shell: false,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const chunks: Buffer[] = []
    let bytes = 0
    let failure: Error | undefined
    let killTimer: ReturnType<typeof setTimeout> | undefined
    const kill = (signal: NodeJS.Signals) => {
      try {
        if (child.pid) process.kill(-child.pid, signal)
      } catch {
        /* The process group may already have exited. */
      }
    }
    const stop = (message: string) => {
      if (failure) return
      failure = new Error(message)
      kill('SIGTERM')
      killTimer = setTimeout(() => kill('SIGKILL'), 500)
    }
    const abort = () => stop(cancelled)
    const timeout = setTimeout(
      () =>
        stop(
          run.timeoutMessage ??
            `Cursor CLI timed out after ${Math.ceil(run.timeoutMs / 1000)} seconds. Check your connection and try again; your canvas is unchanged.`,
        ),
      run.timeoutMs,
    )
    run.signal.addEventListener('abort', abort, { once: true })
    if (run.signal.aborted) abort()
    const collect = (chunk: Buffer, stdout: boolean) => {
      bytes += chunk.byteLength
      if (bytes > MAX_RESPONSE_BYTES)
        stop('Cursor CLI response was too large. Your canvas is unchanged.')
      else if (stdout && !failure) chunks.push(chunk)
      // Never expose or log raw stderr: it may contain source, account details or credentials.
    }
    child.stdout.on('data', (chunk: Buffer) => collect(chunk, true))
    child.stderr.on('data', (chunk: Buffer) => collect(chunk, false))
    child.stdin.on('error', () => stop(failed))
    child.on('error', () =>
      stop('Could not start Cursor CLI. Check spectra.cursorCliPath and the CLI installation.'),
    )
    child.on('close', (code) => {
      clearTimeout(timeout)
      clearTimeout(killTimer)
      // Also stop any descendants left behind by the CLI wrapper.
      kill('SIGKILL')
      run.signal.removeEventListener('abort', abort)
      if (failure) reject(failure)
      else if (code !== 0) reject(new Error(failed))
      else resolve(Buffer.concat(chunks).toString('utf8'))
    })
    // Source goes through stdin, never shell interpolation, argv or a source file.
    child.stdin.end(run.input ?? '')
  })
}

const withCursorWorkspace = async <T>(action: (cwd: string) => Promise<T>) => {
  const cwd = await mkdtemp(join(tmpdir(), 'spectra-cursor-'))
  try {
    await mkdir(join(cwd, '.cursor'), { mode: 0o700 })
    await writeFile(
      join(cwd, '.cursor', 'cli.json'),
      JSON.stringify({ permissions: cursorPermissions }),
      { mode: 0o600 },
    )
    return await action(cwd)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
}

const jsonObject = (text: string): Record<string, unknown> => {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    /* Fail closed below. */
  }
  if (!isRecord(value))
    throw new Error(
      'Cursor CLI returned an unsupported response. Update Cursor CLI and check the connection again.',
    )
  return value
}

export const checkCursorConnection = async (
  connection: CursorConnection,
  signal: AbortSignal,
  runner: CursorRunner = runCursor,
) =>
  withCursorWorkspace(async (cwd) => {
    await prepareCursorProfile(connection.configDir)
    const output = await runner(connection, {
      args: ['status', '--format', 'json'],
      cwd,
      signal,
      timeoutMs: 15000,
    })
    const status = jsonObject(output)
    return status.status === 'authenticated' && status.isAuthenticated === true
  })

export const listCursorModels = async (
  connection: CursorConnection,
  signal: AbortSignal,
  runner: CursorRunner = runCursor,
): Promise<CursorModel[]> => {
  const unavailable =
    'Could not load Cursor models. Check your CLI login and connection, or set spectra.cursorModel in editor settings. Your current model is unchanged.'
  if (signal.aborted) throw new Error('Cursor model listing cancelled.')
  let output: string
  try {
    output = await withCursorWorkspace(async (cwd) => {
      await prepareCursorProfile(connection.configDir)
      return runner(connection, {
        args: ['--list-models'],
        cwd,
        signal,
        timeoutMs: 20000,
      })
    })
  } catch {
    throw new Error(signal.aborted ? 'Cursor model listing cancelled.' : unavailable)
  }
  if (signal.aborted) throw new Error('Cursor model listing cancelled.')
  // CLI exposes a text listing, not JSON. Only model rows enter the native picker;
  // never forward the raw output, account details or terminal control sequences.
  if (output.length > 100000) throw new Error(unavailable)
  const lines = stripVTControlCharacters(output).split(/\r?\n/)
  const header = lines.findIndex((line) => line.trim() === 'Available models')
  if (header < 0) throw new Error(unavailable)
  const models: CursorModel[] = []
  const ids = new Set<string>()
  for (const line of lines.slice(header + 1)) {
    const row = line.trim().match(/^(\S+) - (.+)$/)
    if (!row) continue
    const [, id, rawLabel] = row
    const label = rawLabel.replace(/[\u200b-\u200d\ufeff]/g, '').trim()
    if (
      !validModelId(id) ||
      !label ||
      label.length > 160 ||
      [...label].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      ids.has(id) ||
      models.length >= 512
    )
      throw new Error(unavailable)
    ids.add(id)
    models.push({ id, label })
  }
  if (!models.length) throw new Error(unavailable)
  return models
}

export const generateWithCursor = async (
  connection: CursorConnection,
  model: string,
  input: GenerationInput,
  signal: AbortSignal,
  runner: CursorRunner = runCursor,
) => {
  validateInput(input)
  if (signal.aborted) throw new Error(cancelled)
  // Parameter overrides are supported by current CLI versions; they remain one argv value.
  if (!validModelId(model))
    throw new Error('Set a valid Cursor model ID in spectra.cursorModel (for example auto).')
  await prepareCursorProfile(connection.configDir)
  return withCursorWorkspace(async (cwd) => {
    const output = await runner(connection, {
      args: [
        '--print',
        '--mode',
        'ask',
        '--output-format',
        'json',
        '--model',
        model,
        '--sandbox',
        'enabled',
        '--workspace',
        cwd,
        '--trust',
      ],
      cwd,
      input: `${systemPrompt}\n\nUse only the data below. Do not call tools, read files, run commands or fetch URLs. Respond with the requested JSON only.\n\n${generationMessage(input)}`,
      signal,
      timeoutMs: CURSOR_GENERATION_TIMEOUT_MS,
      timeoutMessage:
        'Cursor generation timed out after 10 minutes. Try again or choose another model in AI providers. Your canvas is unchanged.',
    })
    if (signal.aborted) throw new Error(cancelled)
    const envelope = jsonObject(output)
    if (
      envelope.type !== 'result' ||
      envelope.subtype !== 'success' ||
      envelope.is_error !== false ||
      typeof envelope.result !== 'string'
    )
      throw new Error(
        'Cursor did not complete generation successfully. Your previous canvas is unchanged.',
      )
    return parseProviderResult(envelope.result, input)
  })
}
