import type { ReactNode } from 'react'

import { Icon } from './Icon'
import styles from './Notice.module.css'

type Props = { tone: 'danger' | 'info'; title: string; children?: ReactNode; actions?: ReactNode; small?: string }

export function Notice({ tone, title, children, actions, small }: Props) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={tone === 'info' ? 'clock' : 'alert'} size={24} />
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.text}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
        {small && <p className={styles.small}>{small}</p>}
      </div>
    </div>
  )
}
