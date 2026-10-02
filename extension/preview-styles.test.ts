import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { compile } from 'tailwindcss'
import { original } from '../src/variants'
import { documentFor, exportDocument } from '../src/domain/document'
import {
  createPreviewStyler,
  PREVIEW_STYLE_CACHE_ENTRIES,
  PREVIEW_STYLE_CACHE_CHARACTERS,
} from './preview-styles'

const require = createRequire(import.meta.url)
const theme = await readFile(require.resolve('tailwindcss/theme.css'), 'utf8')
const prepare = createPreviewStyler(`${theme}\n@tailwind utilities;`)

test('static Tailwind becomes standalone CSS shared by preview, inspection and export', async () => {
  const variant = {
    ...original,
    html: '<button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 sm:flex">Save</button>',
    css: 'button{font-family:system-ui}',
    js: '',
  }
  const styled = await prepare(variant)
  assert.match(styled.css, /\.bg-blue-600/)
  assert.match(styled.css, /--color-blue-600:/)
  assert.match(styled.css, /\.px-4/)
  assert.match(styled.css, /hover/)
  assert.ok(styled.css.endsWith(variant.css))
  assert.ok(documentFor(styled).includes(styled.css))
  assert.ok(exportDocument(styled).includes(styled.css))
  assert.equal(variant.css, 'button{font-family:system-ui}')
  const next = await prepare({ ...variant, html: '<button class="p-2">Next</button>' })
  assert.doesNotMatch(next.css, /\.bg-blue-600/)
})

test('unavailable style dependencies and project tokens fail before entering the canvas', async () => {
  for (const css of [
    '@import "https://example.com/style.css";',
    '@plugin "./plugin.js";',
    '@config "./tailwind.config.js";',
    'button{@apply px-4;}',
    '/* no styling */',
    'button{color:var(--missing-project-color)}',
  ])
    await assert.rejects(
      prepare({ ...original, html: '<button>Save</button>', css }),
      /missing styles/,
    )
  for (const html of [
    '<link rel="stylesheet" href="styles.css"><button>Save</button>',
    '<script src="https://cdn.tailwindcss.com"></script><button>Save</button>',
    '<button class="bg-primary text-primary-foreground">Save</button>',
  ])
    await assert.rejects(
      prepare({ ...original, html, css: 'body{font-family:system-ui}' }),
      /missing styles/,
    )
})

test('plain authored styles, declared custom properties and fallback values remain intact', async () => {
  for (const css of [
    'button{padding:1rem;color:navy}',
    ':root{--brand:navy} button{color:var(--brand)}',
    'button{color:var(--brand,navy)}',
  ]) {
    const variant = { ...original, html: '<button>Save</button>', css, js: '' }
    assert.deepEqual(await prepare(variant), variant)
  }
})

test('concurrent equal class sets compile once while authored code stays exact for each revision', async () => {
  let compilations = 0
  const cached = createPreviewStyler(`${theme}\n@tailwind utilities;`, async (base) => {
    compilations++
    return compile(base)
  })
  const first = {
    ...original,
    html: '<button class="p-4 bg-blue-600">Save</button>',
    css: 'button{color:white}',
    js: '',
  }
  const second = {
    ...first,
    html: '<button class="bg-blue-600 p-4 p-4">Continue</button>',
    css: 'button{color:black}',
    js: 'const local = true;',
  }
  const [one, two] = await Promise.all([cached(first), cached(second)])
  assert.equal(compilations, 1)
  assert.equal(one.html, first.html)
  assert.equal(two.html, second.html)
  assert.equal(two.js, second.js)
  assert.ok(one.css.endsWith(first.css))
  assert.ok(two.css.endsWith(second.css))
  assert.equal(one.css.slice(0, -first.css.length), two.css.slice(0, -second.css.length))
  await cached(first)
  assert.equal(compilations, 1)
  await assert.rejects(cached({ ...first, css: 'button{color:var(--missing)}' }), /missing styles/)
  assert.equal(compilations, 1, 'cached utility CSS cannot bypass authored CSS validation')
  const independent = createPreviewStyler(`${theme}\n@tailwind utilities;`, async (base) => {
    compilations++
    return compile(base)
  })
  await independent(first)
  assert.equal(compilations, 2, 'another panel owns an independent cache')
})

test('style cache evicts old entries by count and size without retaining compilation failures', async () => {
  let compilations = 0
  let fail = false
  const cached = createPreviewStyler('', async () => {
    compilations++
    if (fail) throw new Error('compiler unavailable')
    return { build: (candidates) => (candidates.length ? '.example{padding:1rem}' : '') }
  })
  const variant = (index: number) => ({
    ...original,
    html: `<button class="p-${index}">Save</button>`,
    css: 'body{font-family:system-ui}',
    js: '',
  })
  for (let index = 0; index <= PREVIEW_STYLE_CACHE_ENTRIES; index++) await cached(variant(index))
  await cached(variant(PREVIEW_STYLE_CACHE_ENTRIES))
  assert.equal(compilations, PREVIEW_STYLE_CACHE_ENTRIES + 1)
  await cached(variant(0))
  assert.equal(compilations, PREVIEW_STYLE_CACHE_ENTRIES + 2)
  fail = true
  await assert.rejects(cached(variant(100)), /missing styles/)
  fail = false
  await cached(variant(100))
  assert.equal(compilations, PREVIEW_STYLE_CACHE_ENTRIES + 4)

  let largeCompilations = 0
  const largeCss = `.example{padding:1rem}/*${'x'.repeat(60000)}*/`
  const large = createPreviewStyler('', async () => {
    largeCompilations++
    return { build: (candidates) => (candidates.length ? largeCss : '') }
  })
  const entries = Math.floor(PREVIEW_STYLE_CACHE_CHARACTERS / largeCss.length) + 1
  assert.ok(entries < PREVIEW_STYLE_CACHE_ENTRIES, 'the fixture exercises the size bound first')
  for (let index = 0; index < entries; index++) await large(variant(index))
  await large(variant(0))
  assert.equal(largeCompilations, entries + 1)
})

test('plain HTML does not invoke the utility compiler', async () => {
  const plain = createPreviewStyler('', async () => {
    throw new Error('must not compile')
  })
  const variant = { ...original, html: '<button>Save</button>', css: 'button{color:navy}', js: '' }
  assert.deepEqual(await plain(variant), variant)
})
