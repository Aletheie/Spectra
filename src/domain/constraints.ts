import { isRecord } from './guards'

export type DesignConstraints = {
  preserveText: boolean
  preserveBrandColors: boolean
  preserveDimensions: boolean
  elements: string
}

export const MAX_CONSTRAINTS_LENGTH = 1000
export const emptyConstraints: DesignConstraints = {
  preserveText: false,
  preserveBrandColors: false,
  preserveDimensions: false,
  elements: '',
}
export const constraintOptions = [
  { key: 'preserveText', label: 'Text' },
  { key: 'preserveBrandColors', label: 'Brand colors' },
  { key: 'preserveDimensions', label: 'Dimensions' },
] as const

export const validConstraints = (value: unknown): value is DesignConstraints =>
  isRecord(value) &&
  Object.keys(value).length === 4 &&
  Object.keys(value).every((key) => Object.hasOwn(emptyConstraints, key)) &&
  constraintOptions.every(({ key }) => typeof value[key] === 'boolean') &&
  typeof value.elements === 'string' &&
  value.elements.length <= MAX_CONSTRAINTS_LENGTH

export const constraintsSummary = (constraints: DesignConstraints) =>
  [
    ...constraintOptions.filter(({ key }) => constraints[key]).map(({ label }) => label),
    ...(constraints.elements.trim() ? [`Elements: ${constraints.elements.trim()}`] : []),
  ].join(' · ')

export const hasConstraints = (constraints: DesignConstraints) =>
  Boolean(constraintsSummary(constraints))
