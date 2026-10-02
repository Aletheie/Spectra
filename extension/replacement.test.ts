import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepareReplacement, replacementSnapshot } from './replacement'
import { validateReactReplacement } from './react-validation'

const source = `'use client';
import { useState } from 'react';
type Props = { onSave: () => void; label: string };
export const Button = ({ onSave, label }: Props) => <button onClick={onSave}>{label}</button>;
`
const revised = source.replace(
  '<button onClick',
  '<button className="rounded-lg bg-blue-600 px-4 py-2 text-white" onClick',
)

test('React replacement keeps the whole-file API and normalizes line endings without executing code', () => {
  const current = source.replace(/\n/g, '\r\n')
  const result = prepareReplacement(
    current,
    replacementSnapshot(current, 0, current.length),
    { language: 'tsx', code: revised },
    validateReactReplacement,
  )
  assert.equal(result.document, revised.replace(/\n/g, '\r\n'))
  assert.equal(result.snapshot.endOffset, result.document.length)
  assert.match(result.document, /onClick=\{onSave\}/)
})

test('selected JSX replacement preserves all surrounding text, Unicode and subsequent replacement ranges', () => {
  const current =
    'const label = "Uložit 🌙";\nexport const Button = () => <button>{label}</button>;\nexport const Other = () => <aside />;'
  const start = current.indexOf('<button>')
  const end = current.indexOf('</button>') + '</button>'.length
  const snapshot = replacementSnapshot(current, start, end)
  const code = '<button className="px-4 py-2">{label}</button>'
  const first = prepareReplacement(
    current,
    snapshot,
    { language: 'tsx', code },
    validateReactReplacement,
  )
  assert.equal(first.document, current.slice(0, start) + code + current.slice(end))
  const next = '<button className="p-6">{label}</button>'
  const second = prepareReplacement(
    first.document,
    first.snapshot,
    { language: 'tsx', code: next },
    validateReactReplacement,
  )
  assert.equal(second.document, current.slice(0, start) + next + current.slice(end))
  for (const changed of [current + '\n// user edit', current.replace('label', 'title')])
    assert.throws(
      () =>
        prepareReplacement(changed, snapshot, { language: 'tsx', code }, validateReactReplacement),
      /source changed/,
    )
})

test('replacement rejects syntax errors, changed exports, added dependencies and changed directives', () => {
  for (const invalid of [
    revised.replace('export const Button', 'export const Renamed'),
    revised.replace("'use client';", ''),
    `import { cn } from './missing';\n${revised}`,
    revised.replace('</button>', '</aside>'),
  ])
    assert.throws(() => validateReactReplacement(source, invalid, 'tsx'))
  assert.throws(() => replacementSnapshot(source, -1, 2), /valid component range/)
  assert.throws(() => replacementSnapshot(source, 0, source.length + 1), /valid component range/)
  const jsx =
    'export default function Button({ onSave }) { return <button onClick={onSave}>Save</button> }'
  validateReactReplacement(jsx, jsx.replace('<button ', '<button className="p-4" '), 'jsx')
  assert.throws(
    () => validateReactReplacement(jsx, 'const Button = () => <button/>', 'jsx'),
    /exports/,
  )
  assert.throws(
    () =>
      validateReactReplacement(
        jsx,
        'export default function Button(props: Props) { return <button/> }',
        'jsx',
      ),
    /syntax/,
  )
  const named = 'export function Button() { return <button/> }'
  assert.throws(
    () => validateReactReplacement(named, named.replace('Button', 'Other'), 'tsx'),
    /exports/,
  )
})
