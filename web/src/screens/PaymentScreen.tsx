import { useEffect, useState } from 'react'

import { Button } from '../components/Button'
import { CardFields } from '../components/CardFields'
import { Icon } from '../components/Icon'
import { Keypad } from '../components/Keypad'
import { Notice } from '../components/Notice'
import { OrderLines } from '../components/OrderLines'
import styles from './PaymentScreen.module.css'
import type { Payment } from '../api/types'
import { type CartTotals, lineTotal } from '../lib/cart'
import { itemCount } from '../lib/format'
import type { CheckoutError } from '../hooks/useCheckout'
import { type CardEntry, type CardErrors, type CardField, EMPTY_ENTRY, FIELDS, deleteDigit, enterDigit, nextField, toPayment, validateCard } from '../lib/card'
import { formatMoney } from '../lib/money'

type Props = {
  totals: CartTotals
  currency: string
  error: CheckoutError | null
  submitting: boolean
  onSubmit: (payment: Payment) => void
  onRetry: () => void
  onBack: () => void
}

export function PaymentScreen({ totals, currency, error, submitting, onSubmit, onRetry, onBack }: Props) {
  const [entry, setEntry] = useState<CardEntry>(EMPTY_ENTRY)
  const [errors, setErrors] = useState<CardErrors>({})
  const amount = formatMoney(totals.totalCents, currency)

  const typeDigits = (digits: string) => {
    setErrors((e) => ({ ...e, [entry.active]: undefined }))
    setEntry((current) => [...digits].reduce(enterDigit, current))
  }
  const erase = () => setEntry(deleteDigit)
  const advance = () => setEntry(nextField)
  const focusField = (field: CardField) => setEntry((current) => ({ ...current, active: field }))
  // Whatever an input receives (an IME, autofill, the browser's own typing) is re-entered as digits.
  const changeField = (field: CardField, value: string) => {
    setErrors((e) => ({ ...e, [field]: undefined }))
    setEntry((current) => [...value.replace(/\D/g, '')].reduce(enterDigit, { draft: { ...current.draft, [field]: '' }, active: field }))
  }

  // A hardware keyboard and a paste drive the same entry as the keypad.
  useEffect(() => {
    if (submitting) return
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        typeDigits(event.key)
      } else if (event.key === 'Backspace') {
        event.preventDefault()
        erase()
      }
    }
    const onPaste = (event: ClipboardEvent) => {
      const digits = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '')
      if (!digits) return
      event.preventDefault()
      typeDigits(digits)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  })

  const payWithCard = () => {
    const found = validateCard(entry.draft)
    setErrors(found)
    const first = FIELDS.find((f) => found[f])
    if (first) {
      focusField(first)
      return
    }
    onSubmit(toPayment(entry.draft))
  }

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.topRow}>
          <Button variant="secondary" onClick={onBack} disabled={submitting}>
            <Icon name="arrowLeft" size={20} />
            Back to order
          </Button>
        </div>

        {error?.kind === 'declined' && <Notice tone="danger" title={error.message} small={error.last4 ? `Card ending in ${error.last4}` : undefined} />}
        {error?.kind === 'failed' && (
          <Notice
            tone="danger"
            title={error.message}
            actions={
              <Button variant="primary" onClick={onRetry} disabled={submitting} data-testid="try-again">
                <Icon name="undo" size={20} />
                Try again
              </Button>
            }
          />
        )}

        <button type="button" className={styles.tap} onClick={() => onSubmit({ method: 'tap' })} disabled={submitting} data-testid="tap-card">
          <span className={styles.tapIcon}>
            <Icon name="reader" size={34} />
          </span>
          <span className={styles.tapText}>
            <span className={styles.tapTitle}>Tap card on the reader</span>
            <span className={styles.tapHint}>Hold your card or phone near the reader below the screen.</span>
          </span>
          <span className={styles.tapAmount}>{amount}</span>
        </button>

        <div className={styles.divider}>
          <span>Or enter your card details</span>
        </div>

        <div className={styles.keyed}>
          <div className={styles.form}>
            <h2 className={styles.formTitle}>Pay with card</h2>
            <CardFields draft={entry.draft} errors={errors} active={entry.active} onFocusField={focusField} onChangeField={changeField} />
            <Button variant="primary" size="primary" block onClick={payWithCard} disabled={submitting} data-testid="pay-card">
              <Icon name="card" size={22} />
              Pay {amount} with card
            </Button>
            <p className={styles.simulated}>Payment is simulated. Nothing is charged and no card details are kept.</p>
          </div>
          <div className={styles.keypad}>
            <Keypad onDigit={typeDigits} onDelete={erase} onNext={advance} disabled={submitting} />
          </div>
        </div>
      </div>

      <aside className={styles.summary} aria-labelledby="pay-total">
        <p className={styles.summaryLabel}>Total to pay</p>
        <p id="pay-total" className={`${styles.summaryTotal} money`}>
          {amount}
        </p>
        <p className={styles.summaryHint}>{itemCount(totals.count)}, tax included</p>
        <OrderLines lines={totals.lines.map((l) => ({ id: l.itemId, name: l.name, qty: l.qty, totalCents: lineTotal(l) }))} currency={currency} />
      </aside>

      {submitting && <SubmittingOverlay />}
    </div>
  )
}

function SubmittingOverlay() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 5_000)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div className={styles.overlay}>
      <div className={styles.overlayCard}>
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.overlayTitle}>Sending your order</p>
        {slow && <p className={styles.overlayHint}>Still working</p>}
      </div>
    </div>
  )
}
