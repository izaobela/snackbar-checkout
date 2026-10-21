import { useEffect, useRef, useState } from 'react'

import { useMenu } from './api/queries'
import { Button } from './components/Button'
import { Dialog } from './components/Dialog'
import { Header } from './components/Header'
import { IDLE_GRACE_MS, IDLE_WARN_MS, THANK_YOU_MS } from './config'
import { useCart } from './hooks/useCart'
import { useCheckout } from './hooks/useCheckout'
import { useIdleTimer } from './hooks/useIdleTimer'
import { cartTotals } from './lib/cart'
import { ConfirmationScreen } from './screens/ConfirmationScreen'
import { MenuChangedScreen } from './screens/MenuChangedScreen'
import { MenuScreen } from './screens/MenuScreen'
import { PaymentScreen } from './screens/PaymentScreen'
import { ScanScreen } from './screens/ScanScreen'
import { StartScreen } from './screens/StartScreen'
import styles from './App.module.css'

const STEP_INDEX = { start: 0, menu: 0, scan: 0, payment: 1, changed: 1, done: 2 } as const

export function App() {
  const menuQuery = useMenu()
  const menu = menuQuery.data ?? null
  const cart = useCart()
  const checkout = useCheckout(cart, menu)
  const [confirmClear, setConfirmClear] = useState(false)
  const { step } = checkout
  const currency = menu?.currency ?? 'USD'
  const totals = cartTotals(cart.lines, menu)
  const browsing = step.name === 'menu' || step.name === 'scan'

  const idle = useIdleTimer({
    enabled: step.name !== 'start' && step.name !== 'done' && !checkout.submitting && (cart.lines.length > 0 || !browsing),
    warnAfterMs: IDLE_WARN_MS,
    graceMs: IDLE_GRACE_MS,
    onExpire: checkout.reset,
  })

  // A new screen moves focus to the top of it, as a page change would.
  const mainRef = useRef<HTMLElement>(null)
  const previousStep = useRef(step.name)
  useEffect(() => {
    if (previousStep.current === step.name) return
    previousStep.current = step.name
    mainRef.current?.focus({ preventScroll: true })
  }, [step.name])

  const startOver = () => {
    setConfirmClear(false)
    checkout.reset()
  }

  const headerAction =
    step.name === 'menu' ? { label: 'Scan', icon: 'scan' as const, onClick: checkout.scan } : step.name === 'scan' ? { label: 'Menu', icon: 'list' as const, onClick: checkout.browse } : undefined

  const liveText =
    step.name === 'done'
      ? step.order.pickup_number
        ? `Order placed. Your pickup number is ${step.order.pickup_number}.`
        : 'Order placed. Your items are yours to take.'
      : checkout.submitting
        ? 'Sending your order'
        : ''

  return (
    <div className={styles.app}>
      <Header
        step={STEP_INDEX[step.name]}
        action={headerAction}
        onStartOver={() => (cart.lines.length > 0 ? setConfirmClear(true) : checkout.reset())}
        showStartOver={step.name !== 'start' && step.name !== 'done' && !checkout.submitting}
      />

      <main ref={mainRef} tabIndex={-1} className={styles.main}>
        {step.name === 'start' && <StartScreen onScan={checkout.scan} onBrowse={checkout.browse} />}
        {step.name === 'scan' && menu && (
          <ScanScreen menu={menu} totals={totals} onAdd={(id) => cart.add(id, 'scan')} onDecrement={cart.decrement} onPay={checkout.goToPayment} onStartOver={() => setConfirmClear(true)} />
        )}
        {(step.name === 'menu' || (step.name === 'scan' && !menu)) && (
          <MenuScreen
            menu={menu}
            menuFailed={menuQuery.isError}
            onRetryMenu={() => void menuQuery.refetch()}
            lines={cart.lines}
            totals={totals}
            onAdd={cart.add}
            onDecrement={cart.decrement}
            onPay={checkout.goToPayment}
            onStartOver={() => setConfirmClear(true)}
          />
        )}
        {step.name === 'payment' && (
          <PaymentScreen
            // A decline mints a new key; remounting drops the typed card with it.
            key={step.key}
            totals={step.totals}
            currency={currency}
            error={step.error}
            submitting={checkout.submitting}
            onSubmit={checkout.submit}
            onRetry={checkout.retry}
            onBack={checkout.back}
          />
        )}
        {step.name === 'changed' && (
          <MenuChangedScreen
            changes={step.changes}
            totals={step.serverTotals ?? (step.totals && { subtotal_cents: step.totals.subtotalCents, tax_cents: step.totals.taxCents, total_cents: step.totals.totalCents })}
            currency={currency}
            onConfirm={checkout.confirmChanges}
            onBack={checkout.back}
          />
        )}
        {step.name === 'done' && <ConfirmationScreen order={step.order} autoReturnMs={THANK_YOU_MS} onDone={checkout.reset} />}
      </main>

      <footer className={styles.footer}>Your order clears after a minute without a tap.</footer>

      <output className="visually-hidden" aria-live="polite">
        {liveText}
      </output>

      <Dialog open={idle.warning} title="Still there?" onClose={idle.extend}>
        <p className={styles.dialogBody}>We'll clear this order in {idle.secondsLeft} s so the next person can start.</p>
        <Button variant="primary" size="primary" block onClick={idle.extend}>
          I'm still here
        </Button>
        <Button variant="quiet" block onClick={startOver}>
          Start over
        </Button>
      </Dialog>

      <Dialog open={confirmClear} title="Clear your order?" onClose={() => setConfirmClear(false)}>
        <p className={styles.dialogBody}>Remove everything and start again?</p>
        <Button variant="secondary" size="primary" block onClick={() => setConfirmClear(false)}>
          Keep my order
        </Button>
        <Button variant="danger" size="primary" block onClick={startOver}>
          Clear the order
        </Button>
      </Dialog>
    </div>
  )
}
