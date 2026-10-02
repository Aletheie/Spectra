import type { DesignConstraints } from './constraints'
import type { EditorState, SourceContext } from './protocol'
import type { Variant } from './types'

const sameStrings = (before: string[], next: string[]) =>
  before === next ||
  (before.length === next.length && before.every((value, index) => value === next[index]))

const sameConstraints = (
  before: DesignConstraints | undefined,
  next: DesignConstraints | undefined,
) =>
  before === next ||
  (before !== undefined &&
    next !== undefined &&
    before.preserveText === next.preserveText &&
    before.preserveBrandColors === next.preserveBrandColors &&
    before.preserveDimensions === next.preserveDimensions &&
    before.elements === next.elements)

const sameSource = (before: SourceContext | null, next: SourceContext | null) =>
  before === next ||
  (before !== null &&
    next !== null &&
    before.id === next.id &&
    before.relativePath === next.relativePath &&
    before.language === next.language &&
    before.code === next.code &&
    before.startLine === next.startLine &&
    before.endLine === next.endLine &&
    before.selection === next.selection)

const sameVariant = (before: Variant, next: Variant) =>
  before === next ||
  (before.id === next.id &&
    before.html === next.html &&
    before.css === next.css &&
    before.js === next.js &&
    before.react?.code === next.react?.code &&
    before.react?.language === next.react?.language &&
    before.name === next.name &&
    before.hypothesis === next.hypothesis &&
    sameStrings(before.changes, next.changes) &&
    sameConstraints(before.constraints, next.constraints) &&
    before.sample?.layout === next.sample?.layout &&
    before.sample?.emphasis === next.sample?.emphasis &&
    before.sample?.cta === next.sample?.cta &&
    before.sample?.compact === next.sample?.compact &&
    before.lineage?.action === next.lineage?.action &&
    before.lineage?.rootId === next.lineage?.rootId &&
    before.lineage?.label === next.lineage?.label &&
    before.lineage?.revision === next.lineage?.revision &&
    (before.lineage === next.lineage ||
      (before.lineage !== undefined &&
        next.lineage !== undefined &&
        sameStrings(before.lineage.sourceIds, next.lineage.sourceIds))))

/** Call only after runtime validation, once per full host update. */
export const reconcileEditorState = (
  before: EditorState | undefined,
  next: EditorState,
): EditorState => {
  if (!before || before === next || before.source?.id !== next.source?.id) return next
  const previous = new Map(before.variants.map((variant) => [variant.id, variant]))
  const variants =
    before.variants === next.variants
      ? next.variants
      : next.variants.map((variant) => {
          const existing = previous.get(variant.id)
          return existing && sameVariant(existing, variant) ? existing : variant
        })
  return {
    ...next,
    source: sameSource(before.source, next.source) ? before.source : next.source,
    constraints: sameConstraints(before.constraints, next.constraints)
      ? before.constraints
      : next.constraints,
    original:
      before.original && next.original && sameVariant(before.original, next.original)
        ? before.original
        : next.original,
    variants:
      variants.length === before.variants.length &&
      variants.every((variant, index) => variant === before.variants[index])
        ? before.variants
        : variants,
  }
}
