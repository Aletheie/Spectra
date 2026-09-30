import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { original, demoVariants as previewVariants } from '../src/variants'
import type { GenerationInput } from './providers'
import { CURSOR_GENERATION_TIMEOUT_MS } from '../src/domain/timeouts'
import {
  checkCursorConnection,
  cursorEnvironment,
  cursorPermissions,
  generateWithCursor,
  listCursorModels,
  resolveCursorExecutable,
  runCursor,
  type CursorRunner,
} from './cursor'

const demoVariants = previewVariants.map((variant) => ({
  ...variant,
  react: {
    language: 'tsx' as const,
    code: 'export const Card = () => <article className="rounded-xl p-4">Card</article>',
  },
}))

const input: GenerationInput = {
  action: 'generate',
  prompt: 'Clarify hierarchy',
  intent: 'Clarify hierarchy',
  source: {
    id: 'source',
    relativePath: 'src/Card.tsx',
    language: 'typescriptreact',
    code: '<Card />',
    startLine: 1,
    endLine: 1,
    selection: true,
  },
  original: null,
  sources: [],
}
const envelope = (result: unknown) =>
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: JSON.stringify(result),
  })
const signal = () => new AbortController().signal
const profile = async (action: (configDir: string) => Promise<void>) => {
  const configDir = await mkdtemp(join(tmpdir(), 'spectra-cursor-test-'))
  try {
    await action(configDir)
  } finally {
    await rm(configDir, { recursive: true, force: true })
  }
}

test('Cursor uses stdin, a separate profile and denied tools; successful initial output gets fresh host IDs', async () =>
  profile(async (configDir) => {
    let workingDirectory = ''
    const runner: CursorRunner = async (connection, run) => {
      assert.equal(connection.configDir, configDir)
      workingDirectory = run.cwd
      assert.notEqual(run.cwd, process.cwd())
      assert.deepEqual(await readdir(run.cwd), ['.cursor'])
      assert.deepEqual(
        JSON.parse(await readFile(join(run.cwd, '.cursor', 'cli.json'), 'utf8')).permissions,
        cursorPermissions,
      )
      assert.deepEqual(
        JSON.parse(await readFile(join(configDir, 'cli-config.json'), 'utf8')).permissions,
        cursorPermissions,
      )
      assert.deepEqual(JSON.parse(await readFile(join(configDir, 'mcp.json'), 'utf8')), {
        mcpServers: {},
      })
      assert.equal(run.args.includes('--force'), false)
      assert.equal(run.args.includes('--approve-mcps'), false)
      assert.equal(run.args.includes('--resume'), false)
      assert.ok(run.args.includes('ask'))
      assert.ok(run.args.includes('enabled'))
      assert.ok(!run.args.join(' ').includes(input.source!.code))
      const data = JSON.parse(run.input!.slice(run.input!.lastIndexOf('\n\n') + 2))
      assert.deepEqual(data.capturedSource, input.source)
      assert.equal(data.reconstructOriginal, true)
      return envelope({ original, variants: demoVariants })
    }
    const result = await generateWithCursor(
      { executable: '/unused/agent', configDir },
      'auto',
      input,
      signal(),
      runner,
    )
    assert.equal(result.original?.id, 'original')
    assert.equal(result.variants.length, 3)
    assert.notEqual(result.variants[0].id, demoVariants[0].id)
    await assert.rejects(access(workingDirectory))
  }))

test('Cursor refine/remix send exact sources in order and cannot replace the original', async () =>
  profile(async (configDir) => {
    for (const action of ['refine', 'remix'] as const) {
      const sources = demoVariants.slice(0, action === 'refine' ? 1 : 2)
      const context = { ...input, action, original, sources }
      const runner: CursorRunner = async (_connection, run) => {
        const data = JSON.parse(run.input!.slice(run.input!.lastIndexOf('\n\n') + 2))
        assert.deepEqual(data.sourceVariants, sources)
        assert.deepEqual(data.original, original)
        return envelope({ variants: [demoVariants[2]] })
      }
      const result = await generateWithCursor(
        { executable: '/unused/agent', configDir },
        'auto',
        context,
        signal(),
        runner,
      )
      assert.equal(result.original, undefined)
      assert.equal(result.variants.length, 1)
      await assert.rejects(
        generateWithCursor(
          { executable: '/unused/agent', configDir },
          'auto',
          context,
          signal(),
          async () => envelope({ original, variants: [demoVariants[2]] }),
        ),
        /shape/,
      )
    }
  }))

