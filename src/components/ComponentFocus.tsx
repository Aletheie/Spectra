import { useMemo, useState } from 'react'
import { componentProfiles, inferComponentKind, type ComponentKind } from '../domain/component'
import { useWorkspace } from '../state/WorkspaceProvider'

/** Suggestions are explicit edits; selecting a focus never silently replaces a draft. */
export const ComponentFocus = () => {
  const { source, loading, setPrompt, promptRef } = useWorkspace()
  const inferredKind = useMemo(() => (source ? inferComponentKind(source) : 'unknown'), [source])
  const [suggestion, setSuggestion] = useState<{ sourceId: string; kind: ComponentKind } | null>(
    null,
  )
  if (!source) return null
  const kind = suggestion?.sourceId === source.id ? suggestion.kind : inferredKind
  return (
    <div className="prompt-suggestion">
      <label htmlFor="suggestion-kind">Suggested focus</label>
      <select
        id="suggestion-kind"
        value={kind}
        disabled={loading}
        onChange={(event) => {
          const next = event.currentTarget.value
          if (Object.hasOwn(componentProfiles, next))
            setSuggestion({ sourceId: source.id, kind: next as ComponentKind })
        }}
      >
        {Object.entries(componentProfiles).map(([value, profile]) => (
          <option key={value} value={value}>
            {profile.label}
          </option>
        ))}
      </select>
      <button
        disabled={loading}
        onClick={() => {
          setPrompt(componentProfiles[kind].instruction)
          promptRef.current?.focus()
        }}
      >
        Use suggestion
      </button>
      <span>Snapshot-based suggestion · Applying replaces the instruction above</span>
    </div>
  )
}
