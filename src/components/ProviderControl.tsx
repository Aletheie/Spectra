import { useWorkspace } from '../state/WorkspaceProvider'
import { isEngine } from '../domain/validation'

export const ProviderControl = ({ id = 'engine' }: { id?: string }) => {
  const {
    engine,
    setEngine,
    providers,
    baselineKind,
    loading,
    generationBlock,
    setSettingsOpen,
    isEditor,
    trusted,
    provider,
    perform,
  } = useWorkspace()
  return (
    <div className="provider-options">
      <div className="provider-control">
        <label htmlFor={id}>Provider</label>
        <select
          id={id}
          value={engine}
          disabled={loading}
          onChange={(event) => {
            const { value } = event.currentTarget
            if (isEngine(value)) setEngine(value)
          }}
          aria-describedby={`${id}-help`}
        >
          {(['cursor', 'openai', 'anthropic'] as const).map((value) => (
            <option key={value} value={value}>
              {value === 'cursor' ? 'Cursor account' : value === 'openai' ? 'OpenAI' : 'Claude'}
              {providers.find((item) => item.id === value)?.configured ? '' : ' · setup needed'}
            </option>
          ))}
          {baselineKind === 'sample' && <option value="demo">Curated demo</option>}
        </select>
        {provider && <span className="model-label">{provider.model}</span>}
      </div>
      <p id={`${id}-help`} className="help-text">
        {generationBlock ||
          (engine === 'demo'
            ? 'Curated presets · Not live AI'
            : 'Snapshot sent only after your confirmation.')}
        {generationBlock && isEditor && trusted && engine !== 'demo' && (
          <button className="text-button" onClick={() => setSettingsOpen(true)}>
            AI providers
          </button>
        )}
      </p>
      {engine === 'cursor' && isEditor && trusted && !provider?.configured && (
        <div className="provider-control">
          <button
            disabled={loading || provider?.connection === 'checking'}
            onClick={() =>
              void perform({ command: 'configureProvider', provider: 'cursor', action: 'check' })
            }
          >
            {provider?.connection === 'checking' ? 'Checking Cursor…' : 'Check Cursor'}
          </button>
          <button
            disabled={loading}
            onClick={() =>
              void perform({ command: 'configureProvider', provider: 'cursor', action: 'login' })
            }
          >
            Sign in to Cursor CLI
          </button>
        </div>
      )}
    </div>
  )
}
