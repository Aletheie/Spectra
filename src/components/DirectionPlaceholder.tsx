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
          : ['Clearer hierarchy', 'A different structure', 'A better interaction'][index]}
      </h2>
      <p>
        {loading
          ? 'Your comparison appears when all previews and styles are ready.'
          : 'Generate to compare three approaches to your instruction.'}
      </p>
    </div>
  </article>
)