test('Cursor rejects errors, invalid JSON, wrong counts, late cancellation and invalid model without fallback', async () =>
  profile(async (configDir) => {
    const connection = { executable: '/unused/agent', configDir }
    for (const output of [
      'not json',
      '{}',
      JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: '{}' }),
      envelope({ variants: demoVariants }),
      envelope({ original, variants: [demoVariants[0]] }),
    ]) {
      let cwd = ''
      await assert.rejects(
        generateWithCursor(connection, 'auto', input, signal(), async (_connection, run) => {
          cwd = run.cwd
          return output
        }),
      )
      await assert.rejects(access(cwd))
    }
    let calls = 0
    const unused: CursorRunner = async () => {
      calls++
      return '{}'
    }
    await assert.rejects(
      generateWithCursor(connection, 'auto; echo secret', input, signal(), unused),
      /valid Cursor model/,
    )
    const abort = new AbortController()
    abort.abort()
    await assert.rejects(
      generateWithCursor(connection, 'auto', input, abort.signal, unused),
      /cancelled/,
    )
    assert.equal(calls, 0)
    const late = new AbortController()
    await assert.rejects(
      generateWithCursor(connection, 'auto', input, late.signal, async () => {
        late.abort()
        return envelope({ original, variants: demoVariants })
      }),
      /cancelled/,
    )
  }))

test('Cursor status requires explicit authenticated JSON; no account details enter provider state', async () =>
  profile(async (configDir) => {
    for (const [status, expected] of [
      [
        {
          status: 'authenticated',
          isAuthenticated: true,
          userInfo: { email: 'private@example.test' },
        },
        true,
      ],
      [{ status: 'unauthenticated', isAuthenticated: false }, false],
      [{ status: 'authenticated', isAuthenticated: 'true' }, false],
    ] as const) {
      const connected = await checkCursorConnection(
        { executable: '/unused/agent', configDir },
        signal(),
        async (_connection, run) => {
          assert.deepEqual(run.args, ['status', '--format', 'json'])
          assert.equal(run.input, undefined)
          return JSON.stringify(status)
        },
      )
      assert.equal(connected, expected)
    }
  }))

test('Cursor executable resolution never runs relative paths and environment excludes inherited keys and overrides', async () => {
  await assert.rejects(resolveCursorExecutable('./agent'), /absolute path|requires macOS/)
  await assert.rejects(
    resolveCursorExecutable('/nonexistent/spectra/agent'),
    /not found|requires macOS/,
  )
  const env = cursorEnvironment('/dedicated/profile')
  assert.equal(env.CURSOR_CONFIG_DIR, '/dedicated/profile')
  assert.equal(env.CURSOR_DATA_DIR, '/dedicated/profile')
  for (const name of [
    'CURSOR_API_KEY',
    'CURSOR_AUTH_TOKEN',
    'CURSOR_API_ENDPOINT',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'NODE_OPTIONS',
  ])
    assert.equal(env[name], undefined)
})

