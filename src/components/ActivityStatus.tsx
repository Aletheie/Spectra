import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useWorkspace } from '../state/WorkspaceProvider'

const ElapsedTime = () => {
  const [started] = useState(Date.now)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [started])
  return (
    <span className="elapsed-time" aria-live="off">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} elapsed
    </span>
  )
}

export const ActivityStatus = () => {
  const { activity, generating, perform } = useWorkspace()
  if (!activity) return null
  const text = generating
    ? activity.phase === 'confirming'
      ? 'Waiting for your confirmation in the editor…'
      : activity.progress
        ? `${activity.progress.completed} of ${activity.progress.total} previews ready · ${activity.command === 'refine' ? 'Refining your direction' : activity.command === 'remix' ? 'Combining your directions' : 'Building the comparison'}`
        : 'Generating previews. Your previous results remain available.'
    : activity.command === 'configureProvider'
      ? 'Provider setup is open in the editor. Complete or cancel the native prompt.'
      : activity.command === 'replaceComponent'
        ? 'Review the React diff in the editor, then confirm Replace component or dismiss the notification.'
        : activity.command === 'copyReact'
          ? 'Copying React code…'
          : activity.command === 'copyHandoff'
            ? 'Copying the implementation brief…'
            : activity.command === 'exportHtml'
              ? activity.phase === 'confirming'
                ? 'Choose a save location in the editor, or cancel to keep working.'
                : 'Saving HTML…'
              : activity.command === 'openSource'
                ? 'Opening source…'
                : activity.command === 'loadSample'
                  ? 'Loading the curated sample…'
                  : 'Capturing source. Check any confirmation in the editor.'
  return (
    <div className="activity-row">
      <output>
        <LoaderCircle size={14} className="spin" aria-hidden="true" />
        {text}
      </output>
      {generating && activity.phase === 'running' && (
        <>
          {activity.progress && (
            <progress
              aria-label="Completed previews"
              value={activity.progress.completed}
              max={activity.progress.total}
            />
          )}
          <ElapsedTime />
        </>
      )}
      {generating && activity.phase === 'running' && (
        <button onClick={() => void perform({ command: 'cancelGeneration' })}>
          Cancel generation
        </button>
      )}
    </div>
  )
}
