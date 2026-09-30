import path from 'node:path'
import { MAX_SOURCE_LENGTH } from '../src/domain/protocol'

export const supportedLanguages = new Set([
  'typescriptreact',
  'javascriptreact',
  'typescript',
  'javascript',
  'html',
  'css',
  'scss',
  'vue',
  'svelte',
])
export const isWithin = (root: string, file: string) => {
  const relative = path.relative(root, file)
  return (
    relative !== '' &&
    !path.isAbsolute(relative) &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`)
  )
}
export const validateSource = (relativePath: string, language: string, code: string) => {
  // UI token styles are common; credential-related directories/names remain blocked.
  const designTokenStyles = /(?:^|[\\/])(?:design[-_])?tokens?\.(css|scss)$/i.test(relativePath)
  const sensitivePath = designTokenStyles ? relativePath.replace(/[^\\/]+$/, '') : relativePath
  if (
    !supportedLanguages.has(language) ||
    !/\.(tsx?|jsx?|html?|css|scss|vue|svelte)$/i.test(relativePath)
  ) {
    throw new Error('Choose a TSX, JSX, HTML, CSS, Vue or Svelte component file in the workspace.')
  }
  if (
    relativePath
      .split(/[\\/]/)
      .some((part) => part.startsWith('.') || /^(node_modules|dist|build|coverage)$/i.test(part)) ||
    /(?:^|[\\/._-])(secret|secrets|credentials|private[-_]?key|token|tokens|env)(?:[\\/._-]|$)/i.test(
      sensitivePath,
    )
  ) {
    throw new Error(
      'This looks like a hidden, generated or sensitive file. Select a component source file instead.',
    )
  }
  if (!code.trim() || code.length > MAX_SOURCE_LENGTH || code.includes('\0')) {
    throw new Error(
      'Select between 1 and 60,000 characters of text. Empty or binary input is not supported.',
    )
  }
}
