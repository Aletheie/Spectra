import { test, expect } from '@playwright/test'
import { demoVariants, original } from '../../src/variants'
import { demoResult } from '../../src/domain/demo'
import { documentFor } from '../../src/domain/document'

test('curated text and CTA meet 4.5:1 contrast at a readable minimum size', async ({ page }) => {
  const samples = [
    original,
    ...demoVariants,
    demoResult('refine', [demoVariants[1]], 'minimal')[0],
    demoResult('remix', [demoVariants[0], demoVariants[2]], 'combine')[0],
  ]
  let minimum = Infinity
  for (const variant of samples) {
    await page.setContent(
      '<iframe sandbox="allow-scripts" style="width:375px;height:900px"></iframe>',
    )
    await page.locator('iframe').evaluate((frame, html) => {
      ;(frame as HTMLIFrameElement).srcdoc = html
    }, documentFor(variant))
    const frame = page.frameLocator('iframe')
    await expect(frame.locator('.cta')).toBeVisible()
    for (const monthly of [false, true]) {
      if (monthly) await frame.getByRole('button', { name: 'Monthly', exact: true }).click()
      const values = await frame.locator('body').evaluate((body) => {
        const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number)
        const luminance = (color: number[]) =>
          color
            .slice(0, 3)
            .map((value) => value / 255)
            .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
            .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
        return [...body.querySelectorAll<HTMLElement>('*')]
          .filter(
            (element) =>
              [...element.childNodes].some(
                (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
              ) && element.getClientRects().length > 0,
          )
          .map((element) => {
            const style = getComputedStyle(element)
            let current: Element | null = element
            let background = [255, 255, 255]
            while (current) {
              const candidate = rgb(getComputedStyle(current).backgroundColor)
              if (candidate.length === 3 || candidate[3] === 1) {
                background = candidate
                break
              }
              current = current.parentElement
            }
            const foreground = luminance(rgb(style.color))
            const back = luminance(background)
            return {
              text: element.textContent?.trim().slice(0, 70),
              contrast: (Math.max(foreground, back) + 0.05) / (Math.min(foreground, back) + 0.05),
              size: Number.parseFloat(style.fontSize),
            }
          })
      })
      for (const value of values) {
        expect(value.contrast, `${variant.name}: ${value.text}`).toBeGreaterThanOrEqual(4.5)
        expect(value.size, `${variant.name}: ${value.text}`).toBeGreaterThanOrEqual(12)
        minimum = Math.min(minimum, value.contrast)
      }
    }
  }
  console.log(`Curated minimum measured contrast: ${minimum.toFixed(2)}:1; text at least 12px`)
})
