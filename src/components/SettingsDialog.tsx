import { KeyRound, X } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { Dialog } from './Dialog'

export const SettingsDialog = () => {
  const {
    providers,
    settingsOpen,
    setSettingsOpen,
    perform,
    isEditor,
    trusted,
    loading,
    errors,
    toast,
  } = useWorkspace()
  if (!settingsOpen) return null
  return (
    <Dialog onClose={() => setSettingsOpen(false)}>
      <section className="modal settings-modal" aria-labelledby="settings-title">
        <div className="modal-heading">
          <h2 id="settings-title">AI providers</h2>
          <button
            className="icon-button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Close AI providers"
          >
            <X size={18} />
          </button>
        </div>
        <p>
          Use your Cursor account through Cursor CLI, or your own OpenAI / Anthropic API key. Cursor
          usage follows your account limits and billing. Direct API calls are billed separately.
        </p>
        {(['cursor', 'openai', 'anthropic'] as const).map((id) => {
          const provider = providers.find((item) => item.id === id)
          return (
            <div className="provider-row" key={id}>
              <div>
                <h3>
                  {id === 'cursor'
                    ? 'Cursor account'
                    : id === 'openai'
                      ? 'OpenAI'
                      : 'Anthropic / Claude'}
                </h3>
                <p>{provider?.model ?? 'Configure in Cursor'}</p>
                <span className="provider-status">
                  {provider?.detail ||
                    (id === 'cursor'
                      ? provider?.configured
                        ? 'CLI login detected · Model access not checked'
                        : 'Check CLI login or sign in'
                      : provider?.configured
                        ? 'Key saved · Not a connectivity check'
                        : 'No API key saved')}
                </span>
              </div>
              <button
                disabled={!isEditor || !trusted || loading}
                onClick={() => void perform({ command: 'configureProvider', provider: id })}
              >
                <KeyRound size={14} />
                {id === 'cursor'
                  ? 'Connect / check'
                  : provider?.configured
                    ? 'Manage key'
                    : 'Add key'}
              </button>
            </div>
          )
        })}
        {errors.settings && (
          <p className="modal-error" role="alert">
            {errors.settings}
          </p>
        )}
        {toast && <output className="dialog-status">{toast}</output>}
        <div className="settings-note">
          <strong>Sign-in stays outside this panel.</strong>
          <p>
            Cursor CLI uses its own account login and separate Spectra configuration. Install the
            CLI first, then check the connection or sign in with your Cursor account. Direct
            provider keys use a native password prompt and SecretStorage. Change model IDs in Cursor
            settings; spectra.cursorModel defaults to auto. No credentials enter this panel.
          </p>
        </div>
        {!isEditor && (
          <p className="help-text">
            Open the installed extension or Extension Development Host to configure live AI.
          </p>
        )}
        {isEditor && !trusted && (
          <p className="help-text">Provider setup requires a trusted workspace.</p>
        )}
        <p className="help-text">
          Cursor CLI generates previews from the captured snapshot. It does not inherit your editor
          chat history or selected model. Copy for Cursor remains a manual handoff.
        </p>
      </section>
    </Dialog>
  )
}
