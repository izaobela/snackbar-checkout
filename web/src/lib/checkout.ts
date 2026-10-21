import type { Change, OrderLineIn } from '../api/types'
import { type CartTotals, totalsOf } from './cart'

export function toWire(totals: CartTotals): OrderLineIn[] {
  return totals.lines.map((l) => ({ item_id: l.itemId, qty: l.qty, unit_price_cents: l.unitPriceCents, source: l.source }))
}

/** What the idempotency key is bound to: the exact lines and prices that will be sent. */
export function fingerprint(totals: CartTotals): string {
  return JSON.stringify(toWire(totals))
}

/** A fresh Idempotency-Key. randomUUID needs https or localhost; a tablet on the LAN has neither. */
export function newKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** What the server reported leaves of a line: fewer when stock ran short, none when it ran out. */
export function qtyAfter(changes: Change[], itemId: string, qty: number): number {
  if (changes.some((c) => c.item_id === itemId && c.reason === 'unavailable')) return 0
  const short = changes.find((c) => c.item_id === itemId && c.reason === 'limited')
  return short?.left != null ? Math.min(qty, short.left) : qty
}

/** The totals the server would charge after the changes it reported: new prices in, short lines cut, sold-out lines out. */
export function applyChanges(totals: CartTotals, changes: Change[]): CartTotals | null {
  const lines = totals.lines
    .map((l) => ({ ...l, qty: qtyAfter(changes, l.itemId, l.qty) }))
    .filter((l) => l.qty > 0)
    .map((l) => {
      const change = changes.find((c) => c.item_id === l.itemId && c.reason === 'price_changed')
      return change?.new_price_cents != null ? { ...l, unitPriceCents: change.new_price_cents } : l
    })
  return lines.length ? totalsOf(lines, totals.taxRateBps) : null
}
