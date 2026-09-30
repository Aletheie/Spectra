import { useEffect, useRef, type ReactNode } from 'react'

/** Native modal semantics isolate background content and trap keyboard focus. */
export const Dialog = ({ children, onClose }: { children: ReactNode; onClose: () => void }) => {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = document.activeElement
    const section = dialog.querySelector('section')
    const label = section?.getAttribute('aria-label')
    const labelledBy = section?.getAttribute('aria-labelledby')
    if (label) dialog.setAttribute('aria-label', label)
    if (labelledBy) dialog.setAttribute('aria-labelledby', labelledBy)
    dialog.showModal()
    const input = dialog.querySelector<HTMLTextAreaElement>('textarea')
    input?.focus()
    const cancel = (event: Event) => {
      event.preventDefault()
      closeRef.current()
    }
    const backdropClick = (event: MouseEvent) => {
      if (event.target === dialog) closeRef.current()
    }
    dialog.addEventListener('cancel', cancel)
    dialog.addEventListener('click', backdropClick)
    return () => {
      dialog.removeEventListener('cancel', cancel)
      dialog.removeEventListener('click', backdropClick)
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog ref={ref} className="modal-overlay">
      {children}
    </dialog>
  )
}
