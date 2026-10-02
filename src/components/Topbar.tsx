import { FileCode2, Settings2 } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { SpectraMark } from './SpectraMark'

export const Topbar = () => {
  const { source, baselineKind, setSettingsOpen, loading, perform, isEditor, variants, view } =
    useWorkspace()
  return (
    <header className="topbar">
      <div className="product-name">
        <SpectraMark />
        <strong>Spectra</strong>
        <span>
          {view === 'ship'
            ? '3 / Use your direction'
            : variants.length
              ? '2 / Compare directions'
              : source || baselineKind === 'sample'
                ? '1 / Describe the change'
                : 'Start with your component'}
        </span>
      </div>
      <div className="topbar-actions">
        {(source || baselineKind === 'sample') && (
          <button
            disabled={loading || !isEditor}
            onClick={() => void perform({ command: 'captureSource' })}
          >
            <FileCode2 size={14} />
            Capture editor source
          </button>
        )}
        <button onClick={() => setSettingsOpen(true)}>
          <Settings2 size={14} />
          AI providers
        </button>
      </div>
    </header>
  )
}
