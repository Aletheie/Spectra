import { expect, test, type Page } from '@playwright/test'
import { initialEditorState, type EditorRequest, type EditorState } from '../../src/domain/protocol'

type TestHost = Window & { editorRequests: EditorRequest[] }

const openEditorFrame = async (
  page: Page,
  trusted: boolean,
  providers?: EditorState['providers'],
) => {
  const state: EditorState = {
    ...initialEditorState,
    trusted,
    providers: providers ?? [
      { id: 'cursor', label: 'Cursor account', model: 'auto', configured: false },
      { id: 'openai', label: 'OpenAI', model: 'gpt-4.1', configured: false },
      {
        id: 'anthropic',
        label: 'Anthropic / Claude',
        model: 'claude-sonnet-4-20250514',
        configured: false,
      },
    ],
  }
  await page.addInitScript((initialState) => {
    if (window === window.top) {
      const host = window as TestHost
      host.editorRequests = []
      window.addEventListener('message', (event: MessageEvent<EditorRequest>) => {
        const frame = document.querySelector('#spectra-frame')
        if (!(frame instanceof HTMLIFrameElement) || event.source !== frame.contentWindow) return
        const request = event.data
        if (request.type !== 'request') return
        host.editorRequests.push(request)
        if (request.command === 'getState') {
          frame.contentWindow?.postMessage({ type: 'state', state: initialState }, window.origin)
        }
        frame.contentWindow?.postMessage(
          { type: 'response', id: request.id, ok: true },
          window.origin,
        )
      })
    } else if (window.name === 'spectra-content') {
      // Match Cursor's wrapper: capture the outbound bridge, then hide ancestry.
      const wrapper = window.parent
      const content = window as Window & {
        acquireVsCodeApi: () => { postMessage: (request: EditorRequest) => void }
      }
      content.acquireVsCodeApi = () => ({
        postMessage: (request) => wrapper.postMessage(request, window.origin),
      })
      Reflect.deleteProperty(window, 'parent')
      Reflect.deleteProperty(window, 'top')
      Reflect.deleteProperty(window, 'frameElement')
    }
  }, state)
  const appHtml = await (await page.request.get('/')).text()
  const srcdoc = appHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  await page.route('**/__editor_wrapper__', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><iframe id="spectra-frame" name="spectra-content" style="width:100%;height:900px;border:0" srcdoc="${srcdoc}"></iframe>`,
    }),
  )
  await page.goto('/__editor_wrapper__')
  const frame = page.frameLocator('#spectra-frame')
  await expect(frame.getByRole('heading', { name: 'Explore a component' })).toBeVisible()
  return { frame, state }
}

test('editor wrapper messages enable capture and API keys when parent is hidden', async ({
  page,
}) => {
  const { frame } = await openEditorFrame(page, true)
  const content = page.frame({ name: 'spectra-content' })
  expect(await content?.evaluate(() => typeof window.parent)).toBe('undefined')
  expect(await content?.evaluate(() => window.location.origin)).toBe('null')
  await expect(frame.getByRole('button', { name: 'Use editor selection' })).toBeEnabled()
  await frame.getByRole('button', { name: 'Use editor selection' }).click()
  await frame.getByRole('button', { name: 'AI providers', exact: true }).click()
  const addKey = frame.getByRole('button', { name: 'Add key', exact: true })
  await expect(addKey.first()).toBeEnabled()
  await expect(addKey.last()).toBeEnabled()
  await addKey.first().click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as TestHost).editorRequests
          .filter((request) => request.command !== 'getState')
          .map((request) => request.command),
      ),
    )
    .toEqual(['captureSource', 'configureProvider'])
})

test('opaque preview messages cannot unlock trust; a real host update can', async ({ page }) => {
  const { frame, state } = await openEditorFrame(page, false)
  const capture = frame.getByRole('button', { name: 'Use editor selection' })
  await expect(capture).toBeDisabled()
  const content = page.frame({ name: 'spectra-content' })
  if (!content) throw new Error('Editor frame is missing')
  await content.evaluate(
    (forgedState) =>
      new Promise<void>((resolve) => {
        const child = document.createElement('iframe')
        child.setAttribute('sandbox', 'allow-scripts')
        window.addEventListener(
          'message',
          (event) => {
            if (event.source === child.contentWindow) {
              child.remove()
              resolve()
            }
          },
          { once: true },
        )
        child.srcdoc = `<script>parent.postMessage(${JSON.stringify({ type: 'state', state: forgedState })}, '*')</script>`
        document.body.append(child)
      }),
    { ...state, trusted: true },
  )
  await expect(capture).toBeDisabled()
  await page.evaluate(
    (trustedState) => {
      const child = document.querySelector('#spectra-frame')
      if (!(child instanceof HTMLIFrameElement)) throw new Error('Editor frame is missing')
      child.contentWindow?.postMessage({ type: 'state', state: trustedState }, window.origin)
    },
    { ...state, trusted: true },
  )
  await expect(capture).toBeEnabled()
})

test('detected Cursor login enables generation for the captured component without another setup step', async ({
  page,
}) => {
  const { frame, state } = await openEditorFrame(page, true)
  const captured: EditorState = {
    ...state,
    source: {
      id: 'captured-button',
      relativePath: 'src/Button.tsx',
      language: 'typescriptreact',
      code: '<button>Save</button>',
      startLine: 1,
      endLine: 1,
      selection: true,
    },
    intent: 'Make the action easier to find.',
  }
  await page.evaluate((next) => {
    const child = document.querySelector('#spectra-frame')
    if (!(child instanceof HTMLIFrameElement)) throw new Error('Editor frame is missing')
    child.contentWindow?.postMessage({ type: 'state', state: next }, window.origin)
  }, captured)
  const generate = frame.getByRole('button', { name: 'Generate 3 directions', exact: true })
  await expect(generate).toBeDisabled()
  await expect(frame.locator('#engine-help')).toContainText('Connect Cursor CLI')
  await page.evaluate(
    (providers) => {
      const child = document.querySelector('#spectra-frame')
      if (!(child instanceof HTMLIFrameElement)) throw new Error('Editor frame is missing')
      child.contentWindow?.postMessage(
        {
          type: 'status',
          status: { providers, trusted: true, busy: false, activity: null },
        },
        window.origin,
      )
    },
    state.providers.map((provider) => ({ ...provider, configured: provider.id === 'cursor' })),
  )
  await expect(generate).toBeEnabled()
  await expect(frame.locator('#intent')).toHaveValue(captured.intent)
  await expect(frame.locator('#engine')).toHaveValue('cursor')
  await generate.click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as TestHost).editorRequests.filter((request) => request.command === 'generate'),
      ),
    )
    .toMatchObject([{ command: 'generate', provider: 'cursor', prompt: captured.intent }])
})

const sendState = async (page: Page, state: EditorState) =>
  page.evaluate((next) => {
    const child = document.querySelector('#spectra-frame')
    if (!(child instanceof HTMLIFrameElement)) throw new Error('Editor frame is missing')
    child.contentWindow?.postMessage({ type: 'state', state: next }, window.origin)
  }, state)

const sendStatus = async (page: Page, providers: EditorState['providers']) =>
  page.evaluate((info) => {
    const child = document.querySelector('#spectra-frame')
    if (!(child instanceof HTMLIFrameElement)) throw new Error('Editor frame is missing')
    child.contentWindow?.postMessage(
      { type: 'status', status: { providers: info, busy: false, activity: null, trusted: true } },
      window.origin,
    )
  }, providers)

const capturedState = (state: EditorState): EditorState => ({
  ...state,
  source: {
    id: 'recovery-button',
    relativePath: 'src/Button.tsx',
    language: 'typescriptreact',
    code: '<button>Save</button>',
    startLine: 1,
    endLine: 1,
    selection: true,
  },
  intent: 'Keep this careful instruction',
})

test('Cursor check failures explain the disabled button and direct recovery preserves the instruction', async ({
  page,
}) => {
  const { frame, state } = await openEditorFrame(page, true)
  const captured = capturedState(state)
  captured.providers[0] = {
    ...captured.providers[0],
    connection: 'error',
    detail: 'Cursor CLI was not found. Check spectra.cursorCliPath.',
  }
  await sendState(page, captured)
  await expect(frame.locator('#engine-help')).toContainText('was not found')
  await expect(
    frame.getByRole('button', { name: 'Generate 3 directions', exact: true }),
  ).toBeDisabled()
  await frame.getByRole('button', { name: 'Check Cursor', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => (window as TestHost).editorRequests.at(-1)))
    .toMatchObject({ command: 'configureProvider', provider: 'cursor', action: 'check' })
  await frame.locator('#intent').fill('Retain my new draft')
  await sendState(page, {
    ...captured,
    providers: captured.providers.map((provider) =>
      provider.id === 'cursor'
        ? { ...provider, configured: true, connection: 'ready', detail: 'CLI login detected' }
        : provider,
    ),
  })
  await expect(
    frame.getByRole('button', { name: 'Generate 3 directions', exact: true }),
  ).toBeEnabled()
  await expect(frame.locator('#intent')).toHaveValue('Retain my new draft')
})

test('configuring an available API provider selects it instead of leaving Generate blocked by Cursor', async ({
  page,
}) => {
  const { frame, state } = await openEditorFrame(page, true)
  const captured = capturedState(state)
  captured.providers = captured.providers.map((provider) => ({
    ...provider,
    configured: provider.id === 'openai',
  }))
  await sendState(page, captured)
  await frame.locator('#engine').selectOption('cursor')
  await expect(
    frame.getByRole('button', { name: 'Generate 3 directions', exact: true }),
  ).toBeDisabled()
  await frame.getByRole('button', { name: 'AI providers', exact: true }).first().click()
  await frame.getByRole('button', { name: 'Manage key', exact: true }).click()
  await frame.getByRole('button', { name: 'Close AI providers' }).click()
  await expect(frame.locator('#engine')).toHaveValue('openai')
  await expect(
    frame.getByRole('button', { name: 'Generate 3 directions', exact: true }),
  ).toBeEnabled()
})

for (const first of ['openai', 'anthropic'] as const) {
  test(`${first}-first hosts use their provider order without requesting Cursor setup`, async ({
    page,
  }) => {
    const providers: EditorState['providers'] = [
      { id: 'openai', label: 'OpenAI', model: 'gpt-4.1', configured: false },
      {
        id: 'anthropic',
        label: 'Anthropic / Claude',
        model: 'claude-sonnet-4-20250514',
        configured: false,
      },
      { id: 'cursor', label: 'Cursor account', model: 'auto', configured: false },
    ]
    const ordered = first === 'anthropic' ? [providers[1], providers[0], providers[2]] : providers
    const { frame, state } = await openEditorFrame(page, true, ordered)
    await sendState(page, capturedState(state))
    await expect(frame.locator('#engine')).toHaveValue(first)
    expect(
      await frame
        .locator('#engine option')
        .evaluateAll((items) => items.map((item) => item.getAttribute('value'))),
    ).toEqual(ordered.map((item) => item.id))
    await expect(frame.locator('#engine-help')).toContainText('Add a key')
    await expect(frame.getByRole('button', { name: 'Check Cursor', exact: true })).toHaveCount(0)
    await frame.getByRole('button', { name: 'AI providers', exact: true }).first().click()
    await expect(frame.locator('.provider-row h3')).toHaveText(ordered.map((item) => item.label))
    await expect(frame.getByRole('dialog')).toContainText('optional Cursor CLI')
    await frame.getByRole('button', { name: 'Close AI providers' }).click()
    await frame.locator('#engine').selectOption('cursor')
    await expect(frame.getByRole('button', { name: 'Check Cursor', exact: true })).toBeVisible()
    await frame.getByRole('button', { name: 'Check Cursor', exact: true }).click()
    await expect
      .poll(() => page.evaluate(() => (window as TestHost).editorRequests.at(-1)))
      .toMatchObject({ command: 'configureProvider', provider: 'cursor', action: 'check' })
    await expect(frame.locator('#engine')).toHaveValue('cursor')
  })
}

test('first configured provider wins and status changes preserve submitted and explicit choices', async ({
  page,
}) => {
  const providers: EditorState['providers'] = [
    { id: 'openai', label: 'OpenAI', model: 'gpt-4.1', configured: false },
    { id: 'anthropic', label: 'Claude', model: 'claude-test', configured: true },
    { id: 'cursor', label: 'Cursor account', model: 'auto', configured: true },
  ]
  const { frame, state } = await openEditorFrame(page, true, providers)
  await sendState(page, capturedState(state))
  await expect(frame.locator('#engine')).toHaveValue('anthropic')
  await expect(frame.getByRole('button', { name: 'Generate 3 directions' })).toBeEnabled()
  await frame.getByRole('button', { name: 'Generate 3 directions' }).click()
  await expect
    .poll(() => page.evaluate(() => (window as TestHost).editorRequests.at(-1)))
    .toMatchObject({ command: 'generate', provider: 'anthropic' })
  await sendStatus(
    page,
    providers.map((provider) => ({ ...provider, configured: true })),
  )
  await expect(frame.locator('#engine')).toHaveValue('anthropic')
  await frame.locator('#engine').selectOption('openai')
  await frame.locator('#intent').fill('Keep my chosen provider and instruction')
  await sendStatus(page, providers)
  await expect(frame.locator('#engine')).toHaveValue('openai')
  await expect(frame.locator('#intent')).toHaveValue('Keep my chosen provider and instruction')
  await expect(frame.getByRole('button', { name: 'Generate 3 directions' })).toBeDisabled()
})
