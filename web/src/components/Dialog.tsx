import { useEffect, useRef, type ReactNode } from 'react'

import styles from './Dialog.module.css'

type Props = { open: boolean; title: string; onClose?: () => void; children: ReactNode }

export function Dialog({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
    const dialog = ref.current
    if (!dialog) return
    // jsdom has neither method; the attribute fallback keeps the tests honest.
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  // The close event also fires when we close it ourselves; only report the person's close.
  const report = () => {
    if (openRef.current) onClose?.()
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={`${title}-title`}
      onCancel={(event) => {
        event.preventDefault()
        report()
      }}
      onClose={report}
    >
      <div className={styles.body}>
        <h2 className={styles.title} id={`${title}-title`}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  )
}
