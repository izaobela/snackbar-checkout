import { useRef, useState } from 'react'

import { Button } from '../components/Button'
import { categoryIcon } from '../components/categoryIcon'
import { Icon } from '../components/Icon'
import { MenuCard } from '../components/MenuCard'
import { OrderPanel } from '../components/OrderPanel'
import styles from './MenuScreen.module.css'
import type { Menu } from '../api/types'
import type { CartLine, CartTotals } from '../lib/cart'
import { itemCount } from '../lib/format'

type Props = {
  menu: Menu | null
  menuFailed: boolean
  onRetryMenu: () => void
  lines: CartLine[]
  totals: CartTotals
  onAdd: (itemId: string) => void
  onDecrement: (itemId: string) => void
  onPay: () => void
  onStartOver: () => void
}

export function MenuScreen({ menu, menuFailed, onRetryMenu, lines, totals, onAdd, onDecrement, onPay, onStartOver }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  if (menuFailed && !menu) {
    return (
      <section className={styles.unavailable} role="alert">
        <Icon name="alert" size={48} />
        <h1 className={styles.unavailableTitle}>We can't take orders right now</h1>
        <p className={styles.unavailableBody}>Please ask at the counter. We'll keep trying in the background.</p>
        <Button variant="primary" size="primary" onClick={onRetryMenu}>
          Retry
        </Button>
      </section>
    )
  }

  const categories = menu?.categories ?? []
  const current = activeCategory ?? categories[0]?.id ?? null
  const quantity = (itemId: string) => lines.find((l) => l.itemId === itemId)?.qty ?? 0

  const jumpTo = (categoryId: string) => {
    setActiveCategory(categoryId)
    gridRef.current?.querySelector<HTMLElement>(`[data-category="${categoryId}"]`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }

  return (
    <div className={styles.layout}>
      <nav className={styles.rail} aria-label="Categories">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`${styles.railButton} ${current === category.id ? styles.railActive : ''}`}
            onClick={() => jumpTo(category.id)}
            aria-current={current === category.id ? 'true' : undefined}
          >
            <Icon name={categoryIcon(category.id)} size={24} />
            <span>{category.name}</span>
          </button>
        ))}
      </nav>

      <div className={styles.grid} ref={gridRef}>
        <p className={styles.hint}>
          Tap an item to add it to your order. <span className={styles.legend}>V vegetarian, VG vegan, GF gluten-free.</span>
        </p>
        {menu ? (
          categories.map((category) => {
            const items = menu.items.filter((item) => item.category === category.id)
            if (items.length === 0) return null
            return (
              <section key={category.id} className={styles.section} data-category={category.id} aria-labelledby={`cat-${category.id}`}>
                <h2 id={`cat-${category.id}`} className={styles.sectionTitle}>
                  {category.name} <span className={styles.sectionCount}>{itemCount(items.length)}</span>
                </h2>
                <div className={styles.cards}>
                  {items.map((item) => (
                    <MenuCard key={item.id} item={item} quantity={quantity(item.id)} currency={menu.currency} onAdd={onAdd} />
                  ))}
                </div>
              </section>
            )
          })
        ) : (
          <p className={styles.loading} aria-busy="true">
            Loading the menu
          </p>
        )}
      </div>

      <OrderPanel
        totals={totals}
        currency={menu?.currency ?? 'USD'}
        onAdd={onAdd}
        onDecrement={onDecrement}
        onPay={onPay}
        onStartOver={onStartOver}
        payDisabled={!menu}
      />
    </div>
  )
}
