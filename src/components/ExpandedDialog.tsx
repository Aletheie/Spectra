import { ArrowRight, X } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { Preview } from './Preview'
import { Dialog } from './Dialog'
import { PreviewControls } from './PreviewControls'

export const ExpandedDialog = () => {
  const { expanded, setExpanded, previewSettings, choose, original, loading, inspect } =
    useWorkspace()
  if (!expanded) return null
  return (
    <Dialog onClose={() => setExpanded(null)}>
      <section className="modal expanded-modal" aria-labelledby="expanded-title">
        <div className="modal-heading">
          <h2 id="expanded-title">{expanded.name}</h2>
          {expanded.id !== original?.id && (
            <button className="primary" disabled={loading} onClick={() => choose(expanded)}>
              Choose direction
              <ArrowRight size={14} />
            </button>
          )}
          <button
            className="icon-button"
            onClick={() => setExpanded(null)}
            aria-label="Close expanded preview"
          >
            <X size={18} />
          </button>
        </div>
        <p>{expanded.hypothesis}</p>
        <ul className="expanded-changes">
          {expanded.changes.map((change, index) => (
            <li key={index}>{change}</li>
          ))}
        </ul>
        <p className="help-text">
          Separate preview: interactions here start fresh and do not transfer to comparison or
          export. Your comparison previews keep their state.
        </p>
        <PreviewControls />
        <Preview variant={expanded} settings={previewSettings} />
        <div className="modal-footer">
          <span>Isolated HTML preview · Local interactions only</span>
          <button
            onClick={() => {
              setExpanded(null)
              inspect(expanded)
            }}
          >
            Inspect code
          </button>
        </div>
      </section>
    </Dialog>
  )
}
