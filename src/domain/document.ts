import type { Variant } from './types'
import { previewDiagnostics } from './preview-diagnostics'

export const documentFor = (
  variant: Variant,
  locked = true,
  scriptNonce?: string,
  diagnosticId?: string,
) => {
  const css = variant.css.replace(
    /<\/style(?=[\t\n\f\r />]|$)/gi,
    (match) => `<\\/${match.slice(2)}`,
  )
  const js = variant.js.replace(
    /<\/script(?=[\t\n\f\r />]|$)/gi,
    (match) => `<\\/${match.slice(2)}`,
  )
  // Generated scripts share a nonce with the outer webview to satisfy both CSPs.
  // Reject unsafe attribute characters even though the extension generates it.
  const nonce = scriptNonce && /^[a-zA-Z0-9+/_=-]+$/.test(scriptNonce) ? scriptNonce : undefined
  const policy = `default-src 'none'; script-src ${nonce ? `'nonce-${nonce}'` : "'unsafe-inline'"}; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'`
  const monitor = locked && diagnosticId ? previewDiagnostics(diagnosticId, nonce) : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${locked ? `<meta http-equiv="Content-Security-Policy" content="${policy}">` : ''}${monitor}<style>:where(body){margin:0}\n${css}</style></head><body>${variant.html}<script${nonce && locked ? ` nonce="${nonce}"` : ''}>${js}</script></body></html>`
}

export const exportDocument = (variant: Variant) => documentFor(variant, false)