test('Cursor subprocess handles stdin, redacts errors, bounds output and terminates on timeout/cancellation', async () =>
  profile(async (configDir) => {
    const script = join(configDir, 'fixture.cjs')
    await writeFile(
      script,
      `
const mode = process.argv[2]
if (mode === 'echo') {
  let input = ''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => process.stdout.write(input))
} else if (mode === 'error') { process.stderr.write('SECRET_SOURCE_AND_TOKEN'); process.exitCode = 1 }
else if (mode === 'large') process.stdout.write('x'.repeat(1500001))
else if (mode === 'stderr') process.stderr.write('x'.repeat(1500001))
else setInterval(() => {}, 1000)
`,
    )
    const connection = { executable: process.execPath, configDir }
    const run = (mode: string, abortSignal = signal(), timeoutMs = 1000) =>
      runCursor(connection, {
        args: [script, mode],
        cwd: configDir,
        input: '$(echo injected); exact source',
        signal: abortSignal,
        timeoutMs,
      })
    assert.equal(await run('echo'), '$(echo injected); exact source')
    await assert.rejects(
      run('error'),
      (error: unknown) =>
        error instanceof Error &&
        !error.message.includes('SECRET') &&
        /CLI failed/.test(error.message),
    )
    await assert.rejects(run('large'), /too large/)
    await assert.rejects(run('stderr'), /too large/)
    await assert.rejects(run('wait', signal(), 30), /timed out/)
    const abort = new AbortController()
    const pending = run('wait', abort.signal)
    setTimeout(() => abort.abort(), 30)
    await assert.rejects(pending, /cancelled/)
    await assert.rejects(
      runCursor(
        { executable: '/nonexistent/spectra/agent', configDir },
        { args: [], cwd: configDir, signal: signal(), timeoutMs: 1000 },
      ),
      /Could not start/,
    )
  }))

test('Cursor generation survives the old CLI and panel deadlines and returns a complete response', async (t) =>
  profile(async (configDir) => {
    const script = join(configDir, 'slow-generation.cjs')
    await writeFile(
      script,
      `process.stdin.resume(); process.stdin.on('end', () => process.stdout.write(${JSON.stringify(envelope({ original, variants: demoVariants }))}));`,
    )
    t.mock.timers.enable({ apis: ['setTimeout'] })
    let cwd = ''
    let calls = 0
    const result = await generateWithCursor(
      { executable: process.execPath, configDir },
      'auto',
      input,
      signal(),
      async (connection, run) => {
        calls++
        cwd = run.cwd
        assert.equal(run.timeoutMs, CURSOR_GENERATION_TIMEOUT_MS)
        assert.match(run.timeoutMessage ?? '', /10 minutes/)
        const pending = runCursor(connection, { ...run, args: [script] })
        // Advance wall-clock deadlines while the real child process is still starting.
        t.mock.timers.tick(180001)
        return pending
      },
    )
    assert.equal(calls, 1, 'long requests must not trigger retries')
    assert.equal(result.original?.id, 'original')
    assert.equal(result.variants.length, 3)
    await assert.rejects(access(cwd))
  }))

test('Cursor still terminates at its full deadline, cleans up and does not recommend shrinking valid source', async (t) =>
  profile(async (configDir) => {
    const script = join(configDir, 'stalled-generation.cjs')
    await writeFile(script, 'process.stdin.resume(); setInterval(() => {}, 1000)')
    t.mock.timers.enable({ apis: ['setTimeout'] })
    let cwd = ''
    let calls = 0
    await assert.rejects(
      generateWithCursor(
        { executable: process.execPath, configDir },
        'auto',
        input,
        signal(),
        async (connection, run) => {
          calls++
          cwd = run.cwd
          const pending = runCursor(connection, { ...run, args: [script] })
          t.mock.timers.tick(CURSOR_GENERATION_TIMEOUT_MS + 500)
          return pending
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /timed out after 10 minutes/)
        assert.match(error.message, /canvas is unchanged/)
        assert.doesNotMatch(error.message, /smaller component/)
        return true
      },
    )
    assert.equal(calls, 1)
    await assert.rejects(access(cwd))
  }))

