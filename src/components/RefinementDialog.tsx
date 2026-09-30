import { useEffect, useRef } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { MAX_PROMPT_LENGTH } from '../domain/protocol'
import { directionLabel } from '../domain/lineage'
import { useWorkspace } from '../state/WorkspaceProvider'
import { ProviderControl } from './ProviderControl'
import { constraintsSummary } from '../domain/constraints'

const RefinementPanel = () => {
  const {
    engine,
    loading,
    canGenerate,
    operation,
    setOperation,
    instruction,
    setInstruction,
    errors,
    run,
    variants,
    constraints,
  } = useWorkspace()
  const input = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    input.current?.focus({ preventScroll: true })
    input.current?.scrollIntoView({ block: 'nearest' })
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [])
  if (!operation) return null
  const error = errors[operation.type]
  const submit = () => void run(operation.type, operation.sources, instruction)
  return (
    <section className="refinement-panel" aria-labelledby="refine-title">
      <div className="modal-heading">
        <h2 id="refine-title">
          {operation.type === 'remix' ? 'Remix two directions' : 'Refine direction'}
        </h2>
        <button
          className="icon-button"
          onClick={() => setOperation(null)}
          aria-label="Close refinement"
        >
          <X size={16} />
        </button>
      </div>
      <div className="source-pills">
        {operation.sources.map((source, index) => (
          <span className="badge" key={source.id}>
            {operation.type === 'remix' ? (index === 0 ? 'Layout: ' : 'Emphasis + action: ') : ''}
            {directionLabel(source, variants.indexOf(source))} · {source.name}
          </span>
        ))}
      </div>
      <label htmlFor="refine-input">What should change?</label>
      {engine !== 'demo' && (
        <p className="refine-constraints">
          Keep unchanged: {constraintsSummary(constraints) || 'No design constraints specified'}.
          Edit constraints beside the main instruction.
        </p>
      )}
      <div className="prompt-row">
        <textarea
          ref={input}
          id="refine-input"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              setOperation(null)
            }
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          placeholder="Keep this direction, but shorten the introduction and clarify the action."
          rows={2}
          maxLength={MAX_PROMPT_LENGTH}
          disabled={loading}
          aria-describedby={error ? 'refine-error refine-engine-help' : 'refine-engine-help'}
        />
        <button className="primary" disabled={!instruction.trim() || !canGenerate} onClick={submit}>
          <ArrowRight size={14} />
          {operation.type === 'remix' ? 'Create remix' : 'Create revision'}
        </button>
      </div>
      {error && (
        <p id="refine-error" className="modal-error" role="alert">
          {error}
        </p>
      )}
      <div className="prompt-meta">
        <ProviderControl id="refine-engine" />
        <span className="keyboard-hint">
          <kbd>⌘ / Ctrl</kbd> + <kbd>Enter</kbd>
        </span>
      </div>
      <p className="help-text">
        {engine === 'demo' ? 'Curated transformation · ' : ''}A new version is added; your source
        directions stay available.
      </p>
    </section>
  )
}
export const RefinementDialog = () => {
  const { operation } = useWorkspace()
  return operation ? (
    <RefinementPanel
      key={`${operation.type}-${operation.sources.map((source) => source.id).join('-')}`}
    />
  ) : null
}
