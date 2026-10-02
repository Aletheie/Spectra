import type { GenerationProgress } from '../src/domain/protocol'
import type { Variant } from '../src/domain/types'
import { validateInput, type GenerationInput, type GenerationResult } from './providers'

type Generate = (input: GenerationInput, signal: AbortSignal) => Promise<GenerationResult>
type Prepare = (variant: Variant) => Promise<Variant>

export const generationRequestCount = (input: Pick<GenerationInput, 'action' | 'original'>) =>
  input.action === 'generate' ? (input.original ? 3 : 4) : 1

/** Two bounded workers, one deadline, one atomic result. No retries or partial commits. */
export const generateComparison = async (
  input: GenerationInput,
  signal: AbortSignal,
  generate: Generate,
  prepare: Prepare,
  report: (progress: GenerationProgress) => void,
): Promise<GenerationResult> => {
  validateInput(input)
  const targets: GenerationInput['target'][] =
    input.action === 'generate'
      ? [...(input.original ? [] : ['original' as const]), 'A', 'B', 'C']
      : [undefined]
  const stop = new AbortController()
  const combined = AbortSignal.any([signal, stop.signal])
  const results: GenerationResult[] = []
  let cursor = 0
  let completed = 0
  let failure: unknown
  report({ completed: 0, total: targets.length })
  const worker = async () => {
    try {
      while (cursor < targets.length) {
        combined.throwIfAborted()
        const index = cursor++
        const target = targets[index]
        const result = await generate({ ...input, target }, combined)
        combined.throwIfAborted()
        if (
          target === 'original'
            ? !result.original || result.variants.length !== 0
            : result.original !== undefined || result.variants.length !== 1
        )
          throw new Error(
            'A generation task returned an incomplete result. Your canvas is unchanged.',
          )
        results[index] = {
          ...(result.original ? { original: await prepare(result.original) } : {}),
          variants: await Promise.all(result.variants.map(prepare)),
        }
        combined.throwIfAborted()
        report({ completed: ++completed, total: targets.length })
      }
    } catch (error) {
      if (!stop.signal.aborted) {
        failure = error
        stop.abort()
      }
    }
  }
  // Await both workers, including cancellation cleanup, before releasing the host busy lock.
  await Promise.all(Array.from({ length: Math.min(2, targets.length) }, worker))
  if (failure !== undefined) throw failure
  combined.throwIfAborted()
  return {
    ...(results[0].original ? { original: results[0].original } : {}),
    variants: results.flatMap((result) => result.variants),
  }
}
