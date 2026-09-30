import { LoaderCircle } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'

export const ActivityStatus = () => {
  const { activity, generating, perform } = useWorkspace()
  if (!activity) return null
  const text = generating
    ? activity.phase === 'confirming'
      ? 'Waiting for your confirmation in Cursor…'
      : 'Generating previews. Your previous results remain available.'
    : activity.command === 'configureProvider'
      ? 'Provider setup is open in Cursor. Complete or cancel the native prompt.'
      : activity.command === 'replaceComponent'
        ? 'Review the React diff in Cursor, then confirm Replace component or dismiss the notification.'
        : activity.command === 'copyReact'
          ? 'Copying React code…'
          : activity.command === 'copyHandoff'
            ? 'Copying the implementation brief…'
            : activity.command === 'exportHtml'
              ? activity.phase === 'confirming'
                ? 'Choose a save location in Cursor, or cancel to keep working.'
                : 'Saving HTML…'
              : activity.command === 'openSource'
                ? 'Opening source…'
                : activity.command === 'loadSample'
                  ? 'Loading the curated sample…'
                  : 'Capturing source. Check any confirmation in Cursor.'
  return (
    <div className="activity-row">
      <output>
        <LoaderCircle size={14} className="spin" aria-hidden="true" />
        {text}
      </output>
      {generating && activity.phase === 'running' && (
        <button onClick={() => void perform({ command: 'cancelGeneration' })}>
          Cancel generation
        </button>
      )}
    </div>
  )
}
