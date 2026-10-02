import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createPreviewStyler } from '../../extension/preview-styles'
import { documentFor, exportDocument } from '../../src/domain/document'
import { original } from '../../src/variants'

const require = createRequire(import.meta.url)
const [theme, preflight] = await Promise.all([
  readFile(require.resolve('tailwindcss/theme.css'), 'utf8'),
  readFile(require.resolve('tailwindcss/preflight.css'), 'utf8'),
])

test('utility previews are styled under inherited CSP, stay local and export the same design', async ({
  page,
}) => {
  const prepare = createPreviewStyler(
    `@layer theme,base,utilities; @layer theme{${theme}} @layer base{${preflight}} @layer utilities{@tailwind utilities;}`,
  )
  const styled = await prepare({
    ...original,
    html: '<button class="m-4 rounded-lg bg-blue-600 px-4 py-2 text-white">Save</button><p class="hidden p-4" role="status">Saved locally</p>',
    css: 'body{font-family:system-ui}',
    js: "document.querySelector('button').addEventListener('click', () => document.querySelector('[role=status]').classList.remove('hidden'));",
  })
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.setContent(
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-test'; frame-src about:; connect-src 'none';"><iframe sandbox="allow-scripts" title="Styled preview"></iframe>`,
  )
  await page.locator('iframe').evaluate(
    (element, html) => {
      if (element instanceof HTMLIFrameElement) element.srcdoc = html
    },
    documentFor(styled, true, 'test'),
  )
  const frame = page.frameLocator('iframe')
  const button = frame.getByRole('button', { name: 'Save' })
  await expect(button).toHaveCSS('padding-left', '16px')
  await expect(button).toHaveCSS('border-top-left-radius', '8px')
  await expect(button).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(frame.getByRole('status')).not.toBeVisible()
  await button.click()
  await expect(frame.getByRole('status')).toBeVisible()
  await page.goto('about:blank')
  await page.setContent(exportDocument(styled))
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCSS('padding-left', '16px')
  expect(requests).toEqual([])
})
