import type { Variant, GenerationAction } from './types'
import { demoVariants } from '../variants'
import { createSample } from './sample'

/** Rebuild curated fragments from an explicit recipe; never splice arbitrary HTML or CSS. */
export const demoResult = (
  action: GenerationAction,
  sources: Variant[],
  instruction: string,
): Variant[] => {
  if (action === 'generate')
    return demoVariants.map((variant) => ({ ...variant, id: crypto.randomUUID() }))
  if (sources.length !== (action === 'refine' ? 1 : 2) || sources.some((source) => !source.sample))
    throw new Error(
      'Select the exact source directions for this demo transformation. Live variants require a live provider.',
    )
  const [source, second] = sources
  const compact = /minimal|simple|clean|less|compact/i.test(instruction)
  const recipe = { ...source.sample! }
  if (action === 'remix') {
    recipe.emphasis = second.sample!.emphasis
    recipe.cta = second.sample!.cta
  } else {
    recipe.compact = compact
    if (!compact) recipe.emphasis = 'value'
  }
  return [
    {
      ...createSample(recipe),
      id: crypto.randomUUID(),
      name:
        action === 'remix'
          ? `${source.name.split(' · ')[0]} · remixed`
          : `${source.name.split(' · ')[0]} · refined`,
      hypothesis:
        action === 'remix'
          ? `Keep the layout from ${source.name}; use the supporting explanation and trial action from ${second.name}.`
          : compact
            ? 'Shorten the introduction and reduce spacing while keeping billing totals, features and trial conditions visible.'
            : 'Keep this layout and add an explicit comparison of monthly and yearly costs before the decision.',
      changes:
        action === 'remix'
          ? [
              `Layout from ${source.name}`,
              `Explanation and action from ${second.name}`,
              'One plan and one billing state; curated combination',
            ]
          : compact
            ? [
                'Removed the introductory supporting sentence',
                'Reduced spacing in the plan and feature list',
                'Kept price, billing terms and all included features',
              ]
            : [
                'Added both annual cost totals',
                'Added a savings explanation that follows the billing switch',
                'Preserved the source layout and included features',
              ],
    },
  ]
}
