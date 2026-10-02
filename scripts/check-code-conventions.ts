import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { demoVariants, original } from '../src/variants'

// Extend Oxlint's checks to function expressions/methods and curated preview JS.
// Provider-generated code and captured user source are not project-owned fixtures.
const collectFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const filename = path.join(directory, entry.name)
      return entry.isDirectory()
        ? collectFiles(filename)
        : /\.tsx?$/.test(entry.name)
          ? Promise.resolve([filename])
          : Promise.resolve([])
    }),
  )
  return files.flat()
}

const directories = ['src', 'extension', 'scripts', 'tests/native']
const files = (await Promise.all(directories.map(collectFiles))).flat()
files.push('vite.config.ts')

let failures = 0
const checkSource = (filename: string, content: string, kind = ts.ScriptKind.TS) => {
  const source = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true, kind)
  const report = (node: ts.Node, message: string) => {
    const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source))
    console.error(`${filename}:${line + 1}:${character + 1}: ${message}`)
    failures++
  }
  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node)
    ) {
      report(node, 'Use an arrow function.')
    }
    if (ts.isInterfaceDeclaration(node)) {
      report(node, 'Use a type alias instead of an interface.')
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const isForEach = ts.isPropertyAccessExpression(callee)
        ? callee.name.text === 'forEach'
        : ts.isElementAccessExpression(callee) &&
          ts.isStringLiteralLike(callee.argumentExpression) &&
          callee.argumentExpression.text === 'forEach'
      if (isForEach) {
        report(node, 'Use a for…of loop instead of forEach for side effects.')
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

for (const filename of files) {
  const kind = filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  checkSource(filename, await readFile(filename, 'utf8'), kind)
}

const checkedScripts = new Set<string>()
for (const variant of [original, ...demoVariants]) {
  if (checkedScripts.has(variant.js)) continue
  checkedScripts.add(variant.js)
  checkSource(`curated-preview/${variant.id}.js`, variant.js, ts.ScriptKind.JS)
}

if (failures) process.exitCode = 1
