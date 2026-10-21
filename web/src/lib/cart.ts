import type { LineSource, Menu } from '../api/types'
import { taxFor } from './money'

export type CartLine = { itemId: string; qty: number; source: LineSource }

export type CartAction =
  | { type: 'add'; itemId: string; source?: LineSource }
  | { type: 'decrement'; itemId: string }
  | { type: 'setQty'; itemId: string; qty: number }
  | { type: 'removeMany'; itemIds: string[] }
  | { type: 'clear' }

export const MAX_QTY = 20
export const MAX_LINES = 50

export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const existing = lines.find((l) => l.itemId === action.itemId)
      if (existing) {
        if (existing.qty >= MAX_QTY) return lines
        return lines.map((l) => (l.itemId === action.itemId ? { ...l, qty: l.qty + 1 } : l))
      }
      if (lines.length >= MAX_LINES) return lines
      return [...lines, { itemId: action.itemId, qty: 1, source: action.source ?? 'menu' }]
    }
    case 'setQty': {
      if (action.qty <= 0) return lines.filter((l) => l.itemId !== action.itemId)
      return lines.map((l) => (l.itemId === action.itemId ? { ...l, qty: Math.min(action.qty, MAX_QTY) } : l))
    }
    case 'decrement': {
      const existing = lines.find((l) => l.itemId === action.itemId)
      if (!existing) return lines
      if (existing.qty === 1) return lines.filter((l) => l.itemId !== action.itemId)
      return lines.map((l) => (l.itemId === action.itemId ? { ...l, qty: l.qty - 1 } : l))
    }
    case 'removeMany': {
      const gone = new Set(action.itemIds)
      return lines.some((l) => gone.has(l.itemId)) ? lines.filter((l) => !gone.has(l.itemId)) : lines
    }
    case 'clear':
      return lines.length ? [] : lines
  }
}

export type PricedLine = { itemId: string; name: string; unitPriceCents: number; qty: number; available: boolean; source: LineSource }

export type CartTotals = {
  lines: PricedLine[]
  count: number
  subtotalCents: number
  taxCents: number
  totalCents: number
  taxRateBps: number
}

export const emptyTotals: CartTotals = { lines: [], count: 0, subtotalCents: 0, taxCents: 0, totalCents: 0, taxRateBps: 0 }

export const lineTotal = (line: { unitPriceCents: number; qty: number }) => line.unitPriceCents * line.qty

/** Totals from priced lines; the tax rule mirrors the server's, for display only. */
export function totalsOf(lines: PricedLine[], taxRateBps: number): CartTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + lineTotal(l), 0)
  const taxCents = taxFor(subtotalCents, taxRateBps)
  return { lines, count: lines.reduce((sum, l) => sum + l.qty, 0), subtotalCents, taxCents, totalCents: subtotalCents + taxCents, taxRateBps }
}

/** Display totals from the menu the person is looking at; the server prices the real thing. */
export function cartTotals(lines: CartLine[], menu: Menu | null): CartTotals {
  if (!menu) return emptyTotals
  const priced: PricedLine[] = []
  for (const line of lines) {
    const item = menu.items.find((i) => i.id === line.itemId)
    if (item) priced.push({ itemId: item.id, name: item.name, unitPriceCents: item.price_cents, qty: line.qty, available: item.available, source: line.source })
  }
  return totalsOf(priced, menu.tax_rate_bps)
}
