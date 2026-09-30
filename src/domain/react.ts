import type { SourceContext } from './protocol'
import { isRecord } from './guards'

export const MAX_REACT_LENGTH = 60000
export type ReactImplementation = { language: 'tsx' | 'jsx'; code: string }

export const reactLanguageFor = (
  source: Pick<SourceContext, 'relativePath' | 'language'> | null,
): ReactImplementation['language'] | null => {
  if (!source) return null
  if (/\.tsx$/i.test(source.relativePath) && source.language === 'typescriptreact') return 'tsx'
  if (/\.jsx$/i.test(source.relativePath) && source.language === 'javascriptreact') return 'jsx'
  return null
}

export const validReactImplementation = (value: unknown): value is ReactImplementation =>
  isRecord(value) &&
  Object.keys(value).every((key) => key === 'language' || key === 'code') &&
  (value.language === 'tsx' || value.language === 'jsx') &&
  typeof value.code === 'string' &&
  value.code.trim().length > 0 &&
  value.code.length <= MAX_REACT_LENGTH &&
  !value.code.includes('\0') &&
  !value.code.trim().startsWith('```')
