import styles from './OrderLines.module.css'
import { formatMoney } from '../lib/money'

export type OrderLineView = { id: string; name: string; qty: number; totalCents: number }

type Props = { lines: OrderLineView[]; currency: string }

/** A read-only recap of the order: quantity, name, line total. */
export function OrderLines({ lines, currency }: Props) {
  return (
    <ul className={styles.lines}>
      {lines.map((line) => (
        <li key={line.id} className={styles.line}>
          <span>
            <span className={`${styles.qty} money`}>{line.qty}</span> {line.name}
          </span>
          <span className="money">{formatMoney(line.totalCents, currency)}</span>
        </li>
      ))}
    </ul>
  )
}
