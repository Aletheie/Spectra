import {
  MAX_PROMPT_LENGTH,
  MAX_SOURCE_LENGTH,
  MAX_VARIANTS,
  type EditorCommand,
  type EditorRequest,
  type EditorState,
  type Engine,
  type EditorStatus,
  type HostMessage,
  type ProviderInfo,
  type SourceContext,
} from './protocol'
import type { Variant } from './types'
import { isRecord } from './guards'
import { validConstraints } from './constraints'

const text = (value: unknown, limit: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length < limit
const id = (value: unknown): value is string => text(value, 201)
const liveProvider = (value: unknown) =>
  value === 'cursor' || value === 'openai' || value === 'anthropic'
export const isEngine = (value: unknown): value is Engine => liveProvider(value) || value === 'demo'
const onlyKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key))

const sampleLayout = (value: unknown) =>
  ['original', 'clarity', 'trust', 'value'].includes(String(value))
const validMetadata = (variant: Record<string, unknown>) => {
  const sample = variant.sample
  if (
    sample !== undefined &&
    (!isRecord(sample) ||
      !sampleLayout(sample.layout) ||
      !sampleLayout(sample.emphasis) ||
      !sampleLayout(sample.cta) ||
      typeof sample.compact !== 'boolean')
  )
    return false
  const lineage = variant.lineage
  return (
    lineage === undefined ||
    (isRecord(lineage) &&
      ['generate', 'refine', 'remix'].includes(String(lineage.action)) &&
      id(lineage.rootId) &&
      text(lineage.label, 81) &&
      Number.isSafeInteger(lineage.revision) &&
      Number(lineage.revision) >= 1 &&
      Number(lineage.revision) <= MAX_VARIANTS &&
      Array.isArray(lineage.sourceIds) &&
      lineage.sourceIds.length ===
        (lineage.action === 'generate' ? 0 : lineage.action === 'refine' ? 1 : 2) &&
      lineage.sourceIds.every(id) &&
      new Set(lineage.sourceIds).size === lineage.sourceIds.length)
  )
}

const canEmbedScript = (script: string) => {
  // Arbitrary JS cannot be rewritten safely: tagged templates and regex literals
  // do not share ordinary string escaping. The provider contract forbids end tags.
  if (/<\/script(?=[\t\n\f\r />]|$)/i.test(script)) return false
  let escaped = false
  let doubleEscaped = false
  // Look ahead so overlapping delimiters such as <!--> include their --> too.
  for (const [, token] of script.matchAll(/(?=(<!--|-->|<script(?=[\t\n\f\r />])))/gi)) {
    if (token === '-->') {
      escaped = false
      doubleEscaped = false
    } else if (token === '<!--') {
      escaped = true
    } else if (escaped) {
      doubleEscaped = true
    }
  }
  // In double-escaped HTML script data, our closing tag would be consumed as text.
  return !doubleEscaped
}

export const validVariant = (variant: unknown): variant is Omit<Variant, 'id'> => {
  if (!isRecord(variant)) return false
  return (
    text(variant.name, 161) &&
    text(variant.hypothesis, 1201) &&
    text(variant.html, 100000) &&
    text(variant.css, 100000) &&
    typeof variant.js === 'string' &&
    variant.js.length < 50000 &&
    validMetadata(variant) &&
    (variant.constraints === undefined || validConstraints(variant.constraints)) &&
    canEmbedScript(variant.js) &&
    Array.isArray(variant.changes) &&
    variant.changes.length <= 8 &&
    [...variant.changes].every((change) => text(change, 501))
  )
}

// Both the browser harness and the editor transport use this boundary. TypeScript
// tuples alone do not protect against malformed messages at runtime.
export const validEditorCommand = (value: unknown): value is EditorCommand => {
  if (!isRecord(value)) return false
  switch (value.command) {
    case 'getState':
    case 'captureSource':
    case 'loadSample':
    case 'openSource':
    case 'cancelGeneration':
      return onlyKeys(value, ['command'])
    case 'configureProvider':
      return (
        onlyKeys(value, ['command', 'provider', 'action']) &&
        liveProvider(value.provider) &&
        (value.action === undefined ||
          (value.provider === 'cursor' && (value.action === 'check' || value.action === 'login')))
      )
    case 'copyHandoff':
    case 'exportHtml':
      return onlyKeys(value, ['command', 'variantId']) && id(value.variantId)
    case 'generate':
    case 'refine':
    case 'remix': {
      if (
        !isEngine(value.provider) ||
        !text(value.prompt, MAX_PROMPT_LENGTH + 1) ||
        (value.constraints !== undefined && !validConstraints(value.constraints))
      )
        return false
      if (value.command === 'generate') {
        return onlyKeys(value, ['command', 'provider', 'prompt', 'constraints'])
      }
      const count = value.command === 'refine' ? 1 : 2
      return (
        onlyKeys(value, ['command', 'provider', 'prompt', 'sourceIds', 'constraints']) &&
        Array.isArray(value.sourceIds) &&
        value.sourceIds.length === count &&
        [...value.sourceIds].every(id) &&
        new Set(value.sourceIds).size === count
      )
    }
    default:
      return false
  }
}

export const validEditorRequest = (value: unknown): value is EditorRequest => {
  if (!isRecord(value) || value.type !== 'request' || !id(value.id)) return false
  const command = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'type' && key !== 'id'),
  )
  return validEditorCommand(command)
}

