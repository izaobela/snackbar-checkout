import type { ButtonHTMLAttributes, ReactNode } from 'react'

import styles from './Button.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  size?: 'primary' | 'min'
  block?: boolean
  children: ReactNode
}

export function Button({ variant = 'secondary', size = 'min', block = false, className, children, type = 'button', ...rest }: Props) {
  const classes = [styles.button, styles[variant], styles[size], block ? styles.block : '', className ?? '']
  return (
    <button type={type} className={classes.join(' ').trim()} {...rest}>
      {children}
    </button>
  )
}
