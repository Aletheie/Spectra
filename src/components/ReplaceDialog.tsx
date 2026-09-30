import { useWorkspace } from '../state/WorkspaceProvider'
import { Dialog } from './Dialog'

export const ReplaceDialog = () => {
  const { replaceOpen, setReplaceOpen, run, loading, canGenerate, variants, errors } =
    useWorkspace()
  if (!replaceOpen) return null
  return (
    <Dialog onClose={() => !loading && setReplaceOpen(false)}>
      <section className="modal" aria-labelledby="replace-title">
        <div className="modal-heading">
          <h2 id="replace-title">Replace this comparison?</h2>
        </div>
        <p>
          A successful generation will replace all {variants.length} directions and revisions, and
          clear your selection. Your original stays fixed. Copy or save anything you want to keep
          first.
        </p>
        <p>Cancellation or failure keeps the current comparison.</p>
        {errors.generate && (
          <p role="alert" className="modal-error">
            {errors.generate}
          </p>
        )}
        <div className="modal-footer">
          <button disabled={loading} onClick={() => setReplaceOpen(false)}>
            Keep comparison
          </button>
          <button
            className="primary"
            disabled={!canGenerate}
            onClick={() => {
              setReplaceOpen(false)
              void run('generate')
            }}
          >
            Replace directions
          </button>
        </div>
      </section>
    </Dialog>
  )
}