const validSource = (source: unknown): source is SourceContext =>
  isRecord(source) &&
  id(source.id) &&
  text(source.relativePath, 4097) &&
  text(source.language, 101) &&
  text(source.code, MAX_SOURCE_LENGTH + 1) &&
  typeof source.startLine === 'number' &&
  Number.isSafeInteger(source.startLine) &&
  source.startLine >= 1 &&
  typeof source.endLine === 'number' &&
  Number.isSafeInteger(source.endLine) &&
  source.endLine >= source.startLine &&
  typeof source.selection === 'boolean'

const validProvider = (provider: unknown): provider is ProviderInfo =>
  isRecord(provider) &&
  liveProvider(provider.id) &&
  text(provider.label, 161) &&
  text(provider.model, 201) &&
  typeof provider.configured === 'boolean' &&
  (provider.detail === undefined || text(provider.detail, 1201)) &&
  (provider.connection === undefined ||
    (provider.id === 'cursor' &&
      ['checking', 'ready', 'signed-out', 'error'].includes(String(provider.connection)) &&
      provider.configured === (provider.connection === 'ready')))

const validStoredVariant = (variant: unknown): variant is Variant =>
  validVariant(variant) && 'id' in variant && id(variant.id)

export const validEditorStatus = (status: unknown): status is EditorStatus => {
  if (
    !isRecord(status) ||
    typeof status.busy !== 'boolean' ||
    typeof status.trusted !== 'boolean' ||
    !Array.isArray(status.providers) ||
    status.providers.length > 3 ||
    !status.providers.every(validProvider) ||
    new Set(status.providers.map((provider) => provider.id)).size !== status.providers.length
  )
    return false
  const activity = status.activity
  return (
    activity === null ||
    (status.busy &&
      isRecord(activity) &&
      [
        'captureSource',
        'loadSample',
        'openSource',
        'configureProvider',
        'generate',
        'refine',
        'remix',
        'copyHandoff',
        'exportHtml',
      ].includes(String(activity.command)) &&
      (activity.phase === 'confirming' || activity.phase === 'running'))
  )
}

export const validEditorState = (state: unknown): state is EditorState => {
  if (!isRecord(state)) return false
  const original = state.original
  if (
    !(state.source === null || validSource(state.source)) ||
    !(original === null || validStoredVariant(original)) ||
    !Array.isArray(state.variants) ||
    state.variants.length > MAX_VARIANTS ||
    ![...state.variants].every(
      (variant) =>
        validStoredVariant(variant) && variant.id !== 'original' && variant.changes.length > 0,
    ) ||
    new Set(state.variants.map((variant) => variant.id)).size !== state.variants.length ||
    state.variants.some((variant) => variant.id === original?.id) ||
    typeof state.intent !== 'string' ||
    state.intent.length > MAX_PROMPT_LENGTH ||
    !validConstraints(state.constraints) ||
    !Array.isArray(state.providers) ||
    state.providers.length > 3 ||
    ![...state.providers].every(validProvider) ||
    new Set(state.providers.map((provider) => provider.id)).size !== state.providers.length ||
    !validEditorStatus({
      providers: state.providers,
      busy: state.busy,
      activity: state.activity,
      trusted: state.trusted,
    })
  )
    return false

  const variants = state.variants as Variant[]
  for (const [index, variant] of variants.entries()) {
    if (
      variant.lineage &&
      (variant.lineage.sourceIds.some(
        (sourceId) => !variants.slice(0, index).some((source) => source.id === sourceId),
      ) ||
        !variants.some((source) => source.id === variant.lineage?.rootId))
    )
      return false
  }

  switch (state.baselineKind) {
    case 'none':
      return state.original === null && state.variants.length === 0
    case 'sample':
      return state.source === null && state.original !== null
    case 'reconstructed':
      return state.source !== null && state.original !== null
    default:
      return false
  }
}

export const validHostMessage = (value: unknown): value is HostMessage => {
  if (!isRecord(value)) return false
  if (value.type === 'state') return validEditorState(value.state)
  if (value.type === 'status')
    return (
      validEditorStatus(value.status) &&
      onlyKeys(value.status, ['providers', 'busy', 'activity', 'trusted'])
    )
  return (
    value.type === 'response' &&
    id(value.id) &&
    typeof value.ok === 'boolean' &&
    (value.cancelled === undefined || (typeof value.cancelled === 'boolean' && !value.ok)) &&
    (value.message === undefined ||
      (typeof value.message === 'string' && value.message.length <= 12000)) &&
    (value.error === undefined || (typeof value.error === 'string' && value.error.length <= 12000))
  )
}

export const parseGeneratedVariants = (value: unknown, expectedCount: number): Variant[] => {
  const error = 'The model returned an invalid implementation. Please try again.'
  if (!value || typeof value !== 'object' || !('variants' in value)) throw new Error(error)
  const variants = value.variants
  if (
    !Array.isArray(variants) ||
    variants.length !== expectedCount ||
    ![...variants].every(
      (variant) =>
        validVariant(variant) &&
        'id' in variant &&
        text(variant.id, 201) &&
        variant.id !== 'original' &&
        variant.changes.length > 0,
    ) ||
    new Set(variants.map((variant) => variant.id)).size !== variants.length
  )
    throw new Error(error)
  return variants
}
