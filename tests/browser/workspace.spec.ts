import { test, expect, type Page } from '@playwright/test'
import { demoVariants, original } from '../../src/variants'
import { demoResult } from '../../src/domain/demo'
import { withLineage } from '../../src/domain/lineage'
import { initialEditorState, type EditorState, type EditorRequest } from '../../src/domain/protocol'
import type { Variant } from '../../src/domain/types'
import { documentFor } from '../../src/domain/document'

const sample = async (page: Page) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try curated sample' }).click()
  await page.getByRole('button', { name: 'Generate 3 directions' }).click()
  await expect(page.locator('.variant-card')).toHaveCount(4)
}

type MockHost = {
  state: EditorState
  requests: EditorRequest[]
  pending: EditorRequest | null
  emit: () => void
  finish: (options?: { variants?: Variant[]; error?: string; cancelled?: boolean }) => void
}
type TestWindow = Window & {
  __spectraTest: MockHost
  acquireVsCodeApi: () => { postMessage: (request: EditorRequest) => void }
}
const mockHost = async (
  page: Page,
  options: { configured?: boolean; variants?: Variant[] } = {},
) => {
  const state: EditorState = {
    ...initialEditorState,
    original,
    variants: options.variants ?? withLineage(demoVariants, [], 'generate'),
    baselineKind: 'reconstructed',
    source: {
      id: 'snapshot',
      relativePath: 'src/Card.tsx',
      language: 'typescriptreact',
      code: '<button>Save</button>',
      startLine: 1,
      endLine: 1,
      selection: true,
    },
    providers: [
      {
        id: 'openai',
        label: 'OpenAI',
        model: 'test-model',
        configured: options.configured ?? true,
      },
    ],
    trusted: true,
    intent: 'Make the primary action clearer',
  }
  await page.addInitScript((initial) => {
    const host: MockHost = {
      state: initial,
      requests: [],
      pending: null,
      emit: () => window.postMessage({ type: 'state', state: host.state }, '*'),
      finish: (result = {}) => {
        const request = host.pending
        if (!request) throw new Error('No pending request')
        host.state = {
          ...host.state,
          busy: false,
          activity: null,
          variants: result.variants ?? host.state.variants,
        }
        host.emit()
        window.postMessage(
          {
            type: 'response',
            id: request.id,
            ok: !result.error && !result.cancelled,
            error: result.error,
            cancelled: result.cancelled,
          },
          '*',
        )
        host.pending = null
      },
    }
    ;(window as TestWindow).__spectraTest = host
    ;(window as TestWindow).acquireVsCodeApi = () => ({
      postMessage: (request: EditorRequest) => {
        host.requests.push(request)
        if (request.command === 'getState') {
          host.emit()
          window.postMessage({ type: 'response', id: request.id, ok: true }, '*')
          return
        }
        if (request.command === 'cancelGeneration') {
          host.finish({ cancelled: true, error: 'Generation cancelled. Your canvas is unchanged.' })
          window.postMessage({ type: 'response', id: request.id, ok: true }, '*')
          return
        }
        host.pending = request
        host.state = {
          ...host.state,
          busy: true,
          activity: {
            command: request.command,
            phase: request.command === 'generate' ? 'confirming' : 'running',
          },
        }
        host.emit()
      },
    })
  }, state)
  await page.goto('/')
  await expect(page.locator('.variant-card')).toHaveCount(state.variants.length + 1)
}

