import { Button } from './Button'
import { Icon } from './Icon'
import styles from './OrderPanel.module.css'
import { Totals } from './Totals'
import { type CartTotals, lineTotal } from '../lib/cart'
import { itemCount } from '../lib/format'
import { formatMoney } from '../lib/money'

type Props = {
  totals: CartTotals
  currency: string
  onAdd: (itemId: string) => void
  onDecrement: (itemId: string) => void
  onPay: () => void
  onStartOver: () => void
  payDisabled?: boolean
}

export function OrderPanel({ totals, currency, onAdd, onDecrement, onPay, onStartOver, payDisabled }: Props) {
  const empty = totals.lines.length === 0
  const taxPercent = (totals.taxRateBps / 100).toFixed(2).replace(/\.?0+$/, '')
  return (
    <aside className={styles.panel} aria-labelledby="order-title">
      <div className={styles.head}>
        <h2 id="order-title" className={styles.title}>
          Your order
        </h2>
        <span className={styles.count} aria-live="polite">
          {itemCount(totals.count)}
        </span>
      </div>

      <ul className={styles.lines} aria-label="Your order">
        {empty && (
          <li className={styles.empty}>
            <Icon name="bag" size={28} />
            <span className={styles.emptyTitle}>Nothing here yet</span>
            <span className={styles.emptyHint}>Tap an item to add it.</span>
          </li>
        )}
        {totals.lines.map((line) => (
          <li key={line.itemId} className={styles.line}>
            <div className={styles.lineTop}>
              <span className={styles.lineName}>{line.name}</span>
              <span className={`${styles.lineTotal} money`}>{formatMoney(lineTotal(line), currency)}</span>
            </div>
            <div className={styles.lineBottom}>
              <fieldset className={styles.stepper}>
                <legend className="visually-hidden">Quantity of {line.name}</legend>
                <button
                  type="button"
                  className={styles.stepButton}
                  onClick={() => onDecrement(line.itemId)}
                  aria-label={line.qty === 1 ? `Remove ${line.name}` : `Remove one ${line.name}`}
                >
                  <Icon name={line.qty === 1 ? 'trash' : 'minus'} size={22} />
                </button>
                <span className={`${styles.qty} money`} aria-live="polite">
                  {line.qty}
                </span>
                <button type="button" className={styles.stepButton} onClick={() => onAdd(line.itemId)} aria-label={`Add one more ${line.name}`}>
                  <Icon name="plus" size={22} />
                </button>
              </fieldset>
              <span className={`${styles.each} money`}>{formatMoney(line.unitPriceCents, currency)} each</span>
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.foot}>
        <Totals subtotalCents={totals.subtotalCents} taxCents={totals.taxCents} totalCents={totals.totalCents} currency={currency} taxLabel={`Tax (${taxPercent}%)`} totalLabel="Total" />
        <Button variant="primary" size="primary" block disabled={empty || payDisabled} onClick={onPay} data-testid="pay">
          {empty ? 'Pay' : `Pay ${formatMoney(totals.totalCents, currency)}`}
          <Icon name="arrowRight" size={22} />
        </Button>
        <Button variant="quiet" block onClick={onStartOver} disabled={empty}>
          <Icon name="undo" size={18} />
          Start over
        </Button>
      </div>
    </aside>
  )
}
