import type { GenerationAction, Variant } from './types'

export const withLineage = (
  results: Variant[],
  previous: Variant[],
  action: GenerationAction,
  sourceIds: string[] = [],
): Variant[] =>
  results.map((variant, index) => {
    const source = previous.find((item) => item.id === sourceIds[0])
    if (action === 'generate')
      return {
        ...variant,
        lineage: {
          action,
          sourceIds: [],
          rootId: variant.id,
          label: String.fromCharCode(65 + index),
          revision: 1,
        },
      }
    if (!source || sourceIds.some((id) => !previous.some((item) => item.id === id)))
      throw new Error('The source direction is no longer available.')
    const rootId = action === 'refine' ? (source.lineage?.rootId ?? source.id) : variant.id
    const revision =
      action === 'refine'
        ? Math.max(
            1,
            ...previous
              .filter((item) => item.lineage?.rootId === rootId)
              .map((item) => item.lineage?.revision ?? 1),
          ) + 1
        : 1
    const label =
      action === 'refine'
        ? (source.lineage?.label ?? String.fromCharCode(65 + previous.indexOf(source)))
        : `Mix ${previous.filter((item) => item.lineage?.action === 'remix').length + 1}`
    return { ...variant, lineage: { action, sourceIds, rootId, label, revision } }
  })

export const directionLabel = (variant: Variant, index = 0) => {
  const lineage = variant.lineage
  return lineage
    ? `${lineage.label}${lineage.revision > 1 ? ` v${lineage.revision}` : ''}`
    : index < 3
      ? String.fromCharCode(65 + index)
      : `Revision ${index - 2}`
}
