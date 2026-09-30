import type { DesignConstraints } from './constraints'
import type { ReactImplementation } from './react'

export type Variant = {
  id: string
  name: string
  hypothesis: string
  changes: string[]
  html: string
  css: string
  js: string
  /** Exact project code. HTML/CSS/JS are a separate, approximate preview. */
  react?: ReactImplementation
  /** Host-owned constraints used for this revision, not unsubmitted UI drafts. */
  constraints?: DesignConstraints
  /** Host-owned provenance, never accepted from a provider. */
  lineage?: {
    action: GenerationAction
    sourceIds: string[]
    rootId: string
    label: string
    revision: number
  }
  /** Present only on explicitly curated implementations. */
  sample?: SampleRecipe
}

export type GenerationAction = 'generate' | 'refine' | 'remix'

export type SampleLayout = 'original' | 'clarity' | 'trust' | 'value'
export type SampleRecipe = {
  layout: SampleLayout
  emphasis: SampleLayout
  cta: SampleLayout
  compact: boolean
}
