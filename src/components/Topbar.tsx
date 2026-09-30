import { FileCode2, Settings2 } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { SpectraMark } from './SpectraMark'

export const Topbar = () => {
  const { source, baselineKind, setSettingsOpen, loading, perform, isEditor } = useWorkspace()
  return (
    <header className="topbar">
      <div className="product-name">
        <SpectraMark />
        <strong>Spectra</strong>
        <span>Component exploration</span>
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
