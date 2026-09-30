import { constraintOptions, MAX_CONSTRAINTS_LENGTH } from '../domain/constraints'
import { useWorkspace } from '../state/WorkspaceProvider'

export const DesignConstraints = () => {
  const { constraints, setConstraints, loading, engine } = useWorkspace()
  const demo = engine === 'demo'
  return (
    <fieldset
      className="design-constraints"
      disabled={loading || demo}
      aria-describedby="constraints-help"
    >
      <legend>Design constraints</legend>
      <span className="constraints-label">Keep unchanged</span>
      <div className="constraint-options">
        {constraintOptions.map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={constraints[key]}
              onChange={(event) =>
                setConstraints((current) => ({ ...current, [key]: event.target.checked }))
              }
            />
            {label}
          </label>
        ))}
      </div>
      <label htmlFor="constraint-elements">
        Elements to keep <span>(optional)</span>
      </label>
      <textarea
        id="constraint-elements"
        value={constraints.elements}
        onChange={(event) =>
          setConstraints((current) => ({ ...current, elements: event.target.value }))
        }
        placeholder="E.g. keep the main button’s label, style and action."
        maxLength={MAX_CONSTRAINTS_LENGTH}
        rows={2}
        aria-describedby="constraints-help constraints-count"
      />
      <div className="constraints-footer">
        <p id="constraints-help">
          {demo
            ? 'Live AI only. Curated presets do not use constraints.'
            : 'Used for generation, refine and remix. Review results against the source.'}
        </p>
        <span id="constraints-count">
          {constraints.elements.length}/{MAX_CONSTRAINTS_LENGTH}
        </span>
      </div>
    </fieldset>
  )
}
