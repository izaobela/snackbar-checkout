import styles from './Totals.module.css'
import { formatMoney } from '../lib/money'

type Props = {
  subtotalCents: number
  taxCents: number
  totalCents: number
  currency: string
  taxLabel?: string
  /** Omit to leave the total line out, for screens that word it their own way. */
  totalLabel?: string
}

export function Totals({ subtotalCents, taxCents, totalCents, currency, taxLabel = 'Tax', totalLabel }: Props) {
  return (
    <div className={styles.rows}>
      <div className={styles.row}>
        <span>Subtotal</span>
        <span className="money">{formatMoney(subtotalCents, currency)}</span>
      </div>
      <div className={styles.row}>
        <span>{taxLabel}</span>
        <span className="money">{formatMoney(taxCents, currency)}</span>
      </div>
      {totalLabel && (
        <div className={`${styles.row} ${styles.total}`}>
          <span>{totalLabel}</span>
          <span className="money">{formatMoney(totalCents, currency)}</span>
        </div>
      )}
    </div>
  )
}
