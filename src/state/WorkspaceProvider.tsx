import { emptyConstraints, type DesignConstraints } from '../domain/constraints'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Variant } from '../domain/types'
import {
  componentPrompt,
  initialEditorState,
  samplePrompt,
  type Activity,
  type EditorCommand,
  type EditorState,
  type Engine,
} from '../domain/protocol'
import { OperationCancelled } from '../domain/errors'
import { isEditor, sendToEditor, subscribeEditor } from '../services/editor'
import { defaultPreviewSettings, type PreviewSettings } from '../domain/preview'
import { inferComponentKind, suggestedComponentPrompt } from '../domain/component'

type Operation = { type: 'refine' | 'remix'; sourceIds: string[] }
type ErrorScope = 'workspace' | 'generate' | 'refine' | 'remix' | 'export' | 'settings'
const scopeFor = (command: EditorCommand['command']): ErrorScope =>
  command === 'generate' || command === 'refine' || command === 'remix'
    ? command
    : command === 'configureProvider'
      ? 'settings'
      : command === 'copyHandoff' || command === 'exportHtml'
        ? 'export'
        : 'workspace'
const useWorkspaceController = () => {
  const [editor, setEditor] = useState<EditorState>(initialEditorState)
  const editorRef = useRef(editor)
  const [prompt, setPrompt] = useState(componentPrompt)
  const [constraints, setConstraints] = useState<DesignConstraints>(emptyConstraints)
  const [promptExpanded, setPromptExpanded] = useState(true)
  const [engine, setEngine] = useState<Engine>('cursor')
  const [pending, setPending] = useState<EditorCommand['command'] | null>(null)
  const inFlight = useRef(false)
  const [view, setView] = useState<'compare' | 'ship'>('compare')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [remixIds, setRemixIds] = useState<string[]>([])
  const [remixMode, setRemixMode] = useState(false)
  const [operationState, setOperationState] = useState<Operation | null>(null)
  const [instruction, setInstruction] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [exportTab, setExportTab] = useState<'html' | 'css' | 'js'>('html')
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>(defaultPreviewSettings)
  const [showOriginal, setShowOriginal] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<ErrorScope, string>>>({})
  const [toast, setToast] = useState('')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const loading = editor.busy || pending !== null
  const activity: Activity | null =
    editor.activity ??
    (pending && pending !== 'getState' ? { command: pending, phase: 'running' } : null)
  const generating = Boolean(activity && ['generate', 'refine', 'remix'].includes(activity.command))
  const selected = editor.variants.find((variant) => variant.id === selectedId) ?? null
  const active =
    editor.variants.find((variant) => variant.id === activeId) ??
    selected ??
    editor.variants[0] ??
    null
  const expanded =
    [editor.original, ...editor.variants].find((variant) => variant?.id === expandedId) ?? null
  const inspected =
    editor.variants.find((variant) => variant.id === inspectionId) ??
    (editor.original?.id === inspectionId ? editor.original : null)
  const operationSources =
    operationState?.sourceIds
      .map((id) => editor.variants.find((variant) => variant.id === id))
      .filter((variant): variant is Variant => Boolean(variant)) ?? []
  const operation =
    operationState && operationSources.length === operationState.sourceIds.length
      ? { type: operationState.type, sources: operationSources }
      : null
  const provider = editor.providers.find((item) => item.id === engine)
  const generationBlock =
    !editor.source && !editor.original
      ? 'Capture a component or load the curated sample first.'
      : engine === 'demo'
        ? editor.baselineKind === 'sample'
          ? ''
          : 'Curated presets require the sample component.'
        : !isEditor
          ? 'Live generation is available in the Cursor extension. Select Curated demo to explore this sample.'
          : !editor.trusted
            ? 'Trust this workspace in Cursor to enable live generation.'
            : !provider?.configured
              ? provider?.detail ||
                (engine === 'cursor'
                  ? 'Connect Cursor CLI or check its login in AI providers.'
                  : 'Add a key for this provider in AI providers.')
              : ''
  const canGenerate = !loading && !generationBlock
  const setError = useCallback(
    (message: string, scope: ErrorScope = 'workspace') =>
      setErrors((current) => ({ ...current, [scope]: message })),
    [],
  )
  const notify = useCallback((message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 6000)
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeEditor((next) => {
      const previous = editorRef.current
      const contextChanged =
        previous.source?.id !== next.source?.id ||
        (next.baselineKind === 'sample' && previous.baselineKind !== 'sample') ||
        (next.variants.length === 0 && previous.variants.length > 0 && !next.busy)
      if (
        contextChanged ||
        JSON.stringify(previous.constraints) !== JSON.stringify(next.constraints)
      ) {
        setConstraints(next.constraints)
      }
      if (contextChanged) {
        setPrompt(
          next.intent || (next.source ? suggestedComponentPrompt(next.source) : samplePrompt),
        )
        setPromptExpanded(true)
        const kind = next.source ? inferComponentKind(next.source) : 'section'
        setPreviewSettings((current) => ({
          ...current,
          height: kind === 'control' || kind === 'navigation' ? 240 : 560,
        }))
        setEngine((current) =>
          !next.source
            ? 'demo'
            : current !== 'demo' &&
                next.providers.some((item) => item.id === current && item.configured)
              ? current
              : (next.providers.find((item) => item.configured)?.id ?? 'cursor'),
        )
        setSelectedId(null)
        setActiveId(null)
        setRemixIds([])
        setRemixMode(false)
        setOperationState(null)
        setExpandedId(null)
        setInspectionId(null)
        setReplaceOpen(false)
        setView('compare')
        setErrors({})
      }
      const exists = (id: string | null) => next.variants.some((variant) => variant.id === id)
      setSelectedId((current) => (exists(current) ? current : null))
      setActiveId((current) => (exists(current) ? current : (next.variants[0]?.id ?? null)))
      setExpandedId((current) =>
        exists(current) || next.original?.id === current ? current : null,
      )
      setInspectionId((current) =>
        exists(current) || next.original?.id === current ? current : null,
      )
      setOperationState((current) => (current?.sourceIds.every(exists) ? current : null))
      setRemixIds((current) => current.filter(exists))
      // Status deltas already retain content identity. Full updates reuse unchanged implementations.
      const stableVariant = (variant: Variant) => {
        const before =
          previous.original?.id === variant.id
            ? previous.original
            : previous.variants.find((item) => item.id === variant.id)
        return before &&
          (before === variant ||
            (before.html === variant.html &&
              before.css === variant.css &&
              before.js === variant.js &&
              before.name === variant.name &&
              before.hypothesis === variant.hypothesis &&
              before.changes.join('\n') === variant.changes.join('\n') &&
              JSON.stringify(before.lineage) === JSON.stringify(variant.lineage) &&
              JSON.stringify(before.sample) === JSON.stringify(variant.sample) &&
              JSON.stringify(before.constraints) === JSON.stringify(variant.constraints)))
          ? before
          : variant
      }
      const stableState =
        next.variants === previous.variants && next.original === previous.original
          ? next
          : {
              ...next,
              original: next.original ? stableVariant(next.original) : null,
              variants: next.variants.map(stableVariant),
            }
      editorRef.current = stableState
      setEditor(stableState)
    })
    void sendToEditor({ command: 'getState' }).catch((error: unknown) => {
      setError(error instanceof Error ? error.message : 'Could not read the editor state.')
    })
    return () => {
      unsubscribe()
      clearTimeout(toastTimer.current)
    }
  }, [setError])

  const perform = useCallback(
    async (command: EditorCommand) => {
      if (command.command === 'cancelGeneration') {
        try {
          await sendToEditor(command)
          return true
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Could not cancel.')
          return false
        }
      }
      if (inFlight.current || editorRef.current.busy) return false
      inFlight.current = true
      setPending(command.command)
      const scope = scopeFor(command.command)
      setError('', scope)
      try {
        const message = await sendToEditor(command)
        if (
          command.command === 'configureProvider' &&
          (command.action === 'login' ||
            editorRef.current.providers.some(
              (item) => item.id === command.provider && item.configured,
            ))
        ) {
          setEngine(command.provider)
        }
        if (message) notify(message)
        return true
      } catch (error) {
        if (error instanceof OperationCancelled) notify(error.message)
        else
          setError(
            error instanceof Error ? error.message : 'The action could not be completed.',
            scope,
          )
        return false
      } finally {
        inFlight.current = false
        setPending(null)
      }
    },
    [notify, setError],
  )

  const run = async (
    action: 'generate' | 'refine' | 'remix',
    sources: Variant[] = [],
    text = prompt,
  ) => {
    if (!text.trim() || !canGenerate) return
    if (
      (action === 'refine' && sources.length !== 1) ||
      (action === 'remix' && sources.length !== 2)
    ) {
      setError('Choose the required source directions before continuing.', action)
      return
    }
    const command: EditorCommand =
      action === 'generate'
        ? {
            command: action,
            provider: engine,
            constraints: engine === 'demo' ? undefined : constraints,
            prompt: text,
          }
        : action === 'refine'
          ? {
              command: action,
              provider: engine,
              constraints: engine === 'demo' ? undefined : constraints,
              prompt: text,
              sourceIds: [sources[0].id],
            }
          : {
              command: action,
              provider: engine,
              constraints: engine === 'demo' ? undefined : constraints,
              prompt: text,
              sourceIds: [sources[0].id, sources[1].id],
            }
    if (await perform(command)) {
      setPromptExpanded(false)
      setReplaceOpen(false)
      if (action === 'generate') {
        setSelectedId(null)
        setRemixIds([])
        setRemixMode(false)
        setView('compare')
        setActiveId(editorRef.current.variants[0]?.id ?? null)
      } else {
        const id = editorRef.current.variants.at(-1)?.id ?? null
        setActiveId(id)
        setFocusId(id)
        setShowOriginal(false)
        if (view === 'ship') setSelectedId(id)
        if (action === 'remix') {
          setRemixIds([])
          setRemixMode(false)
        }
      }
      setOperationState(null)
      setInstruction('')
    }
  }
  const requestGenerate = () =>
    editor.variants.length ? setReplaceOpen(true) : void run('generate')
  const choose = (variant: Variant) => {
    if (!editorRef.current.variants.some((item) => item.id === variant.id)) {
      setError('That direction is no longer available.')
      return
    }
    setSelectedId(variant.id)
    setActiveId(variant.id)
    setView('ship')
    setExpandedId(null)
    setShowOriginal(false)
  }
  const setOperation = (next: { type: 'refine' | 'remix'; sources: Variant[] } | null) => {
    setOperationState(
      next ? { type: next.type, sourceIds: next.sources.map((source) => source.id) } : null,
    )
    if (next) setError('', next.type)
  }
  const toggleRemix = (id: string) =>
    setRemixIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 2
          ? [...current, id]
          : current,
    )
  const openRemix = () => {
    const sources = remixIds
      .map((id) => editor.variants.find((variant) => variant.id === id))
      .filter((variant): variant is Variant => Boolean(variant))
    if (sources.length !== 2) return
    setInstruction(
      `Use the structure from source 1 (${sources[0].name}) and the interaction and visual emphasis from source 2 (${sources[1].name}). Preserve the component’s scope and functionality.`,
    )
    setOperation({ type: 'remix', sources })
  }
  return {
    ...editor,
    constraints,
    setConstraints,
    previewSettings,
    setPreviewSettings,
    revealId: focusId ?? activeId,
    loading,
    activity,
    generating,
    canGenerate,
    generationBlock,
    isEditor,
    prompt,
    setPrompt,
    promptExpanded,
    setPromptExpanded,
    promptRef,
    engine,
    setEngine,
    provider,
    view,
    setView,
    selected,
    choose,
    active,
    setActiveId,
    focusId,
    setFocusId,
    showOriginal,
    setShowOriginal,
    remixIds,
    setRemixIds,
    remixMode,
    setRemixMode,
    toggleRemix,
    openRemix,
    operation,
    setOperation,
    instruction,
    setInstruction,
    expanded,
    setExpanded: (variant: Variant | null) => setExpandedId(variant?.id ?? null),
    inspected,
    inspect: (variant: Variant) => setInspectionId(variant.id),
    exportOpen: Boolean(inspected),
    setExportOpen: (open: boolean) => setInspectionId(open ? (selected?.id ?? null) : null),
    exportTab,
    setExportTab,
    settingsOpen,
    setSettingsOpen,
    replaceOpen,
    setReplaceOpen,
    errors,
    error: errors.workspace || errors.generate || '',
    setError,
    toast,
    notify,
    perform,
    run,
    requestGenerate,
  }
}
type WorkspaceController = ReturnType<typeof useWorkspaceController>
const WorkspaceContext = createContext<WorkspaceController | null>(null)
export const WorkspaceProvider = ({ children }: { children: ReactNode }) => (
  <WorkspaceContext.Provider value={useWorkspaceController()}>{children}</WorkspaceContext.Provider>
)
export const useWorkspace = () => {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('Workspace components require WorkspaceProvider')
  return context
}
