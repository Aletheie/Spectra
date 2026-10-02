import { Check, Columns3, Shuffle } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { directionLabel } from '../domain/lineage'
import { ChosenDirection } from './ChosenDirection'
import { DirectionPlaceholder } from './DirectionPlaceholder'
import { VariantCard } from './VariantCard'
import { RefinementDialog } from './RefinementDialog'
import { PreviewControls } from './PreviewControls'

export const ComparisonCanvas = () => {
  const {
    original,
    variants,
    generating,
    view,
    setView,
    selected,
    active,
    setActiveId,
    remixIds,
    setRemixIds,
    remixMode,
    setRemixMode,
    previewSettings,
    openRemix,
    baselineKind,
    loading,
    showOriginal,
    setShowOriginal,
  } = useWorkspace()
  return (
    <section className="canvas-section" aria-label="Comparison canvas" aria-busy={generating}>
      <div className="canvas-toolbar">
        <div className="canvas-tabs">
          <button
            className={view === 'compare' ? 'active' : ''}
            aria-pressed={view === 'compare'}
            onClick={() => setView('compare')}
          >
            <Columns3 size={15} />
            Compare
          </button>
          {selected && (
            <button
              className={view === 'ship' ? 'active' : ''}
              aria-pressed={view === 'ship'}
              onClick={() => setView('ship')}
            >
              <Check size={15} />
              Selected{selected && ` · ${directionLabel(selected, variants.indexOf(selected))}`}
            </button>
          )}
        </div>
        <div className="canvas-controls">
          <details className="preview-settings">
            <summary>
              Viewport · {previewSettings.width === 'fit' ? 'Fit' : `${previewSettings.width} px`} ×{' '}
              {previewSettings.height}
            </summary>
            <PreviewControls />
          </details>
          {view === 'compare' && variants.length > 0 && (
            <button
              disabled={loading}
              aria-pressed={remixMode}
              onClick={() => {
                setRemixMode(!remixMode)
                setRemixIds([])
              }}
            >
              <Shuffle size={14} />
              {remixMode ? 'Exit remix' : 'Remix two…'}
            </button>
          )}
        </div>
      </div>
      <div className="canvas-caption">
        <span>
          {baselineKind === 'reconstructed'
            ? 'Original · AI reconstruction, not your running component'
            : baselineKind === 'sample'
              ? 'Curated Orbit sample · Design hypotheses, not measured outcomes'
              : 'First generation reconstructs your original from the captured source'}
        </span>
      </div>
      {view === 'ship' && selected && <ChosenDirection />}
      {remixMode && view === 'compare' && (
        <div className="remix-bar" aria-label="Remix sources">
          {[0, 1].map((index) => {
            const source = variants.find((variant) => variant.id === remixIds[index])
            return (
              <span key={index}>
                <strong>{index === 0 ? '1 · Layout' : '2 · Emphasis + action'}</strong>{' '}
                {source
                  ? `${directionLabel(source, variants.indexOf(source))} · ${source.name}`
                  : 'Select a direction'}
              </span>
            )
          })}
          <button disabled={remixIds.length !== 2 || loading} onClick={openRemix}>
            Remix {remixIds.length}/2
          </button>
          {remixIds.length === 2 && (
            <span className="help-text">Uncheck a source to replace it.</span>
          )}
        </div>
      )}
      <RefinementDialog />
      {variants.length > 0 && (
        <div className="direction-navigation" aria-label="Directions and revisions">
          <button
            className="original-switch"
            aria-pressed={showOriginal}
            onClick={() => setShowOriginal(!showOriginal)}
          >
            {showOriginal ? 'Show direction' : 'Show original'}
          </button>
          {variants.map((variant, index) => (
            <button
              key={variant.id}
              aria-pressed={active?.id === variant.id}
              title={variant.name}
              onClick={() => {
                setActiveId(variant.id)
                setShowOriginal(false)
                if (view === 'ship' && selected?.id !== variant.id) setView('compare')
                document
                  .getElementById(`variant-${variant.id}`)
                  ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
              }}
            >
              {directionLabel(variant, index)}
              {selected?.id === variant.id && <Check size={12} aria-label="Selected" />}
            </button>
          ))}
        </div>
      )}
      <section
        className={`comparison-grid ${view === 'ship' ? 'chosen-grid' : ''} ${showOriginal || !variants.length ? 'show-original' : ''}`}
        style={
          previewSettings.width === 'fit'
            ? undefined
            : { gridAutoColumns: previewSettings.width + 1 }
        }
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        data-fixed-width={previewSettings.width !== 'fit' || undefined}
        aria-label="Original and directions"
      >
        {original ? (
          <VariantCard variant={original} index={0} isOriginal />
        ) : (
          <article className="variant-card baseline-pending">
            <div className="card-label">Original · Pending reconstruction</div>
            <div className="baseline-explanation">
              <h2>Source captured</h2>
              <p>
                Generate to reconstruct an HTML reference and compare three directions. Imported
                styles and application context may be missing.
              </p>
            </div>
          </article>
        )}
        {variants.length
          ? variants.map((variant, index) => (
              <VariantCard key={variant.id} variant={variant} index={index} />
            ))
          : [0, 1, 2].map((index) => (
              <DirectionPlaceholder key={index} index={index} loading={generating} />
            ))}
      </section>
    </section>
  )
}
