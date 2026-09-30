import { expect, test, type Page } from '@playwright/test'
import { initialEditorState, type EditorRequest, type EditorState } from '../../src/domain/protocol'

type TestHost = Window & { editorRequests: EditorRequest[] }

const openEditorFrame = async (page: Page, trusted: boolean) => {
  const state: EditorState = {
    ...initialEditorState,
    trusted,
    providers: [
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
