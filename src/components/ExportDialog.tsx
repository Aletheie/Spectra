import { Copy, Download, X } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { Dialog } from './Dialog'
import { ReactActions } from './ReactActions'

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
  const tab = exportTab === 'react' && !selected.react ? 'html' : exportTab
  const tabs = selected.react
    ? (['react', 'html', 'css', 'js'] as const)
    : (['html', 'css', 'js'] as const)
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
          {selected.react
            ? 'React + Tailwind is the project code. HTML/CSS/JS form a separate visual approximation for comparison.'
            : 'Inspect the chosen implementation. Copy its context for Cursor or save a standalone HTML file.'}
        </p>
        <div className="code-tabs" aria-label="Implementation language">
          {tabs.map((item) => (
            <button
              key={item}
              className={tab === item ? 'active' : ''}
              aria-pressed={tab === item}
              onClick={() => setExportTab(item)}
            >
              {item === 'react'
                ? `React / ${selected.react?.language.toUpperCase()}`
                : item.toUpperCase()}
            </button>
          ))}
        </div>
        <pre className="code-preview">
          <code>
            {(tab === 'react' ? selected.react?.code : selected[tab]) ||
              '// No JavaScript for this direction.'}
          </code>
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
            className={selected.react ? undefined : 'primary'}
            disabled={loading || !isEditor || selected.id === 'original'}
            onClick={() => void perform({ command: 'copyHandoff', variantId: selected.id })}
          >
            <Copy size={14} />
            Copy for Cursor
          </button>
          <ReactActions variant={selected} />
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
