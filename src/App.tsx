import { Check, ShieldCheck, X } from 'lucide-react'
import { WorkspaceProvider, useWorkspace } from './state/WorkspaceProvider'
import { Topbar } from './components/Topbar'
import { SourcePanel } from './components/SourcePanel'
import { PromptPanel } from './components/PromptPanel'
import { ComparisonCanvas } from './components/ComparisonCanvas'
import { ActivityStatus } from './components/ActivityStatus'
import { ReplaceDialog } from './components/ReplaceDialog'
import { ExpandedDialog } from './components/ExpandedDialog'
import { ExportDialog } from './components/ExportDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { SpectraMark } from './components/SpectraMark'

const Workspace = () => {
  const { error, setError, toast, isEditor, baselineKind, source } = useWorkspace()
  return (
    <main className="workbench">
      <Topbar />
      {!isEditor && (
        <div className="harness-notice">
          <strong>Browser harness</strong>
          <span>
            Curated samples only. Open the extension in Cursor to use your component and AI
            providers.
          </span>
        </div>
      )}
      <SourcePanel />
      {(source || baselineKind === 'sample') && <PromptPanel />}
      <ActivityStatus />
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            onClick={() => {
              setError('')
              setError('', 'generate')
            }}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {(source || baselineKind === 'sample') && <ComparisonCanvas />}
      <footer className="workspace-footer">
        <span>
          <SpectraMark size={16} />
          Spectra · Session only
        </span>
        <span>
          <ShieldCheck size={12} aria-hidden="true" />
          No automatic project edits
        </span>
      </footer>
      {toast && (
        <output className="toast">
          <Check size={15} />
          {toast}
        </output>
      )}
      <ReplaceDialog />
      <ExpandedDialog />
      <ExportDialog />
      <SettingsDialog />
    </main>
  )
}
const App = () => (
  <WorkspaceProvider>
    <Workspace />
  </WorkspaceProvider>
)
export default App
