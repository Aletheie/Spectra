import { ArrowRight, ChevronDown, Pencil } from 'lucide-react'
import { MAX_PROMPT_LENGTH } from '../domain/protocol'
import { useWorkspace } from '../state/WorkspaceProvider'
import { ProviderControl } from './ProviderControl'
import { DesignConstraints } from './DesignConstraints'
import { constraintsSummary } from '../domain/constraints'
import { ComponentFocus } from './ComponentFocus'

export const PromptPanel = () => {
  const {
    prompt,
    setPrompt,
    promptExpanded,
    setPromptExpanded,
    variants,
    loading,
    canGenerate,
    requestGenerate,
    promptRef,
    engine,
    provider,
    constraints,
  } = useWorkspace()
  if (!promptExpanded && variants.length)
    return (
      <section className="intent-summary" aria-label="Design instruction">
        <span className="summary-label">Intent</span>
        <span className="intent-text" title={prompt}>
          {prompt}
        </span>
        {engine !== 'demo' && constraintsSummary(constraints) && (
          <span className="constraints-summary" title={constraintsSummary(constraints)}>
            Keep: {constraintsSummary(constraints)}
          </span>
        )}
        <span className="model-label">
          {engine === 'demo'
            ? 'Curated demo'
            : `${provider?.label ?? engine} · ${provider?.model ?? ''}`}
        </span>
        <button disabled={loading} onClick={() => setPromptExpanded(true)}>
          <Pencil size={13} />
          Edit intent
        </button>
        <button disabled={!canGenerate} onClick={requestGenerate}>
          New comparison
        </button>
      </section>
    )
  return (
    <section className="prompt-panel">
      <div className="prompt-heading">
        <label htmlFor="intent">What should improve?</label>
        {variants.length > 0 && (
          <button className="text-button" onClick={() => setPromptExpanded(false)}>
            <ChevronDown size={13} />
            Collapse
          </button>
        )}
      </div>
      <div className="prompt-fields">
        <div className="prompt-row">
          <textarea
            id="intent"
            ref={promptRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={2}
            placeholder="Describe a change to the layout, hierarchy or interaction…"
            maxLength={MAX_PROMPT_LENGTH}
            disabled={loading}
            aria-describedby="engine-help"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                requestGenerate()
              }
            }}
          />
          <button
            className="primary"
            disabled={!canGenerate || !prompt.trim()}
            onClick={requestGenerate}
          >
            <ArrowRight size={15} />
            {variants.length ? 'New comparison…' : 'Generate 3 directions'}
          </button>
        </div>
        <DesignConstraints />
      </div>
      <ComponentFocus />
      <div className="prompt-meta">
        <ProviderControl />
        <span className="keyboard-hint">
          <kbd>⌘ / Ctrl</kbd> + <kbd>Enter</kbd>
        </span>
      </div>
      {variants.length > 0 && (
        <p className="help-text">
          New comparison replaces the existing directions and revisions after confirmation.
        </p>
      )}
    </section>
  )
}
