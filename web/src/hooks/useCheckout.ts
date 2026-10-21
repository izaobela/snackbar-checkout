import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'

import { ApiError } from '../api/client'
import { menuKey, usePlaceOrder } from '../api/queries'
import type { Change, Menu, Order, Payment, Totals } from '../api/types'
import { type CartTotals, cartTotals } from '../lib/cart'
import { applyChanges, fingerprint, newKey, qtyAfter, toWire } from '../lib/checkout'
import { readSession, writeSession } from '../lib/session'
import type { Cart } from './useCart'

export type CheckoutError =
  | { kind: 'declined'; message: string; last4: string }
  | { kind: 'failed'; message: string }

export type Step =
  | { name: 'start' }
  | { name: 'menu' }
  | { name: 'scan' }
  | { name: 'payment'; key: string; totals: CartTotals; error: CheckoutError | null; lastPayment: Payment | null }
  | { name: 'changed'; changes: Change[]; totals: CartTotals | null; serverTotals: Totals | null; payment: Payment }
  | { name: 'done'; order: Order }

/** An Idempotency-Key and the exact lines and prices it was minted for. */
type Minted = { key: string; fingerprint: string }

const KEY_STORAGE = 'iza-bela.key'
const UNREACHABLE = "We couldn't reach the register. Your order is still here."

const isMinted = (value: unknown): value is Minted =>
  typeof value === 'object' && value !== null && typeof (value as Minted).key === 'string' && typeof (value as Minted).fingerprint === 'string'

export function useCheckout(cart: Cart, menu: Menu | null) {
  // A cart that survived a reload skips the welcome screen.
  const [step, setStep] = useState<Step>(() => (cart.lines.length ? { name: 'menu' } : { name: 'start' }))
  // Kept with the cart, so a reload replays the same order instead of placing a second one.
  const [minted, setMinted] = useState<Minted | null>(() => readSession(KEY_STORAGE, isMinted))
  const placeOrder = usePlaceOrder()
  const queryClient = useQueryClient()
  const inFlight = useRef(false)

  const remember = useCallback((next: Minted | null) => {
    setMinted(next)
    writeSession(KEY_STORAGE, next)
  }, [])

  // expectedTotalCents is the number on the screen; the server refuses to charge any other.
  const send = useCallback(
    (key: string, totals: CartTotals, payment: Payment, expectedTotalCents: number) => {
      if (inFlight.current) return
      inFlight.current = true
      setStep({ name: 'payment', key, totals, error: null, lastPayment: payment })
      placeOrder.mutate(
        { order: { lines: toWire(totals), payment, expected_total_cents: expectedTotalCents }, key },
        {
          onSettled: () => {
            inFlight.current = false
          },
          onSuccess: (order) => {
            cart.clear()
            remember(null)
            // Stock may have moved with this order.
            void queryClient.invalidateQueries({ queryKey: menuKey })
            setStep({ name: 'done', order })
          },
          onError: (error) => {
            if (error instanceof ApiError && error.code === 'menu_changed') {
              const changes = error.data?.changes ?? []
              // The cart follows the server: sold-out lines go, short lines shrink.
              for (const line of totals.lines) cart.setQty(line.itemId, qtyAfter(changes, line.itemId, line.qty))
              remember(null)
              void queryClient.invalidateQueries({ queryKey: menuKey })
              setStep({ name: 'changed', changes, totals: applyChanges(totals, changes), serverTotals: error.data?.current_totals ?? null, payment })
              return
            }
            if (error instanceof ApiError && error.code === 'payment_declined') {
              // The decline is stored under this key; the next attempt needs a fresh one.
              const next = newKey()
              remember({ key: next, fingerprint: fingerprint(totals) })
              setStep({ name: 'payment', key: next, totals, error: { kind: 'declined', message: error.message, last4: error.data?.last4 ?? '' }, lastPayment: null })
              return
            }
            const explained = error instanceof ApiError && !error.retryable
            setStep({ name: 'payment', key, totals, error: { kind: 'failed', message: explained ? error.message : UNREACHABLE }, lastPayment: payment })
          },
        },
      )
    },
    [cart, placeOrder, queryClient, remember],
  )

  const browse = useCallback(() => setStep({ name: 'menu' }), [])
  const scan = useCallback(() => setStep({ name: 'scan' }), [])

  const goToPayment = useCallback(() => {
    if (!menu || cart.lines.length === 0) return
    const totals = cartTotals(cart.lines, menu)
    const print = fingerprint(totals)
    const key = minted?.fingerprint === print ? minted.key : newKey()
    remember({ key, fingerprint: print })
    setStep({ name: 'payment', key, totals, error: null, lastPayment: null })
  }, [cart.lines, menu, minted, remember])

  const submit = useCallback(
    (payment: Payment) => {
      if (step.name === 'payment') send(step.key, step.totals, payment, step.totals.totalCents)
    },
    [send, step],
  )

  const retry = useCallback(() => {
    if (step.name === 'payment' && step.lastPayment) send(step.key, step.totals, step.lastPayment, step.totals.totalCents)
  }, [send, step])

  const confirmChanges = useCallback(() => {
    if (step.name !== 'changed' || !step.totals) return
    const key = newKey()
    remember({ key, fingerprint: fingerprint(step.totals) })
    // The Confirm button shows the server's total when it sent one.
    send(key, step.totals, step.payment, step.serverTotals?.total_cents ?? step.totals.totalCents)
  }, [remember, send, step])

  const reset = useCallback(() => {
    cart.clear()
    remember(null)
    setStep({ name: 'start' })
  }, [cart, remember])

  return { step, submitting: placeOrder.isPending, browse, scan, goToPayment, submit, retry, confirmChanges, back: browse, reset }
}
