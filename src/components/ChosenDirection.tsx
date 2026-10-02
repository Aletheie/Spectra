import { Copy, Download, Code2, SlidersHorizontal } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { ReactActions } from './ReactActions'

export const ChosenDirection = () => {
  const {
    selected,
    source,
    loading,
    inspect,
    setInstruction,
    setOperation,
    perform,
    isEditor,
    trusted,
    errors,
  } = useWorkspace()
  if (!selected) return null
  return (
    <div className="chosen-toolbar" aria-label="Selected direction actions">
      <div className="handoff-context">
        <strong>{selected.name}</strong>
        <span>{source?.relativePath ?? 'Curated sample'}</span>
      </div>
      <div className="chosen-actions">
        <button
          disabled={loading}
          onClick={() => {
            setInstruction('')
            setOperation({ type: 'refine', sources: [selected] })
          }}
        >
          <SlidersHorizontal size={14} />
          Refine selected
        </button>
        <button disabled={loading} onClick={() => inspect(selected)}>
          <Code2 size={14} />
          Inspect code
        </button>
        <button
          disabled={loading || (isEditor && !trusted)}
          onClick={() => void perform({ command: 'exportHtml', variantId: selected.id })}
        >
          <Download size={14} />
          Save HTML
        </button>
        <button
          className={selected.react ? undefined : 'primary'}
          disabled={loading || !isEditor || !trusted}
          onClick={() => void perform({ command: 'copyHandoff', variantId: selected.id })}
        >
          <Copy size={14} />
          Copy brief
        </button>
        <ReactActions variant={selected} />
      </div>
      <p className="help-text">
        {!isEditor
          ? 'Browser harness: sample download only. Copy brief requires the extension.'
          : !trusted
            ? 'Trust this workspace to copy or save.'
            : selected.react
              ? 'React + Tailwind · Replace opens a diff and asks before editing the captured range. Unsaved changes are protected; the edit supports Undo. Tailwind must already be configured in your project. The HTML preview approximates the React code.'
              : 'Copy a brief, then paste it into your editor’s AI chat. Review the resulting diff.'}{' '}
        Exported HTML runs outside the preview sandbox; review it before opening.
      </p>
      {errors.export && (
        <p className="modal-error" role="alert">
          {errors.export}
        </p>
      )}
    </div>
  )
}
