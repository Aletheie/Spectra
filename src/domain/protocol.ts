import type { Variant } from './types'
import { emptyConstraints, type DesignConstraints } from './constraints'

export type LiveProvider = 'cursor' | 'openai' | 'anthropic'
export type Engine = LiveProvider | 'demo'

/** Only this explicitly captured snapshot may leave the editor. No dependency crawling. */
export type SourceContext = {
  id: string
  relativePath: string
  language: string
  code: string
  startLine: number
  endLine: number
  selection: boolean
}

export type ProviderInfo = {
  id: LiveProvider
  label: string
  model: string
  configured: boolean
  connection?: 'checking' | 'ready' | 'signed-out' | 'error'
  detail?: string
}

export type EditorState = {
  source: SourceContext | null
  original: Variant | null
  variants: Variant[]
  baselineKind: 'none' | 'sample' | 'reconstructed'
  intent: string
  constraints: DesignConstraints
  providers: ProviderInfo[]
  busy: boolean
  activity: Activity | null
  trusted: boolean
}

export type EditorCommand =
  | { command: 'getState' }
  | { command: 'captureSource' }
  | { command: 'loadSample' }
  | { command: 'openSource' }
  | { command: 'cancelGeneration' }
  | { command: 'configureProvider'; provider: LiveProvider; action?: 'check' | 'login' }
  | { command: 'generate'; provider: Engine; prompt: string; constraints?: DesignConstraints }
  | {
      command: 'refine'
      provider: Engine
      prompt: string
      sourceIds: [string]
      constraints?: DesignConstraints
    }
  | {
      command: 'remix'
      provider: Engine
      prompt: string
      sourceIds: [string, string]
      constraints?: DesignConstraints
    }
  | { command: 'copyHandoff'; variantId: string }
  | { command: 'exportHtml'; variantId: string }
  | { command: 'replaceComponent'; variantId: string }
  | { command: 'copyReact'; variantId: string }

export type EditorRequest = EditorCommand & { type: 'request'; id: string }
export type Activity = { command: EditorCommand['command']; phase: 'confirming' | 'running' }
export type EditorStatus = Pick<EditorState, 'providers' | 'busy' | 'activity' | 'trusted'>
export type HostMessage =
  | { type: 'state'; state: EditorState }
  | { type: 'status'; status: EditorStatus }
  | {
      type: 'response'
      id: string
      ok: boolean
      cancelled?: boolean
      message?: string
      error?: string
    }

export const initialEditorState: EditorState = {
  source: null,
  original: null,
  variants: [],
  baselineKind: 'none',
  intent: '',
  constraints: emptyConstraints,
  providers: [],
  busy: false,
  activity: null,
  trusted: false,
}

export const MAX_SOURCE_LENGTH = 60000
export const MAX_PROMPT_LENGTH = 3000
export const MAX_VARIANTS = 15
export const samplePrompt = 'Make this feel premium and make the yearly plan the obvious choice.'
export const componentPrompt = 'Improve the hierarchy and make the primary action clearer.'
