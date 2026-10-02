import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoVariants, original } from '../variants'
import { demoResult } from './demo'
import { documentFor, exportDocument } from './document'
import { createHandoff } from './handoff'
import { parseGeneratedVariants, validVariant } from './validation'

test('preview documents isolate generated code while exports remain standalone', () => {
  const variant = { ...original, css: '/* </STYLE> */', js: 'const text = "</SCRIPT>"' }
  const preview = documentFor(variant)
  assert.match(preview, /connect-src 'none'/)
  assert.match(preview, /<\\\/STYLE>/)
  assert.match(preview, /<\\\/SCRIPT>/)
  assert.doesNotMatch(exportDocument(variant), /Content-Security-Policy/)
  assert.match(exportDocument(original), /^<!doctype html>/)
  const webview = documentFor(original, true, 'editor_nonce123')
  assert.match(webview, /script-src 'nonce-editor_nonce123'/)
  assert.match(webview, /<script nonce="editor_nonce123">/)
  assert.doesNotMatch(documentFor(original, true, '" onload="bad'), /nonce=/)
})

test('editor-neutral brief contains the exact chosen implementation and snapshot limitations', () => {
  const source = {
    id: 'snapshot-1',
    relativePath: 'src/Card.tsx',
    language: 'typescriptreact',
    code: 'const Card = () => <article>Unsaved content</article>',
    startLine: 3,
    endLine: 4,
    selection: true,
  }
  const selected = { ...demoVariants[1], js: 'const example = "```"' }
  const handoff = createHandoff(source, 'Make the action clearer', selected)
  assert.ok(handoff.includes(source.code))
  assert.ok(handoff.includes(selected.html))
  assert.ok(handoff.includes(selected.css))
  assert.ok(handoff.includes(selected.js))
  assert.match(handoff, /src\/Card.tsx, lines 3–4/)
  assert.match(handoff, /Make the action clearer/)
  assert.match(handoff, /````javascript/)
  assert.match(handoff, /AI reconstruction, not the running component/)
  assert.match(handoff, /Paste this brief manually into your editor’s AI chat/)
  assert.match(handoff, /does not open a chat, run an agent or apply any edits/)
  assert.doesNotMatch(handoff, /Cursor/)
  assert.match(handoff, /outside iframe isolation/)
  assert.match(createHandoff(null, 'Sample', selected), /curated Orbit sample/)
})

test('generation creates three independent directions and preserves baseline', () => {
  const before = JSON.stringify(original)
  const variants = demoResult('generate', [], 'premium')
  assert.equal(variants.length, 3)
  assert.equal(new Set(variants.map((variant) => variant.id)).size, 3)
  assert.deepEqual(
    variants.map((variant) => variant.name),
    demoVariants.map((variant) => variant.name),
  )
  assert.equal(JSON.stringify(original), before)
})

test('refinement uses the exact supplied source without mutating it', () => {
  assert.throws(() => demoResult('refine', [], 'minimal'), /exact source/)
  assert.throws(() => demoResult('remix', [demoVariants[0]], 'combine'), /exact source/)
  const source = demoVariants[1]
  const before = JSON.stringify(source)
  const [refined] = demoResult('refine', [source], 'more minimal')
  assert.notEqual(refined.id, source.id)
  assert.equal(refined.sample?.layout, source.sample?.layout)
  assert.equal(refined.sample?.compact, true)
  assert.match(refined.html, /class="page layout-trust compact"/)
  assert.match(refined.html, /Billed yearly · \$288 total/)
  assert.match(refined.html, /10 team members included/)
  assert.equal(JSON.stringify(source), before)
})

test('remix keeps first source layout and takes second source CTA', () => {
  const [layout, emphasis] = [demoVariants[0], demoVariants[2]]
  const [remixed] = demoResult('remix', [layout, emphasis], 'combine')
  assert.equal(remixed.sample?.layout, layout.sample?.layout)
  assert.equal(remixed.sample?.emphasis, emphasis.sample?.emphasis)
  assert.equal(remixed.sample?.cta, emphasis.sample?.cta)
  assert.match(remixed.html, /class="page layout-clarity"/)
  assert.match(remixed.html, /class="cta">Try Pro with yearly billing<\/button>/)
  assert.match(remixed.html, /class="emphasis cost-comparison"/)
  assert.ok(remixed.hypothesis.includes(layout.name))
  assert.ok(remixed.hypothesis.includes(emphasis.name))
})

test('validation rejects malformed, oversized, wrong-count and duplicate responses', () => {
  assert.equal(validVariant(null), false)
  assert.equal(validVariant({ ...original, html: '  ' }), false)
  assert.equal(validVariant({ ...original, changes: ['  '] }), false)
  assert.equal(validVariant({ ...original, name: 'x'.repeat(161) }), false)
  assert.equal(validVariant({ ...original, js: 123 }), false)
  assert.equal(validVariant({ ...original, html: 'x'.repeat(100000) }), false)
  assert.throws(() => parseGeneratedVariants({ variants: [original] }, 1))
  assert.throws(() => parseGeneratedVariants({ variants: [] }, 3))
  const variant = demoVariants[0]
  assert.throws(() => parseGeneratedVariants({ variants: [variant, variant] }, 2))
  assert.deepEqual(parseGeneratedVariants({ variants: demoVariants }, 3), demoVariants)
})
