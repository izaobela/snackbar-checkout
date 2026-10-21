import { Barcode } from './Barcode'
import { OrderLines } from './OrderLines'
import styles from './Receipt.module.css'
import { Totals } from './Totals'
import type { Order } from '../api/types'
import { brandName } from '../lib/card'
import { formatDateTime, orderCode } from '../lib/format'

type Props = { order: Order }

/** The receipt as the counter printer would print it, shown on screen because there is no printer. */
export function Receipt({ order }: Props) {
  const code = orderCode(order.id)
  const lines = order.lines.map((l) => ({ id: l.item_id, name: l.name, qty: l.qty, totalCents: l.unit_price_cents * l.qty }))
  return (
    <section className={styles.paper} aria-labelledby="receipt-title">
      <header className={styles.head}>
        <h2 id="receipt-title" className={styles.shop}>
          Iza &amp; Bela Snack Bar
        </h2>
        <p className={styles.meta}>{formatDateTime(order.created_at)}</p>
        {order.pickup_number && <p className={`${styles.orderNumber} money`}>{`Order ${order.pickup_number}`}</p>}
      </header>
      <OrderLines lines={lines} currency={order.currency} />
      <div className={styles.totals}>
        <Totals subtotalCents={order.subtotal_cents} taxCents={order.tax_cents} totalCents={order.total_cents} currency={order.currency} totalLabel="Total" />
      </div>
      <p className={styles.tender}>
        {brandName(order.payment.brand)} ending in {order.payment.last4}, {order.payment.method === 'tap' ? 'tapped' : 'keyed'}
      </p>
      <div className={styles.code}>
        <Barcode value={code} label={`Barcode ${code}`} />
        <span className={styles.codeText}>{code}</span>
      </div>
      <p className={styles.thanks}>{order.pickup_number ? 'Thank you. Pick up at the counter when your number is called.' : 'Thank you. Enjoy.'}</p>
      <p className={styles.note}>Printed example: at the counter this comes out of the receipt printer. Nothing was charged.</p>
    </section>
  )
}
