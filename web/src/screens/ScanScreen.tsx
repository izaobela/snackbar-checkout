import { useEffect, useState } from 'react'

import { ConsoleFace, type Mood } from '../components/ConsoleFace'
import { OrderPanel } from '../components/OrderPanel'
import { ProductImage } from '../components/ProductImage'
import styles from './ScanScreen.module.css'
import type { Item, Menu } from '../api/types'
import type { CartTotals } from '../lib/cart'
import { formatMoney } from '../lib/money'

type Props = {
  menu: Menu
  totals: CartTotals
  onAdd: (itemId: string) => void
  onDecrement: (itemId: string) => void
  onPay: () => void
  onStartOver: () => void
}

const RECOGNISE_MS = 650
const SHOW_RESULT_MS = 2_800

// The camera is simulated: tapping a product stands in for placing it in front of the lens.
export function ScanScreen({ menu, totals, onAdd, onDecrement, onPay, onStartOver }: Props) {
  const [recognising, setRecognising] = useState<Item | null>(null)
  const [result, setResult] = useState<Item | null>(null)

  useEffect(() => {
    if (!recognising) return
    const timer = window.setTimeout(() => {
      if (recognising.available) onAdd(recognising.id)
      setResult(recognising)
      setRecognising(null)
    }, RECOGNISE_MS)
    return () => window.clearTimeout(timer)
  }, [recognising, onAdd])

  useEffect(() => {
    if (!result) return
    const timer = window.setTimeout(() => setResult(null), SHOW_RESULT_MS)
    return () => window.clearTimeout(timer)
  }, [result])

  const shown = recognising ?? result
  const mood: Mood = recognising ? 'thinking' : result ? (result.available ? 'happy' : 'sad') : 'idle'
  const status = recognising
    ? 'Recognising'
    : result
      ? result.available
        ? `${result.name}, ${formatMoney(result.price_cents, menu.currency)}, added to your order`
        : `${result.name} is sold out today`
      : 'Place a product on the tray'

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.console} aria-labelledby="scan-title">
          <h2 id="scan-title" className="visually-hidden">
            Scanner
          </h2>
          <div className={styles.shell}>
            <div className={styles.screen}>
              <ConsoleFace mood={mood} className={`${styles.face} ${shown ? styles.faceCorner : ''}`} />
              {shown && (
                <div className={styles.stage} aria-hidden="true">
                  <ProductImage item={shown} className={`${styles.product} ${shown.available ? '' : styles.productGrey}`} blend={false} />
                  {!recognising && <span className={`${styles.label} ${shown.available ? '' : styles.labelWarn}`}>{shown.name}</span>}
                </div>
              )}
              <output className={`${styles.status} ${result ? (result.available ? styles.statusAdded : styles.statusWarn) : ''}`} aria-live="polite">
                {status}
              </output>
            </div>
            <div className={styles.controls} aria-hidden="true">
              <span className={styles.dpad} />
              <span className={styles.grille} />
              <span className={styles.buttons}>
                <i className={`${styles.key} ${styles.keyB}`} />
                <i className={`${styles.key} ${styles.keyA}`} />
              </span>
            </div>
          </div>
        </section>

        <section className={styles.codes} aria-labelledby="codes-title">
          <div className={styles.codesHead}>
            <h2 id="codes-title" className={styles.codesTitle}>
              Products
            </h2>
            <p className={styles.codesHint}>Simulated camera: tap a product to put it in front of the scanner.</p>
          </div>
          <ul className={styles.chips} aria-label="Products">
            {menu.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.chip} ${item.available ? '' : styles.chipOff}`}
                  onClick={() => setRecognising(item)}
                  disabled={recognising !== null}
                  aria-label={item.available ? `Scan ${item.name}` : `Scan ${item.name}, sold out`}
                >
                  <ProductImage item={item} className={styles.chipImage} />
                  <span className={styles.chipName}>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <OrderPanel totals={totals} currency={menu.currency} onAdd={onAdd} onDecrement={onDecrement} onPay={onPay} onStartOver={onStartOver} />
    </div>
  )
}
