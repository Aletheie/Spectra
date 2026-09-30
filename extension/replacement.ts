import { createHash } from 'node:crypto'
import type { ReactImplementation } from '../src/domain/react'
import { validateReactReplacement } from './react-validation'

export type ReplacementSnapshot = { documentHash: string; startOffset: number; endOffset: number }
export const documentHash = (code: string) => createHash('sha256').update(code).digest('hex')

export const replacementSnapshot = (
  document: string,
  startOffset: number,
  endOffset: number,
): ReplacementSnapshot => {
  if (
    !Number.isSafeInteger(startOffset) ||
    !Number.isSafeInteger(endOffset) ||
    startOffset < 0 ||
    endOffset <= startOffset ||
    endOffset > document.length
  )
    throw new Error('Capture a valid component range before replacing.')
  return { documentHash: documentHash(document), startOffset, endOffset }
}

export const prepareReplacement = (
  current: string,
  snapshot: ReplacementSnapshot,
  implementation: ReactImplementation,
) => {
  if (documentHash(current) !== snapshot.documentHash)
    throw new Error(
      'The source changed since capture or the last replacement. Capture it again to preserve your edits.',
    )
  const code = current.includes('\r\n')
    ? implementation.code.replace(/\r?\n/g, '\r\n')
    : implementation.code.replace(/\r\n/g, '\n')
  const next = current.slice(0, snapshot.startOffset) + code + current.slice(snapshot.endOffset)
  validateReactReplacement(current, next, implementation.language)
  return {
    code,
    document: next,
    snapshot: replacementSnapshot(next, snapshot.startOffset, snapshot.startOffset + code.length),
  }
}
