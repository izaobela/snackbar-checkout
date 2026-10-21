import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { Totals } from '../components/Totals'
import styles from './MenuChangedScreen.module.css'
import type { Change, Totals as ServerTotals } from '../api/types'
import { formatMoney } from '../lib/money'

type Props = { changes: Change[]; totals: ServerTotals | null; currency: string; onConfirm: () => void; onBack: () => void }

function describe(change: Change, currency: string): string {
  if (change.reason === 'limited') return `Only ${change.left ?? 0} ${change.name} left, so your order has ${change.left ?? 0}.`
  if (change.reason === 'unavailable' || change.new_price_cents === null) return `${change.name} just sold out, so we took it out of your order.`
  return `${change.name} is now ${formatMoney(change.new_price_cents, currency)}, was ${formatMoney(change.old_price_cents, currency)}.`
}

export function MenuChangedScreen({ changes, totals, currency, onConfirm, onBack }: Props) {
  return (
    <section className={styles.screen} aria-labelledby="changed-title">
      <div className={styles.card}>
        <span className={styles.icon}>
          <Icon name="alert" size={32} />
        </span>
        <h1 id="changed-title" className={styles.title}>
          The menu changed while you were ordering
        </h1>
        <ul className={styles.list}>
          {changes.length === 0 && (
            // The server only reports a different total with no line changes when the tax moved.
            <li className={styles.item}>
              <Icon name="alert" size={22} />
              <span>The prices are the same, but the tax rate changed.</span>
            </li>
          )}
          {changes.map((change) => (
            <li key={`${change.item_id}-${change.reason}`} className={styles.item}>
              <Icon name={change.reason === 'unavailable' ? 'trash' : 'alert'} size={22} />
              <span>{describe(change, currency)}</span>
            </li>
          ))}
        </ul>
        {totals ? (
          <div>
            <Totals subtotalCents={totals.subtotal_cents} taxCents={totals.tax_cents} totalCents={totals.total_cents} currency={currency} />
            <p className={styles.newTotal}>Your new total is {formatMoney(totals.total_cents, currency)}.</p>
          </div>
        ) : (
          <p className={styles.newTotal}>Nothing is left in your order.</p>
        )}
        <div className={styles.actions}>
          <Button variant="secondary" size="primary" onClick={onBack}>
            <Icon name="arrowLeft" size={20} />
            Back to order
          </Button>
          {totals && (
            <Button variant="primary" size="primary" onClick={onConfirm} data-testid="confirm-new-total">
              Confirm {formatMoney(totals.total_cents, currency)}
              <Icon name="arrowRight" size={22} />
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
