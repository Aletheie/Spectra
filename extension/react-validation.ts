import ts from 'typescript'
import type { ReactImplementation } from '../src/domain/react'

/** Parse in memory only: never resolve dependencies, load tsconfig or execute emitted code. */
const parse = (code: string, language: ReactImplementation['language']) => {
  const name = `component.${language}`
  const source = ts.createSourceFile(
    name,
    code,
    ts.ScriptTarget.Latest,
    true,
    language === 'tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.JSX,
  )
  const options: ts.CompilerOptions = {
    noLib: true,
    noResolve: true,
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.Latest,
  }
  const host: ts.CompilerHost = {
    getSourceFile: (file) => (file === name ? source : undefined),
    getDefaultLibFileName: () => '',
    writeFile: () => undefined,
    getCurrentDirectory: () => '',
    getDirectories: () => [],
    fileExists: (file) => file === name,
    readFile: (file) => (file === name ? code : undefined),
    getCanonicalFileName: (file) => file,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  }
  const program = ts.createProgram([name], options, host)
  const error = program.getSyntacticDiagnostics(source)[0]
  if (error) {
    const line = source.getLineAndCharacterOfPosition(error.start ?? 0).line + 1
    throw new Error(
      `React replacement has invalid ${language.toUpperCase()} syntax at line ${line}. Refine the direction before replacing.`,
    )
  }
  return source
}

const contract = (source: ts.SourceFile) => {
  const exports = new Set<string>()
  const imports = new Set<string>()
  const directives = new Set<string>()
  const bindings = (name: ts.BindingName): string[] =>
    ts.isIdentifier(name)
      ? [name.text]
      : name.elements.flatMap((element) =>
          ts.isOmittedExpression(element) ? [] : bindings(element.name),
        )
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
      imports.add(statement.moduleSpecifier.text)
    if (ts.isExportDeclaration(statement)) {
      if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier))
        imports.add(statement.moduleSpecifier.text)
      if (statement.exportClause && ts.isNamedExports(statement.exportClause))
        for (const element of statement.exportClause.elements) exports.add(element.name.text)
      else exports.add(statement.getText(source))
    }
    if (ts.isExportAssignment(statement)) exports.add('default')
    if (ts.canHaveModifiers(statement)) {
      const modifiers = ts.getModifiers(statement) ?? []
      if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword))
        exports.add('default')
      else if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isVariableStatement(statement))
          for (const declaration of statement.declarationList.declarations)
            for (const name of bindings(declaration.name)) exports.add(name)
        else if ('name' in statement && statement.name && ts.isIdentifier(statement.name))
          exports.add(statement.name.text)
      }
    }
  }
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    directives.add(statement.expression.text)
  }
  return { exports, imports, directives }
}

export const validateReactReplacement = (
  before: string,
  after: string,
  language: ReactImplementation['language'],
) => {
  const previous = contract(parse(before, language))
  const next = contract(parse(after, language))
  if (
    previous.exports.size !== next.exports.size ||
    [...previous.exports].some((name) => !next.exports.has(name))
  )
    throw new Error(
      'This direction changes the file’s public exports. Refine it to preserve the component API before replacing.',
    )
  if ([...next.imports].some((name) => name !== 'react' && !previous.imports.has(name)))
    throw new Error(
      'This direction introduces an unavailable import. Keep existing dependencies or adapt the React code manually.',
    )
  if (
    previous.directives.size !== next.directives.size ||
    [...previous.directives].some((directive) => !next.directives.has(directive))
  )
    throw new Error(
      'This direction changes a file directive such as use client. Preserve the framework boundary before replacing.',
    )
}
