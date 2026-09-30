import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { original } from '../variants'
import { documentFor, exportDocument } from './document'
import { validVariant } from './validation'

test('document serialization preserves case inside script and CSS literals', () => {
  const variant = {
    ...original,
    css: '.example::after { content: "</StYlE>"; }',
    js: 'globalThis.result = "</ScRiPt>";',
  }
  for (const html of [documentFor(variant), exportDocument(variant)]) {
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
    assert.ok(script)
    const context = { result: '' }
    runInNewContext(script, context, { timeout: 1000 })
    assert.equal(context.result, '</ScRiPt>')
    assert.ok(html.includes('content: "<\\/StYlE>"'))
    assert.equal(html.match(/<\/script>/gi)?.length, 1)
    assert.equal(html.match(/<\/style>/gi)?.length, 1)
  }
})

test('validation rejects script end tags rather than changing tagged template semantics', () => {
  for (const js of [
    'globalThis.result = String.raw`</ScRiPt>`;',
    'globalThis.result = "</script>";',
    'globalThis.result = 0</script/.test("script");',
  ])
    assert.equal(validVariant({ ...original, js }), false)

  for (const value of ['</scripture>', '</script']) {
    const variant = { ...original, js: `globalThis.result = String.raw\`${value}\`;` }
    assert.equal(validVariant(variant), true)
    const script = exportDocument(variant).match(/<script>([\s\S]*?)<\/script>/)?.[1]
    assert.ok(script)
    const context = { result: '' }
    runInNewContext(script, context, { timeout: 1000 })
    assert.equal(context.result, value)
  }
})

test('validation rejects the HTML script-double-escape sequence before accepting a variant', () => {
  for (const js of [
    'const markup = `<!--<script>`;',
    'const markup = `<!--<ScRiPt type="text/javascript">`;',
    'const markup = `<!--<script\n>`;',
  ])
    assert.equal(validVariant({ ...original, js }), false)

  for (const js of [
    'const markup = `<!--comment-->`;',
    'const markup = `<script>`;',
    'const markup = `<!--<scripture>`;',
    'const comment = "<!-- -->"; const tag = "<script>";',
    'const tag = "<script>"; const comment = "<!--";',
    'const markup = `<!--<script>-->`;',
    'const markup = `<!--<!--><script>`;',
  ])
    assert.equal(validVariant({ ...original, js }), true)
})
