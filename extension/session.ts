import { MAX_VARIANTS, type EditorCommand, type EditorState } from '../src/domain/protocol'
import type { GenerationAction, Variant } from '../src/domain/types'
import { validEditorState } from '../src/domain/validation'
import { withLineage } from '../src/domain/lineage'
import type { GenerationResult } from './providers'
import { emptyConstraints, hasConstraints } from '../src/domain/constraints'
import { reactLanguageFor } from '../src/domain/react'

export type GenerationCommand = Extract<EditorCommand, { command: GenerationAction }>

export const resolveConstraints = (state: EditorState, command: GenerationCommand) => {
  if (command.provider === 'demo') {
    if (command.constraints && hasConstraints(command.constraints))
      throw new Error(
        'Curated presets do not support design constraints. Select a live AI provider to use them.',
      )
    return { ...emptyConstraints }
  }
  return { ...(command.constraints ?? state.constraints) }
}

export const resolveSources = (state: EditorState, command: GenerationCommand): Variant[] => {
  if (command.command === 'generate') return []
  if (state.variants.length >= MAX_VARIANTS) {
    throw new Error(
      `This exploration has ${MAX_VARIANTS} directions. Generate again to start a fresh comparison.`,
    )
  }
  return command.sourceIds.map((id) => {
    const variant = state.variants.find((item) => item.id === id)
    if (!variant) throw new Error('That direction is no longer on the canvas. Choose it again.')
    return variant
  })
}

/** Construct and validate a complete candidate before the host commits anything. */
export const applyGeneration = (
  state: EditorState,
  command: GenerationCommand,
  result: GenerationResult,
): EditorState => {
  if (
    (reactLanguageFor(state.source) !== null &&
      result.variants.some(
        (variant) => variant.react?.language !== reactLanguageFor(state.source),
      )) ||
    result.variants.length !== (command.command === 'generate' ? 3 : 1) ||
    (state.original && result.original) ||
    (!state.original && (!state.source || command.command !== 'generate' || !result.original))
  ) {
    throw new Error('Invalid generation result. The previous canvas is unchanged.')
  }
  const constraints = resolveConstraints(state, command)
  const variants = withLineage(
    result.variants,
    state.variants,
    command.command,
    command.command === 'generate' ? [] : command.sourceIds,
  ).map((variant) => ({ ...variant, constraints: { ...constraints } }))
  const next: EditorState = {
    ...state,
    original: state.original ?? result.original ?? null,
    baselineKind: state.source ? 'reconstructed' : state.baselineKind,
    variants: command.command === 'generate' ? variants : [...state.variants, ...variants],
    intent: command.command === 'generate' ? command.prompt : state.intent,
    constraints,
  }
  if (!validEditorState(next))
    throw new Error('Invalid generation result. The previous canvas is unchanged.')
  return next
}
