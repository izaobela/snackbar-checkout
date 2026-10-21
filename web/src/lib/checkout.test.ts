import { describe, expect, it, vi } from 'vitest'

import { totalsOf } from './cart'
import { applyChanges, fingerprint, newKey, qtyAfter, toWire } from './checkout'

const totals = totalsOf(
  [
    { itemId: 'flat-white', name: 'Flat white', unitPriceCents: 450, qty: 2, available: true, source: 'menu' },
    { itemId: 'iced-tea', name: 'Iced tea', unitPriceCents: 325, qty: 1, available: true, source: 'menu' },
  ],
  825,
)

describe('checkout helpers', () => {
  it('sends ids, quantities and the prices that were shown', () => {
    expect(toWire(totals)).toEqual([
      { item_id: 'flat-white', qty: 2, unit_price_cents: 450, source: 'menu' },
      { item_id: 'iced-tea', qty: 1, unit_price_cents: 325, source: 'menu' },
    ])
  })

  it('changes the fingerprint when a price or a quantity changes', () => {
    const same = totalsOf(totals.lines, 825)
    const moreTea = totalsOf(totals.lines.map((l) => (l.itemId === 'iced-tea' ? { ...l, qty: 2 } : l)), 825)
    expect(fingerprint(same)).toBe(fingerprint(totals))
    expect(fingerprint(moreTea)).not.toBe(fingerprint(totals))
  })

  it('applies a new price and recomputes the totals', () => {
    const next = applyChanges(totals, [{ item_id: 'flat-white', name: 'Flat white', reason: 'price_changed', old_price_cents: 450, new_price_cents: 500 }])
    expect(next?.lines[0]?.unitPriceCents).toBe(500)
    expect([next?.subtotalCents, next?.taxCents, next?.totalCents]).toEqual([1325, 109, 1434])
  })

  it('drops a sold-out line, and returns null when nothing is left', () => {
    const soldOut = { item_id: 'iced-tea', name: 'Iced tea', reason: 'unavailable' as const, old_price_cents: 325, new_price_cents: null }
    expect(applyChanges(totals, [soldOut])?.lines.map((l) => l.itemId)).toEqual(['flat-white'])
    const bothGone = [soldOut, { ...soldOut, item_id: 'flat-white', name: 'Flat white', old_price_cents: 450 }]
    expect(applyChanges(totals, bothGone)).toBeNull()
  })
})

describe('newKey', () => {
  const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it('mints a v4 uuid', () => {
    expect(newKey()).toMatch(v4)
    expect(newKey()).not.toBe(newKey())
  })

  it('still mints one where crypto.randomUUID does not exist, as on a tablet over plain http', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array<ArrayBuffer>) => real.getRandomValues(bytes) })
    try {
      expect(newKey()).toMatch(v4)
      expect(newKey()).not.toBe(newKey())
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('qtyAfter', () => {
  it('shrinks a short line to what is left and drops a sold-out one', () => {
    const short = { item_id: 'iced-tea', name: 'Iced tea', reason: 'limited' as const, old_price_cents: 325, new_price_cents: 325, left: 1 }
    expect(qtyAfter([short], 'iced-tea', 3)).toBe(1)
    expect(qtyAfter([short], 'flat-white', 2)).toBe(2)
    expect(applyChanges(totals, [short])?.lines.map((l) => [l.itemId, l.qty])).toEqual([
      ['flat-white', 2],
      ['iced-tea', 1],
    ])
  })
})
