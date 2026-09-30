import { Copy, Download, X } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { Dialog } from './Dialog'

export const ExportDialog = () => {
  const {
    inspected: selected,
    exportOpen,
    setExportOpen,
    exportTab,
    setExportTab,
    perform,
    loading,
    isEditor,
    errors,
    toast,
  } = useWorkspace()
  if (!exportOpen || !selected) return null
  return (
    <Dialog onClose={() => setExportOpen(false)}>
      <section className="modal export-modal" aria-labelledby="export-title">
        <div className="modal-heading">
          <h2 id="export-title">{selected.name}</h2>
          <button
            className="icon-button"
            onClick={() => setExportOpen(false)}
            aria-label="Close export"
          >
            <X size={18} />
          </button>
        </div>
        <p>
          Inspect the chosen implementation. Copy its context for Cursor or save a standalone HTML
          file.
        </p>
        <div className="code-tabs" aria-label="Implementation language">
          {(['html', 'css', 'js'] as const).map((tab) => (
            <button
              key={tab}
              className={exportTab === tab ? 'active' : ''}
              aria-pressed={exportTab === tab}
              onClick={() => setExportTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
        <pre className="code-preview">
          <code>{selected[exportTab] || '// No JavaScript for this direction.'}</code>
        </pre>
        {errors.export && (
          <p className="modal-error" role="alert">
            {errors.export}
          </p>
        )}
        {toast && <output className="dialog-status">{toast}</output>}
        <div className="export-actions">
          <button
            disabled={loading || selected.id === 'original'}
            onClick={() => void perform({ command: 'exportHtml', variantId: selected.id })}
          >
            <Download size={14} />
            Save HTML
          </button>
          <button
            className="primary"
            disabled={loading || !isEditor || selected.id === 'original'}
            onClick={() => void perform({ command: 'copyHandoff', variantId: selected.id })}
          >
            <Copy size={14} />
            Copy for Cursor
          </button>
        </div>
        <p className="export-disclaimer">
          Exported HTML runs outside the preview sandbox and omits its CSP. Review generated code
          and illustrative content before opening or shipping. Copying a brief does not apply it to
          your project.
        </p>
      </section>
    </Dialog>
  )
}
