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
    const containerRef = useRef<HTMLDivElement>(null)
    const [activated, setActivated] = useState(false)
    useEffect(() => {
      const container = containerRef.current
      if (!container || activated) return
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActivated(true)
            observer.disconnect()
          }
        },
        { rootMargin: '100px' },
      )
      observer.observe(container)
      return () => observer.disconnect()
    }, [activated])
    const html = useMemo(
      () => (activated ? documentFor(variant, true, scriptNonce, diagnosticId) : ''),
      [variant, diagnosticId, activated],
    )
    const frameRef = useRef<HTMLIFrameElement>(null)
    const [measuredWidth, setMeasuredWidth] = useState(0)
    const [reload, setReload] = useState(0)
    const [status, setStatus] = useState('loading')
    useEffect(() => {
      if (!activated) return
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
    }, [diagnosticId, reload, activated])
    useEffect(() => {
      const frame = frameRef.current
      if (!frame) return
      // Dimensions come from the iframe element, not generated content.
      const observer = new ResizeObserver(([entry]) => {
        if (entry.contentRect.width > 0) setMeasuredWidth(Math.round(entry.contentRect.width))
      })
      observer.observe(frame)
      return () => observer.disconnect()
    }, [variant.id, reload, activated])
    const issue =
      status === 'script-error'
        ? 'Preview reported a script error.'
        : status === 'empty'
          ? 'No visible content detected.'
          : status === 'unknown'
            ? 'Preview could not report its status.'
            : ''
    return (
      <div className="preview-frame" ref={containerRef}>
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
          {activated ? (
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
          ) : (
            <div className="preview-deferred" style={{ height: settings.height }}>
              Preview loads when visible
            </div>
          )}
        </section>
        <div className="preview-dimensions">
          <span>
            {measuredWidth
              ? `${measuredWidth} × ${settings.height} px`
              : activated
                ? 'Measuring viewport…'
                : 'Preview on demand'}
          </span>
          <button
            className="text-button"
            aria-label={`Reset preview for ${variant.name}`}
            disabled={!activated}
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