test('all ordered curated remixes have one plan and coherent monthly/yearly billing', async ({
  page,
}) => {
  const variants = [...demoVariants, demoResult('refine', [demoVariants[2]], 'minimal')[0]]
  for (const first of variants)
    for (const second of variants) {
      if (first.id === second.id) continue
      const result = demoResult('remix', [first, second], 'combine')[0]
      await page.setContent(`<iframe sandbox="allow-scripts"></iframe>`)
      await page.locator('iframe').evaluate((frame, html) => {
        ;(frame as HTMLIFrameElement).srcdoc = html
      }, documentFor(result))
      const frame = page.frameLocator('iframe')
      await expect(frame.locator('main.page')).toHaveCount(1)
      await expect(frame.locator('.plan')).toHaveCount(1)
      await expect(frame.locator('.cta')).toHaveCount(1)
      await frame.getByRole('button', { name: 'Monthly', exact: true }).click()
      await expect(frame.locator('[data-price]')).toHaveText('$30')
      await expect(frame.locator('[data-total]')).toHaveText('Billed monthly · $30 per month')
      if (await frame.locator('[data-saving]').count()) {
        await expect(frame.locator('[data-saving]')).toContainText('Switch to yearly to save $72')
        await expect(frame.locator('[data-saving]')).not.toContainText('Yearly selected')
      }
      await frame.getByRole('button', { name: 'Yearly · save 20%' }).click()
      await expect(frame.locator('[data-price]')).toHaveText('$24')
      await expect(frame.locator('[data-total]')).toContainText('$288 total')
      await frame.locator('.cta').click()
      await expect(frame.locator('.status')).toContainText('no trial or account was created')
    }
})

test('Choose preserves the interactive preview and selected cards remain marked', async ({
  page,
}) => {
  await sample(page)
  const card = page.locator('.variant-card').nth(3)
  const frame = card.frameLocator('iframe')
  await frame.getByRole('button', { name: 'Monthly', exact: true }).click()
  await card.getByRole('button', { name: 'Choose', exact: true }).click()
  await expect(frame.locator('[data-price]')).toHaveText('$30')
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(card.locator('.selected-marker')).toHaveText('Selected')
  await expect(frame.locator('[data-price]')).toHaveText('$30')
})

