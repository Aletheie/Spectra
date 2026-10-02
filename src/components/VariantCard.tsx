import { memo, useEffect, useRef } from 'react'
import { Check, Maximize2, Code2 } from 'lucide-react'
import { useCanvas } from '../state/WorkspaceProvider'
import { directionLabel } from '../domain/lineage'
import type { Variant } from '../domain/types'
import { Preview } from './Preview'

export const VariantCard = memo(
  ({
    variant,
    index,
    isOriginal = false,
  }: {
    variant: Variant
    index: number
    isOriginal?: boolean
  }) => {
    const {
      loading,
      remixIds,
      remixMode,
      setOperation,
      setInstruction,
      setExpanded,
      inspect,
      previewSettings,
      choose,
      toggleRemix,
      baselineKind,
      selected,
      active,
      view,
      variants,
      focusId,
      setFocusId,
    } = useCanvas()
    const card = useRef<HTMLElement>(null)
    const chooseButton = useRef<HTMLButtonElement>(null)
    const isSelected = selected?.id === variant.id
    useEffect(() => {
      if (focusId !== variant.id) return
      card.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      chooseButton.current?.focus({ preventScroll: true })
      setFocusId(null)
    }, [focusId, variant.id, setFocusId])
    const parents =
      variant.lineage?.sourceIds
        .map((id) => variants.find((item) => item.id === id))
        .filter((item): item is Variant => Boolean(item)) ?? []
    return (
      <article
        ref={card}
        id={`variant-${variant.id}`}
        className={`variant-card ${isOriginal ? 'original-card' : ''} ${isSelected ? 'chosen-card' : ''} ${remixIds.includes(variant.id) ? 'remix-selected' : ''}`}
        hidden={view === 'ship' && !isOriginal && !isSelected}
        data-active={view === 'ship' ? isSelected : active?.id === variant.id}
      >
        <div className="card-label">
          <span>
            {isOriginal ? 'ORIGINAL' : directionLabel(variant, index)}
            {isSelected && (
              <span className="selected-marker">
                <Check size={12} />
                Selected
              </span>
            )}
          </span>
          {isOriginal ? (
            <span className="badge">
              {baselineKind === 'reconstructed' ? 'AI reconstruction' : 'Sample'}
            </span>
          ) : (
            remixMode && (
              <label className="remix-checkbox">
                <input
                  type="checkbox"
                  checked={remixIds.includes(variant.id)}
                  disabled={loading || (remixIds.length === 2 && !remixIds.includes(variant.id))}
                  onChange={() => toggleRemix(variant.id)}
                  aria-label={`Select ${variant.name} for remix`}
                />
                {remixIds.includes(variant.id) ? `${remixIds.indexOf(variant.id) + 1}` : 'Remix'}
              </label>
            )
          )}
        </div>
        <div className="card-heading">
          <h2 title={variant.name}>{variant.name}</h2>
          <button
            className="icon-button"
            onClick={() => setExpanded(variant)}
            aria-label={`Expand ${variant.name}`}
            title="Open a separate, fresh preview"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <p className="hypothesis" title={variant.hypothesis}>
          {variant.hypothesis}
        </p>
        <div className="card-actions">
          <button
            className="text-button"
            onClick={() => setExpanded(variant)}
            aria-label={`Rationale and changes for ${variant.name}`}
          >
            Why / changes
          </button>
          {isOriginal ? (
            <button
              className="icon-button"
              onClick={() => inspect(variant)}
              aria-label="Inspect original code"
            >
              <Code2 size={14} />
            </button>
          ) : (
            <>
              <button
                disabled={loading}
                onClick={() => {
                  setInstruction('')
                  setOperation({ type: 'refine', sources: [variant] })
                }}
              >
                Refine
              </button>
              <button
                ref={chooseButton}
                className={isSelected ? '' : 'primary'}
                disabled={loading}
                onClick={() => choose(variant)}
              >
                {isSelected ? 'Selected' : 'Choose'}
              </button>
            </>
          )}
        </div>
        <Preview variant={variant} settings={previewSettings} />
        <div className="card-details">
          {parents.length > 0 ? (
            <p>
              {parents
                .map((parent) => directionLabel(parent, variants.indexOf(parent)))
                .join(' + ')}{' '}
              → {directionLabel(variant, index)}
            </p>
          ) : (
            <p>
              {isOriginal
                ? 'Fixed reference for this exploration'
                : 'Independent interactive preview'}
            </p>
          )}
          <button className="text-button" onClick={() => inspect(variant)}>
            Inspect code
          </button>
        </div>
      </article>
    )
  },
)
