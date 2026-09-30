import { ArrowUpRight, Code2, FileCode2, FlaskConical } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { SpectraMark } from './SpectraMark'
import { reactLanguageFor } from '../domain/react'

export const SourcePanel = () => {
  const { source, baselineKind, perform, loading, isEditor, trusted, variants } = useWorkspace()
  if (!source && baselineKind !== 'sample')
    return (
      <section className="welcome">
        <div className="welcome-symbol">
          <SpectraMark size={32} />
          <span>Component exploration</span>
        </div>
        <h1>Explore a component</h1>
        <p>
          Capture source from your editor and compare three design directions side by side. Your
          project stays unchanged until you decide what to use.
        </p>
        <div className="welcome-actions">
          <button
            className="primary"
            disabled={!isEditor || !trusted || loading}
            onClick={() => void perform({ command: 'captureSource' })}
          >
            <FileCode2 size={16} />
            Use editor selection
          </button>
          <button disabled={loading} onClick={() => void perform({ command: 'loadSample' })}>
            <FlaskConical size={15} />
            Try curated sample
          </button>
        </div>
        {isEditor && !trusted && (
          <p className="help-text">
            Trust this workspace in Cursor to import source and use AI. Samples work without trust.
          </p>
        )}
        <div className="entry-hint">
          <Code2 size={15} />
          <span>
            Or right-click a component → <strong>Spectra: Explore Component</strong>
          </span>
        </div>
        <ol className="workflow-steps">
          <li>
            <strong>Capture source</strong>
            <span>Use a selection or the active component file.</span>
          </li>
          <li>
            <strong>Compare directions</strong>
            <span>Inspect previews, refine a direction or remix two.</span>
          </li>
          <li>
            <strong>Choose and use</strong>
            <span>Replace a React component, copy for Cursor or save HTML.</span>
          </li>
        </ol>
        <p className="privacy-note">
          Only the selected source snapshot is used. You confirm before it is sent to a provider. No
          repository scanning or automatic edits.
        </p>
      </section>
    )
  return (
    <section
      className={`source-panel ${variants.length ? 'source-compact' : ''}`}
      aria-label="Component context"
    >
      <div className="source-row">
        <FileCode2 size={16} />
        <h1>{source?.relativePath ?? 'Orbit / pricing-section.html'}</h1>
        <span className="badge">{source ? source.language : 'Curated sample'}</span>
        {source && (
          <span className="source-range">
            Lines {source.startLine}–{source.endLine}
            {source.selection ? ' · selection' : ' · full file'}
          </span>
        )}
        {source && (
          <button className="text-button" onClick={() => void perform({ command: 'openSource' })}>
            Open source
            <ArrowUpRight size={13} />
          </button>
        )}
      </div>
      <p>
        {source
          ? 'Captured source snapshot · Imported styles and dependencies are not included. AI previews are reconstructions, not your running app.'
          : 'Sample component · Demo mode uses three curated directions and preset transformations. It does not follow arbitrary instructions.'}
      </p>
      {reactLanguageFor(source) && (
        <p className="help-text">
          React + Tailwind output · Generate includes project code and an approximate HTML preview.
          Replacement targets only this captured {source?.selection ? 'selection' : 'file'} and
          opens an editor diff first.
        </p>
      )}
      {source && (
        <details className="source-details">
          <summary>
            Review captured source · {source.code.length.toLocaleString()} characters
          </summary>
          <pre>
            <code>{source.code}</code>
          </pre>
        </details>
      )}
    </section>
  )
}
