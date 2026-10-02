import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { build } from 'esbuild'
import { chromium, expect, type Browser, type Frame } from '@playwright/test'

const args = process.argv.slice(2)
if (args.length !== 2 || args[0] !== '--editor' || !isAbsolute(args[1]))
  throw new Error('Usage: npm run test:native -- --editor /absolute/path/to/editor-executable')
const executable = args[1]
await access(executable, constants.X_OK)
const isCursor = /(?:^|[/\\])Cursor(?:\.app|\.exe)?(?:[/\\]|$)/i.test(await realpath(executable))
const root = resolve(import.meta.dirname, '..')
await access(join(root, 'dist', 'extension.cjs'))
const directory = await mkdtemp(join(tmpdir(), 'spectra-native-'))
const artifactDirectory = join(
  root,
  'dist',
  'native-test-results',
  `native-${basename(executable).toLowerCase()}-${Date.now()}`,
)
const checks: string[] = []
const unavailable = [
  'No live generation, provider credentials, native replacement, clipboard or save-dialog check.',
  'Workspace trust is disabled only in this isolated test profile; restricted-mode behavior is not covered.',
  'Editor-owned background services and networking are outside Spectra provider coverage.',
]
const isolation = [
  'Fresh temporary profile, extensions directory and fixture workspace; in-memory secrets.',
]
let browser: Browser | undefined
let child: ReturnType<typeof spawn> | undefined
let childExited: Promise<number | null> | undefined
let exitCode: number | null | undefined
let editorLog = ''

