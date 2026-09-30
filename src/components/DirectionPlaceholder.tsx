export const DirectionPlaceholder = ({ index, loading }: { index: number; loading: boolean }) => (
  <article className="placeholder-card">
    <div className="card-label">
      <span>DIRECTION {String.fromCharCode(65 + index)}</span>
      <span className="direction-marker">{String.fromCharCode(65 + index)}</span>
    </div>
    <div className="placeholder-body">
      <div className={`wireframe ${loading ? 'is-loading' : ''}`} aria-hidden="true">
        <span />
        <span />
        <div>
          <i />
          <i />
          <i />
        </div>
        <span />
      </div>
      <h2>
        {loading
          ? 'Waiting for the model'
          : ['A different structure', 'A different hierarchy', 'A different interaction'][index]}
      </h2>
      <p>
        {loading
          ? 'The canvas updates only after a complete, validated response.'
          : 'A hypothesis shaped by your component and intent. Not just another color.'}
      </p>
    </div>
  </article>
)
