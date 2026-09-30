import { expect, test } from '@playwright/test'

test('booking keeps prices, validation, local confirmation and focus', async ({ page }) => {
  await page.goto('/booking.html')
  const submit = page.getByRole('button', { name: 'Vyzkoušet rezervaci' })
  const total = page.getByLabel('Celková cena')
  await expect(total).toHaveText('390 Kč')
  await submit.click()
  await expect(page.getByLabel('Jméno pro rezervaci')).toBeFocused()
  await expect(page.getByLabel('Jméno pro rezervaci')).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('Jméno pro rezervaci').fill('Alex')
  await page.getByLabel('Dospělí').selectOption('2')
  await page.getByLabel('Děti 6–15 let').selectOption('1')
  await page.getByLabel('Termoska čaje').check()
  await expect(total).toHaveText('1 010 Kč')
  await page.getByLabel('Dospělí').selectOption('6')
  await expect(page.getByRole('alert')).toContainText('nejvýše 6 osob')
  await submit.click()
  await expect(page.getByLabel('Děti 6–15 let')).toBeFocused()
  await expect(page.getByRole('region', { name: 'Takto by vypadalo potvrzení' })).toHaveCount(0)
  await page.getByLabel('Dospělí').selectOption('2')
  await page.getByLabel('Termín', { exact: true }).selectOption('17. října 2026 v 19:30')
  await expect(page.locator('option[value="full"]')).toBeDisabled()
  await submit.click()
  const result = page.getByRole('region', { name: 'Takto by vypadalo potvrzení' })
  await expect(result).toContainText('17. října 2026 v 19:30')
  await expect(result).toContainText('1 010 Kč')
  await expect(result).toContainText('žádná rezervace nevznikla')
  await expect(result).toBeFocused()
  await page.getByRole('button', { name: 'Upravit údaje' }).click()
  await expect(page.getByLabel('Termín', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Jméno pro rezervaci')).toHaveValue('Alex')
  await expect(total).toHaveText('1 010 Kč')
  await page.reload()
  await expect(total).toHaveText('390 Kč')
  await expect(page.getByLabel('Jméno pro rezervaci')).toBeEmpty()
})

test('observation filters preserve progress and move focus when an item disappears', async ({
  page,
}) => {
  await page.goto('/observation-list.html')
  const list = page.getByRole('list', { name: 'Objekty k pozorování' })
  await page.getByLabel('Najít objekt').fill('mesic')
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).toContainText('Měsíc')
  await page.getByRole('button', { name: 'Zbývá', exact: true }).click()
  // In the remaining filter the clicked checkbox is immediately unmounted.
  await list.getByRole('checkbox').click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1')
  await expect(page.getByRole('button', { name: 'Zbývá', exact: true })).toBeFocused()
  await expect(page.getByText('Tomuto filtru neodpovídá žádný objekt.')).toBeVisible()
  await page.getByRole('button', { name: 'Zobrazit všechny objekty' }).click()
  await expect(page.getByLabel('Najít objekt')).toBeFocused()
  await expect(list.getByRole('checkbox').first()).toBeChecked()
  await page.getByRole('button', { name: 'Zbývá', exact: true }).click()
  await list.getByRole('checkbox').first().click()
  await expect(list.getByRole('checkbox').first()).toBeFocused()
  await page.getByRole('button', { name: 'Hotovo', exact: true }).click()
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await page.getByRole('button', { name: 'Vynulovat pozorování' }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0')
  await expect(page.getByRole('button', { name: 'Všechny', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Vynulovat pozorování' })).toBeDisabled()
  for (const checkbox of await list.getByRole('checkbox').all()) await checkbox.check()
  await expect(page.getByRole('status')).toContainText('Celý plán je hotový')
})

test('weather choices preserve dates, refund and keyboard recovery', async ({ page }) => {
  await page.goto('/weather-alert.html')
  await page.getByText('Co se stane s mojí rezervací?').click()
  await expect(
    page.getByText('Přesun na náhradní termín je bez doplatku.', { exact: false }),
  ).toBeVisible()
  const trigger = page.getByRole('button', { name: 'Vybrat řešení' })
  await trigger.click()
  await expect(page.getByRole('radio').first()).toBeFocused()
  await page.getByRole('button', { name: 'Rozhodnout později' }).click()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('radio', { name: /Pátek 30. října/ }).check()
  await page.getByRole('button', { name: 'Potvrdit ukázkovou volbu' }).click()
  const result = page.getByRole('region', { name: 'Výsledek ukázkové volby' })
  await expect(result).toBeFocused()
  await expect(result).toContainText('30. října 2026 v 18:30 pro 2 dospělé')
  await expect(result).toContainText('780 Kč, bez doplatku')
  await page.getByRole('button', { name: 'Zkusit jinou možnost' }).click()
  await expect(page.getByRole('radio', { name: /Pátek 30. října/ })).toBeFocused()
  await page.getByRole('radio', { name: /Vrácení celé částky/ }).check()
  await page.getByRole('button', { name: 'Potvrdit ukázkovou volbu' }).click()
  await expect(result).toContainText('vrácení 780 Kč za oba dospělé')
  await expect(result).toContainText('žádná platba neproběhla')
})

test('launcher copies each prompt and points to React source', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copied = text
        },
      },
    })
  })
  await page.goto('/')
  for (const article of await page.getByRole('article').all()) {
    await expect(article.locator('code')).toContainText('.tsx')
    const prompt = await article.getByRole('textbox').inputValue()
    await article.getByRole('button', { name: 'Kopírovat zadání' }).click()
    await expect(article.getByRole('status')).toHaveText('Zkopírováno.')
    await expect(page.locator('html')).toHaveAttribute('data-copied', prompt)
    const link = await article.getByRole('link').getAttribute('href')
    expect(link).toBeTruthy()
    expect((await page.request.get(link!)).ok()).toBe(true)
  }
})

test('clipboard denial selects the prompt for manual copying', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    })
  })
  await page.goto('/')
  const article = page.getByRole('article').first()
  await article.getByRole('button', { name: 'Kopírovat zadání' }).click()
  const prompt = article.getByRole('textbox')
  await expect(prompt).toBeFocused()
  await expect(article.getByRole('status')).toContainText('Text je označený')
  expect(
    await prompt.evaluate(
      (element) =>
        element instanceof HTMLTextAreaElement &&
        element.selectionEnd - element.selectionStart === element.value.length,
    ),
  ).toBe(true)
})

for (const filename of ['index', 'booking', 'observation-list', 'weather-alert']) {
  test(`${filename} renders without overflow, external requests or script errors`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    const external: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => {
      if (!request.url().startsWith('http://127.0.0.1:5198/')) external.push(request.url())
    })
    await page.goto(`/${filename}.html`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    for (const width of [300, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      )
      if (width === 375 || width === 1280)
        await page.screenshot({
          path: testInfo.outputPath(`${filename}-${width}.png`),
          fullPage: true,
        })
    }
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })
}
