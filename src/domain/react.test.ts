import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reactLanguageFor, validReactImplementation } from './react'
import { validEditorCommand, validVariant } from './validation'
import { demoVariants } from '../variants'
import { createHandoff } from './handoff'

test('React artifacts are bounded and replacement commands cannot choose files or supply code', () => {
  assert.equal(
    reactLanguageFor({ language: 'typescriptreact', relativePath: 'src/Button.tsx' }),
    'tsx',
  )
  assert.equal(
    reactLanguageFor({ language: 'javascriptreact', relativePath: 'src/Button.jsx' }),
    'jsx',
  )
  assert.equal(reactLanguageFor({ language: 'typescript', relativePath: 'src/types.ts' }), null)
  const react = {
    language: 'tsx' as const,
    code: 'export const Button = () => <button className="p-4">Save</button>',
  }
  assert.equal(validVariant({ ...demoVariants[0], react }), true)
  for (const invalid of [
    { ...react, code: '' },
    { ...react, code: 'x'.repeat(60001) },
    { ...react, filename: 'other.tsx' },
    { ...react, language: 'html' },
    { ...react, code: '```tsx\ncode\n```' },
  ])
    assert.equal(validReactImplementation(invalid), false)
  for (const command of ['replaceComponent', 'copyReact']) {
    assert.equal(validEditorCommand({ command, variantId: 'exact-revision' }), true)
    assert.equal(
      validEditorCommand({ command, variantId: 'exact-revision', code: react.code }),
      false,
    )
    assert.equal(
      validEditorCommand({ command, variantId: 'exact-revision', path: '/other.tsx' }),
      false,
    )
  }
  const handoff = createHandoff(null, 'Clearer', { ...demoVariants[0], react })
  assert.ok(handoff.includes(react.code))
  assert.match(handoff, /React \+ Tailwind project implementation/)
  assert.match(handoff, /separate visual approximation/)
})
