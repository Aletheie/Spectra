import { Copy, FilePenLine } from 'lucide-react'
import type { Variant } from '../domain/types'
import { useWorkspace } from '../state/WorkspaceProvider'

export const ReactActions = ({ variant }: { variant: Variant }) => {
  const { loading, isEditor, trusted, source, perform } = useWorkspace()
  if (!variant.react) return null
  return (
    <>
      <button
        disabled={loading || !isEditor || !trusted}
        onClick={() => void perform({ command: 'copyReact', variantId: variant.id })}
      >
        <Copy size={14} /> Copy React
      </button>
      <button
        className="primary"
        disabled={loading || !isEditor || !trusted || !source}
        onClick={() => void perform({ command: 'replaceComponent', variantId: variant.id })}
      >
        <FilePenLine size={14} /> Replace component…
      </button>
    </>
  )
}