test('Cursor parameterized model IDs stay a single argument; malformed overrides never launch', async () =>
  profile(async (configDir) => {
    const model = 'claude-opus-4-8[context=1m,effort=high,fast=false]'
    let calls = 0
    const runner: CursorRunner = async (_connection, run) => {
      calls++
      assert.equal(run.args[run.args.indexOf('--model') + 1], model)
      return envelope({ original, variants: demoVariants })
    }
    const connection = { executable: '/unused/agent', configDir }
    await generateWithCursor(connection, model, input, signal(), runner)
    for (const invalid of [
      'auto --force',
      'auto[effort=high];echo',
      'auto[effort=$(id)]',
      'auto[]',
    ]) {
      await assert.rejects(
        generateWithCursor(connection, invalid, input, signal(), runner),
        /valid Cursor model/,
      )
    }
    assert.equal(calls, 1)
  }))

test('Cursor models load without a terminal or source, validate rows and clean up the temporary workspace', async () =>
  profile(async (configDir) => {
    let cwd = ''
    const models = await listCursorModels(
      { executable: '/unused/agent', configDir },
      signal(),
      async (_connection, run) => {
        cwd = run.cwd
        assert.deepEqual(run.args, ['--list-models'])
        assert.equal(run.input, undefined)
        assert.equal(run.timeoutMs, 20000)
        assert.notEqual(cwd, configDir)
        assert.deepEqual(await readdir(cwd), ['.cursor'])
        assert.deepEqual(
          JSON.parse(await readFile(join(cwd, '.cursor', 'cli.json'), 'utf8')).permissions,
          cursorPermissions,
        )
        return '\u001b[1mAvailable models\u001b[0m\r\n\r\nauto - Auto (default)\r\nmodel-a[effort=high] - Model A High\u200b\r\n\r\nUse --model to choose a model.\r\n'
      },
    )
    assert.deepEqual(models, [
      { id: 'auto', label: 'Auto (default)' },
      { id: 'model-a[effort=high]', label: 'Model A High' },
    ])
    await assert.rejects(access(cwd))
  }))

test('Cursor model discovery accepts large catalogs, including the 246-row CLI response', async () =>
  profile(async (configDir) => {
    for (const count of [246, 512]) {
      const expected = Array.from({ length: count }, (_, i) => ({
        id: `model-${i}`,
        label: `Model ${i}`,
      }))
      const models = await listCursorModels(
        { executable: '/unused/agent', configDir },
        signal(),
        async () =>
          'Available models\n' + expected.map(({ id, label }) => `${id} - ${label}`).join('\n'),
      )
      assert.deepEqual(models, expected)
    }
  }))

test('Cursor model discovery rejects malformed, duplicate, oversized and failed responses without leaking output', async () =>
  profile(async (configDir) => {
    const connection = { executable: '/unused/agent', configDir }
    for (const output of [
      '',
      'Account: private@example.test',
      'Available models\n',
      'Available models\nmodel-a - Model A\nmodel-a - Duplicate',
      'Available models\nmodel;bad - Model A',
      'Available models\nmodel-a - ' + 'x'.repeat(161),
      'Available models\nmodel-a - Contains\0control',
      'Available models\n' +
        Array.from({ length: 513 }, (_, i) => `model-${i} - Model ${i}`).join('\n'),
      'Available models\n' + 'x'.repeat(100001),
    ]) {
      let cwd = ''
      await assert.rejects(
        listCursorModels(connection, signal(), async (_connection, run) => {
          cwd = run.cwd
          return output
        }),
        /Could not load Cursor models/,
      )
      await assert.rejects(access(cwd))
    }
    await assert.rejects(
      listCursorModels(connection, signal(), async () => {
        throw new Error('SECRET_ACCOUNT_DETAILS')
      }),
      (error: unknown) =>
        error instanceof Error &&
        !error.message.includes('SECRET') &&
        /unchanged/.test(error.message),
    )
    const abort = new AbortController()
    abort.abort()
    let calls = 0
    await assert.rejects(
      listCursorModels(connection, abort.signal, async () => {
        calls++
        return 'Available models\nauto - Auto'
      }),
      /cancelled/,
    )
    assert.equal(calls, 0)
    const late = new AbortController()
    await assert.rejects(
      listCursorModels(connection, late.signal, async () => {
        late.abort()
        return 'Available models\nauto - Auto'
      }),
      /cancelled/,
    )
  }))
