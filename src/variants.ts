import { createSample } from './domain/sample'
import type { SampleLayout } from './domain/types'
export type { Variant } from './domain/types'

export const original = createSample({
  layout: 'original',
  emphasis: 'original',
  cta: 'original',
  compact: false,
})
const sampleLayouts = ['clarity', 'trust', 'value'] as const satisfies readonly SampleLayout[]
export const demoVariants = sampleLayouts.map((layout) =>
  createSample({ layout, emphasis: layout, cta: layout, compact: false }),
)
