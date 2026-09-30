import { hasConstraints } from '../domain/constraints'
import { demoResult } from '../domain/demo'
import { exportDocument } from '../domain/document'
import {
  MAX_VARIANTS,
  initialEditorState,
  samplePrompt,
  type EditorCommand,
  type EditorRequest,
  type EditorState,
} from '../domain/protocol'
import { parseGeneratedVariants, validEditorCommand, validHostMessage } from '../domain/validation'
import { original } from '../variants'
import { withLineage } from '../domain/lineage'
import { OperationCancelled } from '../domain/errors'

type EditorApi = { postMessage: (message: EditorRequest) => void }
type EditorWindow = Window & {
  acquireVsCodeApi?: () => EditorApi
}
type PendingRequest = {
  resolve: (message: string | undefined) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

// Acquire once, keep private. Generated iframes never receive this capability.
const api = (window as EditorWindow).acquireVsCodeApi?.()
// The about:blank content frame inherits the editor wrapper's origin. Cursor
// removes window.parent before our scripts run, so source identity is unavailable.
const hostOrigin = window.origin
export const isEditor = Boolean(api)
const listeners = new Set<(state: EditorState) => void>()
let latestState: EditorState | undefined
const pending = new Map<string, PendingRequest>()

export const subscribeEditor = (listener: (state: EditorState) => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  // Generated previews use sandbox="allow-scripts" and have the opaque "null"
  // origin. Only the editor wrapper's non-opaque origin may update host state.
  if (!api || !hostOrigin || hostOrigin === 'null' || event.origin !== hostOrigin) return
  const data = event.data
  // Validate before publishing state or consuming a pending request. A malformed
  // message must not discard the last canvas or swallow a later valid response.
  if (!validHostMessage(data)) return
  if (data.type === 'state' || data.type === 'status') {
    if (data.type === 'state') latestState = data.state
    else if (latestState) latestState = { ...latestState, ...data.status }
    else return
    for (const listener of listeners) listener(latestState)
  } else {
    const request = pending.get(data.id)
    if (!request) return
    clearTimeout(request.timer)
    pending.delete(data.id)
    if (data.ok) request.resolve(data.message)
    else
      request.reject(
        data.cancelled
          ? new OperationCancelled(data.error || 'Action cancelled.')
          : new Error(data.error || 'The editor could not complete this action.'),
      )
  }
})

// Deliberately limited: the browser is a UI development harness, not a second app.
let sampleState: EditorState = { ...initialEditorState }
const emitSample = () => {
  for (const listener of listeners) listener(sampleState)
}
const sampleRequest = async (command: EditorCommand): Promise<string | undefined> => {
  if (command.command === 'getState') {
    emitSample()
    return
  }
  if (command.command === 'loadSample') {
    sampleState = { ...initialEditorState, original, baselineKind: 'sample', intent: samplePrompt }
    emitSample()
    return 'Curated Orbit sample loaded. This is not live AI.'
  }
  if (
    command.command === 'generate' ||
    command.command === 'refine' ||
    command.command === 'remix'
  ) {
    if (command.provider !== 'demo' || sampleState.baselineKind !== 'sample') {
      throw new Error(
        'Open the Spectra extension in Cursor to explore your component with live AI.',
      )
    }
    if (command.constraints && hasConstraints(command.constraints)) {
      throw new Error(
        'Curated presets do not support design constraints. Select a live AI provider to use them.',
      )
    }
    if (sampleState.variants.length >= MAX_VARIANTS && command.command !== 'generate') {
      throw new Error(
        `This sample has ${MAX_VARIANTS} directions. Generate again to start a fresh comparison.`,
      )
    }
    const sources =
      command.command === 'generate'
        ? []
        : command.sourceIds.map((id) => {
            const variant = sampleState.variants.find((value) => value.id === id)
            if (!variant) throw new Error('That direction is no longer on the canvas.')
            return variant
          })
    const parsed = parseGeneratedVariants(
      { variants: demoResult(command.command, sources, command.prompt) },
      command.command === 'generate' ? 3 : 1,
    )
    const next = withLineage(
      parsed,
      sampleState.variants,
      command.command,
      command.command === 'generate' ? [] : command.sourceIds,
    )
    sampleState = {
      ...sampleState,
      intent: command.command === 'generate' ? command.prompt : sampleState.intent,
      variants: command.command === 'generate' ? next : [...sampleState.variants, ...next],
    }
    emitSample()
    return 'Curated sample updated. Instructions use limited preset transformations.'
  }
  if (command.command === 'exportHtml') {
    const variant = sampleState.variants.find((value) => value.id === command.variantId)
    if (!variant) throw new Error('Choose a direction first.')
    const url = URL.createObjectURL(new Blob([exportDocument(variant)], { type: 'text/html' }))
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = 'spectra-sample.html'
      link.click()
    } finally {
      // Release the URL even if initiating the download fails.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    return 'Sample HTML downloaded. Review before production use.'
  }
  throw new Error(
    'This action needs the Spectra extension in Cursor. The browser only runs curated samples.',
  )
}

export const sendToEditor = (command: EditorCommand): Promise<string | undefined> => {
  if (!validEditorCommand(command)) {
    return Promise.reject(
      new Error('Invalid editor command. Check the intent and source directions.'),
    )
  }
  if (!api) return sampleRequest(command)
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(
        new Error(
          'The editor did not respond. Check native confirmation dialogs or reopen Spectra.',
        ),
      )
    }, 180000)
    pending.set(id, { resolve, reject, timer })
    try {
      api.postMessage({ ...command, type: 'request', id })
    } catch {
      clearTimeout(timer)
      pending.delete(id)
      reject(new Error('Could not send the action to the editor. Reopen Spectra and try again.'))
    }
  })
}
