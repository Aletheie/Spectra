import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Variant } from '../domain/types'
import type { PreviewSettings } from '../domain/preview'
import { documentFor } from '../domain/document'
import { isRecord } from '../domain/guards'

// A srcdoc frame also inherits the editor webview's CSP. Only this preview script
// receives the host nonce; it still runs in an opaque, network-blocked sandbox.
const scriptNonce = document.documentElement.dataset.scriptNonce
export const Preview = memo(
  ({ variant, settings }: { variant: Variant; settings: PreviewSettings }) => {
    const [diagnosticId] = useState(() => crypto.randomUUID())
    const html = useMemo(
      () => documentFor(variant, true, scriptNonce, diagnosticId),
      [variant, diagnosticId],
    )
    const frameRef = useRef<HTMLIFrameElement>(null)
    const [measuredWidth, setMeasuredWidth] = useState(0)
    const [reload, setReload] = useState(0)
    const [status, setStatus] = useState('loading')
    useEffect(() => {
      const listener = (event: MessageEvent<unknown>) => {
        if (event.source !== frameRef.current?.contentWindow || !isRecord(event.data)) return
        const data = event.data
        if (
          data.type === 'spectra-preview' &&
          data.id === diagnosticId &&
          (data.kind === 'ready' || data.kind === 'script-error' || data.kind === 'empty')
        )
          setStatus(data.kind)
      }
      window.addEventListener('message', listener)
      const timeout = setTimeout(
        () => setStatus((current) => (current === 'loading' ? 'unknown' : current)),
        5000,
      )
      return () => {
        window.removeEventListener('message', listener)
        clearTimeout(timeout)
      }
    }, [diagnosticId, reload])
    useEffect(() => {
      const frame = frameRef.current
      if (!frame) return
      // Dimensions come from the iframe element, not generated content.
      const observer = new ResizeObserver(([entry]) => {
        if (entry.contentRect.width > 0) setMeasuredWidth(Math.round(entry.contentRect.width))
      })
      observer.observe(frame)
      return () => observer.disconnect()
    }, [variant.id, reload])
    const issue =
      status === 'script-error'
        ? 'Preview reported a script error.'
        : status === 'empty'
          ? 'No visible content detected.'
          : status === 'unknown'
            ? 'Preview could not report its status.'
            : ''
    return (
      <div className="preview-frame">
        {issue && (
          <output className="preview-issue">
            {issue} Use Inspect code. Diagnostics do not verify correctness.
          </output>
        )}
        <section
          className={`preview preview-surface-${settings.surface}`}
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-label={`${variant.name} preview viewport; scroll to inspect`}
        >
          <iframe
            ref={frameRef}
            key={`${variant.id}-${reload}`}
            title={`${variant.name} interactive preview`}
            sandbox="allow-scripts"
            srcDoc={html}
            style={{
              width: settings.width === 'fit' ? '100%' : settings.width,
              height: settings.height,
            }}
          />
        </section>
        <div className="preview-dimensions">
          <span>
            {measuredWidth ? `${measuredWidth} × ${settings.height} px` : 'Measuring viewport…'}
          </span>
          <button
            className="text-button"
            aria-label={`Reset preview for ${variant.name}`}
            onClick={() => {
              setStatus('loading')
              setReload((current) => current + 1)
            }}
          >
            Reset
          </button>
          <span>
            {settings.surface === 'checkerboard'
              ? 'Transparency grid'
              : `${settings.surface === 'dark' ? 'Dark' : 'Light'} canvas`}
          </span>
        </div>
      </div>
    )
  },
)
