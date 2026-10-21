import { useEffect, useRef, useState } from 'react'

import { Button } from '../components/Button'
import { ConsoleFace } from '../components/ConsoleFace'
import { Icon } from '../components/Icon'
import { Receipt } from '../components/Receipt'
import styles from './ConfirmationScreen.module.css'
import type { Order } from '../api/types'
import { brandName } from '../lib/card'
import { formatMoney } from '../lib/money'

type Props = { order: Order; autoReturnMs: number; onDone: () => void }

export function ConfirmationScreen({ order, autoReturnMs, onDone }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(Math.round(autoReturnMs / 1000))
  const done = useRef(onDone)

  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    const tick = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1_000)
    const timer = window.setTimeout(() => done.current(), autoReturnMs)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(timer)
    }
  }, [autoReturnMs])

  // Scanned items are already in the person's hands; only what the counter makes gets a number.
  const prepared = order.lines.filter((l) => l.source === 'menu')
  const collect = order.pickup_number !== null && prepared.length > 0

  return (
    <div className={styles.layout}>
      <section className={`${styles.main} ${collect ? '' : styles.celebrate}`} aria-labelledby="confirmation-title">
        <p className={styles.paid}>
          <Icon name="check" size={22} />
          Payment approved
        </p>
        {collect ? (
          <>
            <p className={styles.label}>Your pickup number</p>
            <p className={`${styles.number} money`} data-testid="pickup-number">
              {order.pickup_number}
            </p>
            <h1 id="confirmation-title" className={styles.title}>
              Pick up at the counter when your number is called.
            </h1>
            {prepared.length < order.lines.length && (
              <p className={styles.collect}>To collect: {prepared.map((l) => `${l.qty} ${l.name}`).join(', ')}. The rest is already with you.</p>
            )}
          </>
        ) : (
          <>
            <span className={styles.screen} aria-hidden="true">
              <ConsoleFace mood="happy" className={styles.face} />
            </span>
            <h1 id="confirmation-title" className={styles.title} data-testid="all-set">
              You're all set.
            </h1>
            <p className={styles.label}>Your items are yours to take.</p>
          </>
        )}
        <p className={styles.receipt}>
          <Icon name="card" size={20} />
          Paid {formatMoney(order.total_cents, order.currency)} with {brandName(order.payment.brand)} ending in {order.payment.last4}.
        </p>
        <p className={styles.countdown}>
          <Icon name="clock" size={18} />
          New order in {secondsLeft} s
        </p>
      </section>

      <aside className={styles.side}>
        {/* The paper can be taller than the screen, and a scrollable region has to be reachable by keyboard (axe: scrollable-region-focusable). */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <section className={styles.paper} aria-label="Your receipt" tabIndex={0}>
          <Receipt order={order} />
        </section>
        <Button variant="primary" size="primary" block onClick={onDone} data-testid="done">
          Done
          <Icon name="check" size={22} />
        </Button>
      </aside>
    </div>
  )
}
