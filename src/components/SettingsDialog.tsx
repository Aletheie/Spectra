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
          Use your own OpenAI or Anthropic API key, or connect the optional Cursor CLI provider.
          Direct API calls are billed separately. Cursor CLI usage follows your Cursor account
          limits and billing.
        </p>
        {providers.map((provider) => {
          const { id } = provider
          return (
            <div className="provider-row" key={id}>
              <div>
                <h3>{provider.label}</h3>
                <p>{provider.model}</p>
                <span className="provider-status">
                  {provider.detail ||
                    (id === 'cursor'
                      ? provider.configured
                        ? 'CLI login detected · Model access not checked'
                        : 'Check CLI login or sign in'
                      : provider.configured
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
                  : provider.configured
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
            Direct provider keys use a native password prompt and your editor’s SecretStorage.
            Change model IDs in the editor settings. The optional Cursor CLI provider needs a
            separate CLI installation and account login; spectra.cursorModel defaults to auto. No
            credentials enter this panel.
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
          Providers use the captured snapshot, not your editor chat history or selected chat model.
          Copy brief copies context for manual pasting into your editor’s AI chat.
        </p>
      </section>
    </Dialog>
  )
}
