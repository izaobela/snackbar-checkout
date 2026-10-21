import { describe, expect, it } from 'vitest'

import { MAX_QTY, cartReducer, cartTotals } from './cart'
import { seedMenu } from '../test/msw'

describe('cartReducer', () => {
  it('adds a line, then increments it', () => {
    const once = cartReducer([], { type: 'add', itemId: 'a' })
    expect(once).toEqual([{ itemId: 'a', qty: 1, source: 'menu' as const }])
    expect(cartReducer(once, { type: 'add', itemId: 'a' })).toEqual([{ itemId: 'a', qty: 2, source: 'menu' as const }])
  })

  it('caps the quantity', () => {
    const full = [{ itemId: 'a', qty: MAX_QTY, source: 'menu' as const }]
    expect(cartReducer(full, { type: 'add', itemId: 'a' })).toBe(full)
  })

  it('removes the line when decrementing from one', () => {
    expect(cartReducer([{ itemId: 'a', qty: 2, source: 'menu' as const }], { type: 'decrement', itemId: 'a' })).toEqual([{ itemId: 'a', qty: 1, source: 'menu' as const }])
    expect(cartReducer([{ itemId: 'a', qty: 1, source: 'menu' as const }], { type: 'decrement', itemId: 'a' })).toEqual([])
  })

  it('removes many and clears', () => {
    const lines = [
      { itemId: 'a', qty: 1, source: 'menu' as const },
      { itemId: 'b', qty: 1, source: 'menu' as const },
    ]
    expect(cartReducer(lines, { type: 'removeMany', itemIds: ['a'] })).toEqual([{ itemId: 'b', qty: 1, source: 'menu' as const }])
    expect(cartReducer(lines, { type: 'clear' })).toEqual([])
  })
})

describe('cartTotals', () => {
  it('prices from the menu and rounds tax half up', () => {
    const totals = cartTotals([{ itemId: 'flat-white', qty: 2, source: 'menu' as const }], seedMenu())
    expect(totals.lines[0]).toMatchObject({ name: 'Flat white', unitPriceCents: 450, qty: 2 })
    expect([totals.subtotalCents, totals.taxCents, totals.totalCents]).toEqual([900, 74, 974])
  })

  it('ignores lines whose item is not on the menu', () => {
    expect(cartTotals([{ itemId: 'ghost', qty: 1, source: 'menu' as const }], seedMenu()).lines).toEqual([])
  })

  it('is empty without a menu', () => {
    expect(cartTotals([{ itemId: 'flat-white', qty: 1, source: 'menu' as const }], null).totalCents).toBe(0)
  })
})

describe('setQty', () => {
  it('sets a quantity, caps it, and removes the line at zero', () => {
    const lines = [{ itemId: 'a', qty: 3, source: 'menu' as const }]
    expect(cartReducer(lines, { type: 'setQty', itemId: 'a', qty: 1 })).toEqual([{ itemId: 'a', qty: 1, source: 'menu' as const }])
    expect(cartReducer(lines, { type: 'setQty', itemId: 'a', qty: 99 })).toEqual([{ itemId: 'a', qty: MAX_QTY, source: 'menu' as const }])
    expect(cartReducer(lines, { type: 'setQty', itemId: 'a', qty: 0 })).toEqual([])
  })
})