type HostReport = {
  phase: string
  appName: string
  apiVersion: string
  checks: string[]
  error?: string
}
const hostReport = async (): Promise<HostReport | undefined> => {
  let value: unknown
  try {
    value = JSON.parse(await readFile(join(directory, 'host.json'), 'utf8'))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw error
  }
  assert.ok(value && typeof value === 'object')
  assert.ok('phase' in value && typeof value.phase === 'string')
  assert.ok('appName' in value && typeof value.appName === 'string')
  assert.ok('apiVersion' in value && typeof value.apiVersion === 'string')
  assert.ok(
    'checks' in value &&
      Array.isArray(value.checks) &&
      value.checks.every((item: unknown) => typeof item === 'string'),
  )
  const error = 'error' in value && typeof value.error === 'string' ? value.error : undefined
  return {
    phase: value.phase,
    appName: value.appName,
    apiVersion: value.apiVersion,
    checks: value.checks,
    error,
  }
}
const freePort = async () => {
  const server = createServer()
  await new Promise<void>((accept, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', accept)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  await new Promise<void>((accept, reject) =>
    server.close((error) => (error ? reject(error) : accept())),
  )
  return address.port
}
const spectraFrame = async (): Promise<Frame | undefined> => {
  if (!browser) return undefined
  for (const context of browser.contexts())
    for (const page of context.pages())
      for (const frame of page.frames())
        if (
          await frame
            .locator('main.workbench')
            .count()
            .catch(() => 0)
        )
          return frame
  return undefined
}

try {
  await mkdir(artifactDirectory, { recursive: true })
  await Promise.all([
    mkdir(join(directory, 'profile', 'User'), { recursive: true }),
    mkdir(join(directory, 'extensions')),
    mkdir(join(directory, 'workspace')),
  ])
  await Promise.all([
    writeFile(
      join(directory, 'workspace', 'Button.tsx'),
      'const untouched = "Outside selected range";\nexport const Button = () => <button>Saved fixture</button>;\n',
    ),
    writeFile(
      join(directory, 'profile', 'User', 'settings.json'),
      JSON.stringify({
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        'extensions.autoUpdate': false,
        'extensions.autoCheckUpdates': false,
        'workbench.startupEditor': 'none',
        'window.restoreWindows': 'none',
        'files.autoSave': 'off',
        'git.enabled': false,
        'security.workspace.trust.enabled': false,
        // Even inside Cursor, automatic detection must not touch the real CLI login.
        'spectra.cursorCliPath': join(directory, 'no-cursor-cli'),
      }),
    ),
    build({
      entryPoints: [join(root, 'tests', 'native', 'extension.ts')],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      external: ['vscode'],
      outfile: join(directory, 'extension-tests.cjs'),
      logLevel: 'silent',
    }),
  ])
  const port = await freePort()
  const environment: NodeJS.ProcessEnv = {}
  for (const key of [
    'HOME',
    'USER',
    'LOGNAME',
    'SHELL',
    'PATH',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'DISPLAY',
    'WAYLAND_DISPLAY',
    'XDG_RUNTIME_DIR',
    'DBUS_SESSION_BUS_ADDRESS',
    'SystemRoot',
    'WINDIR',
  ])
    if (process.env[key] !== undefined) environment[key] = process.env[key]
  environment.SPECTRA_NATIVE_RUN_DIRECTORY = directory
  let launchExecutable = executable
  const launchArguments: string[] = []
  if (isCursor && process.platform === 'darwin') {
    // Cursor has built-in services outside --user-data-dir. Restrict their ordinary home paths
    // without reading, changing or relying on any real profile, CLI login or worktree contents.
    launchExecutable = '/usr/bin/sandbox-exec'
    try {
      await access(launchExecutable, constants.X_OK)
    } catch {
      throw new Error(
        'Cursor native tests require /usr/bin/sandbox-exec to protect ordinary user data; refusing an unguarded launch.',
      )
    }
    const protectedPaths = [
      join(homedir(), '.cursor'),
      join(homedir(), '.config', 'cursor'),
      join(homedir(), 'Library', 'Application Support', 'Cursor'),
    ]
    const profile = join(directory, 'cursor.sb')
    await writeFile(
      profile,
      `(version 1)\n(allow default)\n(deny file-read* file-write*\n${protectedPaths.map((path) => `  (subpath ${JSON.stringify(path)})`).join('\n')}\n)\n`,
    )
    launchArguments.push('-f', profile, executable)
    isolation.push(
      'macOS sandbox denies reads/writes to ~/.cursor, ~/.config/cursor and ~/Library/Application Support/Cursor.',
    )
  } else if (isCursor)
    throw new Error(
      'Cursor native tests currently require the macOS sandbox guard; refusing an unguarded run on this platform.',
    )
  launchArguments.push(
    '--new-window',
    '--disable-extensions',
    '--disable-workspace-trust',
    '--use-inmemory-secretstorage',
    '--skip-welcome',
    '--skip-release-notes',
    '--no-proxy-server',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(directory, 'profile')}`,
    `--extensions-dir=${join(directory, 'extensions')}`,
    `--extensionDevelopmentPath=${root}`,
    `--extensionTestsPath=${join(directory, 'extension-tests.cjs')}`,
    join(directory, 'workspace'),
  )
  child = spawn(launchExecutable, launchArguments, {
    env: environment,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  childExited = new Promise((accept, reject) => {
    child?.once('error', reject)
    child?.once('close', (code) => {
      exitCode = code
      accept(code)
    })
  })
  void childExited.catch(() => undefined)
  for (const stream of [child.stdout, child.stderr])
    stream?.on('data', (chunk: Buffer) => {
      editorLog = (editorLog + chunk.toString()).slice(-100000)
    })
  const deadline = Date.now() + 120000
  const completed = new Set<string>()
  let passed: HostReport | undefined
  while (Date.now() < deadline) {
    const report = await hostReport()
    if (report?.phase === 'failed') throw new Error(report.error ?? 'The native host test failed.')
    if (report?.phase === 'passed') {
      passed = report
      break
    }
    if (exitCode !== undefined)
      throw new Error(`Editor exited before completing the native test (${exitCode}).`)
    if (!browser) {
      browser = await chromium
        .connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 })
        .catch(() => undefined)
      for (const context of browser?.contexts() ?? []) context.setDefaultTimeout(10000)
    }
    const frame = await spectraFrame()
    if (frame && report && !completed.has(report.phase)) {
      await expect(frame.locator('.harness-notice')).toHaveCount(0)
      await expect(frame.locator('.error-banner')).toHaveCount(0)
      const styled = await frame
        .locator('main.workbench')
        .evaluate((element) => getComputedStyle(element).display)
      assert.notEqual(styled, 'block', 'The local webview stylesheet is loaded.')
      if (report.phase === 'empty') {
        await expect(frame.getByRole('heading', { name: 'Explore a component' })).toBeVisible()
        await expect(
          frame.getByRole('button', { name: 'Use editor selection', exact: true }),
        ).toBeEnabled()
        checks.push(
          'Real editor webview loads local JavaScript/CSS and enables trusted source capture.',
        )
      } else if (report.phase === 'sample') {
        await expect(
          frame.getByRole('heading', { name: 'Orbit / pricing-section.html' }),
        ).toBeVisible()
        await expect(frame.getByText('Curated sample', { exact: true })).toBeVisible()
        await frame.locator('.preview-frame').scrollIntoViewIfNeeded()
        await expect(frame.locator('iframe[srcdoc]')).toHaveCount(1)
        assert.equal(await frame.locator('iframe[srcdoc]').getAttribute('sandbox'), 'allow-scripts')
        const preview = frame.frameLocator('iframe[srcdoc]')
        await expect(preview.locator('[data-price]')).toHaveText('$24')
        await preview.getByRole('button', { name: 'Monthly', exact: true }).click()
        await expect(preview.locator('[data-price]')).toHaveText('$30')
        checks.push(
          'Curated sample renders and responds inside the real editor CSP and isolated srcdoc preview.',
        )
        await expect(frame.getByRole('combobox', { name: 'Provider', exact: true })).toHaveValue(
          'demo',
        )
        await frame.getByRole('button', { name: 'Generate 3 directions', exact: true }).click()
        await expect(frame.locator('.variant-card')).toHaveCount(4)
        await frame.getByRole('button', { name: 'Choose', exact: true }).first().click()
        await expect(frame.locator('.chosen-toolbar')).toBeVisible()
        await expect(frame.getByRole('button', { name: 'Copy brief', exact: true })).toBeEnabled()
        checks.push(
          'Curated generation makes three directions through the native bridge, and Choose opens selected actions.',
        )
      } else if (report.phase === 'capture') {
        await expect(frame.getByRole('heading', { name: /(?:^|\/)Button\.tsx$/ })).toBeVisible()
        await expect(frame.locator('.source-range')).toHaveText('Lines 2–2 · selection')
        await expect(frame.locator('.source-details code')).toHaveText(
          'export const Button = () => <button>Unsaved native fixture</button>;',
        )
        checks.push(
          'Webview receives the exact selected unsaved source through the real host bridge.',
        )
      } else throw new Error(`Unknown native inspection phase: ${report.phase}`)
      await frame.page().screenshot({ path: join(artifactDirectory, `${report.phase}.png`) })
      completed.add(report.phase)
      await writeFile(join(directory, `${report.phase}.ack`), '')
    }
    await delay(100)
  }
  assert.ok(passed, 'Native test did not finish within 120 seconds.')
  const code = await Promise.race([childExited, delay(15000).then(() => 'timeout')])
  assert.equal(code, 0, 'Editor test host exits successfully.')
  const result = {
    editorExecutable: executable,
    ...passed,
    checks: [...passed.checks, ...checks],
    limitations: unavailable,
    isolation,
  }
  await writeFile(join(artifactDirectory, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ ...result, artifacts: artifactDirectory }, null, 2))
} catch (error) {
  await mkdir(artifactDirectory, { recursive: true })
  await writeFile(
    join(artifactDirectory, 'failure.json'),
    JSON.stringify(
      {
        editorExecutable: executable,
        error: error instanceof Error ? error.message : String(error),
        checks,
        host: await hostReport().catch(() => undefined),
        limitations: unavailable,
        isolation,
      },
      null,
      2,
    ),
  )
  throw error
} finally {
  await browser?.close().catch(() => undefined)
  if (child?.pid && exitCode === undefined) {
    try {
      if (process.platform === 'win32') child.kill('SIGTERM')
      else process.kill(-child.pid, 'SIGTERM')
    } catch {
      /* The test host may already have exited. */
    }
    await Promise.race([childExited, delay(3000)]).catch(() => undefined)
    if (exitCode === undefined) {
      try {
        if (process.platform === 'win32') child.kill('SIGKILL')
        else process.kill(-child.pid, 'SIGKILL')
      } catch {
        /* The test host may already have exited. */
      }
      await childExited?.catch(() => undefined)
    }
  }
  try {
    await writeFile(join(artifactDirectory, 'editor.log'), editorLog)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
