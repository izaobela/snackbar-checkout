import { useState } from 'react'

import { categoryIcon } from './categoryIcon'
import { Icon } from './Icon'
import styles from './ProductImage.module.css'
import type { Item } from '../api/types'

type Props = { item: Item; className?: string; blend?: boolean }

/**
 * The product photo, or the category tile when there is none or it fails to load. Photos are
 * shot on light tables, so blending them into the cream card makes the set read as one.
 */
export function ProductImage({ item, className = '', blend = true }: Props) {
  const [broken, setBroken] = useState(false)
  if (item.image && !broken) {
    return (
      <img
        src={item.image}
        alt=""
        loading="lazy"
        className={`${styles.image} ${blend ? styles.blend : ''} ${className}`}
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span className={`${styles.tile} ${styles[item.category] ?? ''} ${className}`} aria-hidden="true">
      <Icon name={categoryIcon(item.category)} size={32} />
    </span>
  )
}