test('refinement keyboard shortcut reveals a version with provenance; regeneration is explicit', async ({
  page,
}) => {
  await sample(page)
  await page.setViewportSize({ width: 720, height: 800 })
  await page
    .locator('.variant-card')
    .nth(1)
    .getByRole('button', { name: 'Refine', exact: true })
    .click()
  await page.getByLabel('What should change?').fill('Make it more minimal')
  await page.getByLabel('What should change?').press('Control+Enter')
  const revision = page.locator('.variant-card').last()
  await expect(revision).toBeVisible()
  await expect(revision.locator('.card-details')).toContainText('A → A v2')
  await expect(revision.getByRole('button', { name: 'Choose', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'New comparison', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('replace all 4 directions')
  await page.getByRole('button', { name: 'Keep comparison' }).click()
  await expect(page.locator('.variant-card')).toHaveCount(5)
})

test('third remix selection cannot silently evict either ordered source', async ({ page }) => {
  await sample(page)
  await page.getByRole('button', { name: 'Remix two…', exact: true }).click()
  const boxes = page.locator('.remix-checkbox input')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await expect(boxes.nth(2)).toBeDisabled()
  await expect(boxes.nth(0)).toBeChecked()
  await expect(boxes.nth(1)).toBeChecked()
  await expect(page.locator('.remix-bar')).toContainText('1 · Layout')
  await page.getByRole('button', { name: 'Remix 2/2' }).click()
  await page.getByLabel('What should change?').press('Control+Enter')
  await expect(page.locator('.variant-card')).toHaveCount(5)
})

test('delayed generation retires an expanded obsolete variant and distinguishes confirmation', async ({
  page,
}) => {
  await mockHost(page)
  await page.getByRole('button', { name: 'New comparison…' }).click()
  await page.getByRole('button', { name: 'Replace directions' }).click()
  await expect(page.locator('.activity-row')).toContainText('Waiting for your confirmation')
  await page.getByRole('button', { name: `Expand ${demoVariants[0].name}`, exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const next = withLineage(
    demoVariants.map((variant) => ({ ...variant, id: `new-${variant.id}` })),
    [],
    'generate',
  )
  await page.evaluate((variants) => (window as TestWindow).__spectraTest.finish({ variants }), next)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.chosen-card')).toHaveCount(0)
})

test('copy, export errors, cancellation and provider configuration stay scoped', async ({
  page,
}) => {
  await mockHost(page)
  await page
    .locator('.variant-card')
    .nth(1)
    .getByRole('button', { name: 'Choose', exact: true })
    .click()
  await page.getByRole('button', { name: 'Copy for Cursor', exact: true }).click()
  await expect(page.locator('.activity-row')).toContainText('Copying')
  await expect(page.locator('.activity-row')).not.toContainText('Generating')
  await page.evaluate(() =>
    (window as TestWindow).__spectraTest.finish({ error: 'Clipboard unavailable' }),
  )
  await expect(page.locator('.chosen-toolbar')).toContainText('Clipboard unavailable')
  await page.getByRole('button', { name: 'Refine selected' }).click()
  await expect(page.locator('.refinement-panel')).not.toContainText('Clipboard unavailable')
  await expect(page.getByLabel('What should change?')).not.toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('What should change?').fill('Keep the title')
  await page.getByLabel('What should change?').press('Control+Enter')
  await page.getByRole('button', { name: 'Cancel generation' }).click()
  await expect(page.locator('.refinement-panel [role=alert]')).toHaveCount(0)
  await expect(page.getByLabel('What should change?')).toHaveValue('Keep the title')
  await page.getByRole('button', { name: 'Close refinement' }).click()
  await page.getByRole('button', { name: 'AI providers', exact: true }).click()
  await page.getByRole('button', { name: 'Manage key' }).click()
  await expect(page.locator('.activity-row')).toContainText('Provider setup')
  await expect(page.locator('.activity-row')).not.toContainText('Generating')
  await page.evaluate(() => (window as TestWindow).__spectraTest.finish())
})

test('unconfigured refinement explains recovery and preserves its draft through settings', async ({
  page,
}) => {
  await mockHost(page, { configured: false })
  await page
    .locator('.variant-card')
    .nth(1)
    .getByRole('button', { name: 'Refine', exact: true })
    .click()
  await page.getByLabel('What should change?').fill('Keep this draft')
  await expect(page.getByRole('button', { name: 'Create revision' })).toBeDisabled()
  await expect(page.locator('.refinement-panel')).toContainText(/Connect Cursor CLI|Add a key/)
  await page.locator('.refinement-panel').getByRole('button', { name: 'AI providers' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close AI providers' }).click()
  await expect(page.getByLabel('What should change?')).toHaveValue('Keep this draft')
})

test('long hypotheses keep previews aligned and narrow layouts expose the primary actions', async ({
  page,
}, testInfo) => {
  await mockHost(page, {
    variants: withLineage(
      demoVariants.map((variant, index) => ({
        ...variant,
        hypothesis:
          index === 1
            ? 'A valid long explanation of hierarchy and layout. '.repeat(20)
            : variant.hypothesis,
      })),
      [],
      'generate',
    ),
  })
  await page.getByRole('button', { name: 'Collapse', exact: true }).click()
  const tops = await page
    .locator('.variant-card iframe')
    .evaluateAll((frames) => frames.map((frame) => frame.getBoundingClientRect().top))
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2)
  console.log(
    `Aligned comparison previews start at y=${Math.round(tops[0])}px in the simulated host.`,
  )
  await page.screenshot({ path: testInfo.outputPath('comparison-wide.png') })
  for (const width of [1440, 720, 600, 360]) {
    await page.setViewportSize({ width, height: 800 })
    const choice = page
      .locator('.variant-card')
      .nth(1)
      .getByRole('button', { name: 'Choose', exact: true })
    await expect(choice).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
  }
  await page
    .locator('.variant-card')
    .nth(1)
    .getByRole('button', { name: 'Choose', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Copy for Cursor', exact: true })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Save HTML', exact: true })).toBeInViewport()
  await page.setViewportSize({ width: 600, height: 900 })
  await page.screenshot({ path: testInfo.outputPath('selected-narrow.png') })
})

test('broken preview reports an advisory error without escaping the iframe', async ({ page }) => {
  await mockHost(page, {
    variants: withLineage(
      demoVariants.map((variant, index) => ({
        ...variant,
        js: index === 1 ? 'throw new Error("test")' : variant.js,
      })),
      [],
      'generate',
    ),
  })
  await expect(page.locator('.variant-card').nth(2).locator('.preview-issue')).toContainText(
    'script error',
  )
  await expect(page.locator('.variant-card').nth(2).locator('iframe')).toHaveAttribute(
    'sandbox',
    'allow-scripts',
  )
  await expect(page.locator('.variant-card').nth(1).locator('.preview-issue')).toHaveCount(0)
})

test('fixed width is real and changing viewport controls preserves local state', async ({
  page,
}) => {
  await sample(page)
  await page.setViewportSize({ width: 720, height: 800 })
  const card = page.locator('.variant-card').nth(1)
  await card.frameLocator('iframe').getByRole('button', { name: 'Monthly', exact: true }).click()
  await page.locator('.preview-settings summary').click()
  await page.getByLabel('Width', { exact: true }).selectOption('375')
  await expect.poll(() => card.locator('iframe').evaluate((frame) => frame.clientWidth)).toBe(375)
  await expect(card.locator('.preview-dimensions')).toContainText('375 ×')
  await expect(card.frameLocator('iframe').locator('[data-price]')).toHaveText('$30')
})

test('diagnostics distinguish empty markup from plain text and a revealed preview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 800 })
  await mockHost(page, {
    variants: withLineage(
      demoVariants.map((variant, index) => ({
        ...variant,
        html:
          index === 0
            ? 'Plain text content'
            : index === 1
              ? '<span hidden>Hidden content</span>'
              : variant.html,
        js: '',
      })),
      [],
      'generate',
    ),
  })
  const first = page.locator('.variant-card').nth(1)
  await expect(first.frameLocator('iframe').locator('body')).toHaveText('Plain text content')
  await expect(first.locator('.preview-issue')).toHaveCount(0)
  await page
    .locator('.direction-navigation')
    .getByRole('button', { name: 'B', exact: true })
    .click()
  await expect(page.locator('.variant-card').nth(2).locator('.preview-issue')).toContainText(
    'No visible content',
  )
  await page
    .locator('.direction-navigation')
    .getByRole('button', { name: 'C', exact: true })
    .click()
  const third = page.locator('.variant-card').nth(3)
  await expect(third).toBeVisible()
  await expect(third.locator('.preview-issue')).toHaveCount(0)
})

test('large session profile: typing and status deltas retain loaded previews', async ({ page }) => {
  const large = Array.from({ length: 15 }, (_, index) => ({
    ...demoVariants[index % 3],
    id: `large-${index}`,
    html: demoVariants[index % 3].html + '<!--' + 'x'.repeat(60000) + '-->',
    css: demoVariants[index % 3].css + '/*' + 'x'.repeat(60000) + '*/',
    js: demoVariants[index % 3].js + '\n/*' + 'x'.repeat(30000) + '*/',
  }))
  await mockHost(page, { variants: large })
  await expect(page.locator('.variant-card iframe')).toHaveCount(16)
  const handles = await page.locator('.variant-card iframe').elementHandles()
  const started = Date.now()
  await page
    .locator('#intent')
    .pressSequentially(' Please improve the action hierarchy and spacing.')
  const elapsed = Date.now() - started
  const payloadSizes = await page.evaluate(() => {
    const state = (window as TestWindow).__spectraTest.state
    const status = { providers: state.providers, busy: false, activity: null, trusted: true }
    window.postMessage({ type: 'status', status }, '*')
    return {
      full: JSON.stringify({ type: 'state', state }).length,
      delta: JSON.stringify({ type: 'status', status }).length,
    }
  })
  for (const handle of handles)
    expect(await handle.evaluate((frame) => frame.isConnected)).toBe(true)
  expect(payloadSizes.delta).toBeLessThan(1000)
  console.log(
    `Large-session diagnostic: ${elapsed}ms for 48 typed characters; full state ${payloadSizes.full} chars vs status ${payloadSizes.delta} chars. Not a cross-machine benchmark.`,
  )
})
