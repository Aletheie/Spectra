import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inferComponentKind, suggestedComponentPrompt } from './component'

test('component focus follows captured markup, including framework and style-only snapshots', () => {
  const cases = [
    ['typescriptreact', 'export const Save = () => <Button disabled>Save</Button>', 'control'],
    ['html', '<form><label>Email<input required></label><button>Send</button></form>', 'form'],
    ['vue', '<template><nav><button>Menu</button></nav></template>', 'navigation'],
    ['svelte', '<table><tbody><tr><td>Item</td></tr></tbody></table>', 'data'],
    ['typescriptreact', '<Dialog open><form><input /></form></Dialog>', 'overlay'],
    ['html', '<main><nav>Menu</nav><form><input></form></main>', 'section'],
    ['html', '<div><form><input></form></div>', 'form'],
    ['css', '.dialog { color: white; background: transparent; }', 'styles'],
    ['scss', '$gap: 8px; .button { padding: $gap; }', 'styles'],
  ] as const
  for (const [language, code, kind] of cases)
    assert.equal(inferComponentKind({ code, language }), kind)
})

test('unknown and mixed snippets do not become a type based on names or comments', () => {
  for (const code of [
    'import { Form } from "./Form"; export const configuration = { title: "Form" }',
    '<PricingCard />',
    '<div><nav>Links</nav><form><input /></form></div>',
    '// <form>\n/* <table> */\nexport const value = 1',
    '<!-- <form> --><div>Unspecified content</div>',
  ])
    assert.equal(inferComponentKind({ code, language: 'typescriptreact' }), 'unknown')
})

test('suggested prompts address control scope, form validation and absent markup independently', () => {
  const prompt = (code: string, language = 'html') => suggestedComponentPrompt({ code, language })
  assert.match(prompt('<button>Save</button>'), /small component.*transparency/)
  assert.match(prompt('<form><input></form>'), /validation.*Preserve the fields/)
  assert.match(prompt('.button{}', 'css'), /illustrative markup.*without the component/)
})
