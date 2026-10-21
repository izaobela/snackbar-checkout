import { useCallback, useEffect, useReducer } from 'react'

import type { LineSource } from '../api/types'
import { type CartLine, MAX_LINES, MAX_QTY, cartReducer } from '../lib/cart'
import { readSession, writeSession } from '../lib/session'

const STORAGE_KEY = 'iza-bela.cart'

function loadLines(): CartLine[] {
  const stored = readSession(STORAGE_KEY, Array.isArray) ?? []
  return stored
    .filter((l): l is CartLine => typeof l?.itemId === 'string' && Number.isInteger(l?.qty) && l.qty > 0)
    .slice(0, MAX_LINES)
    .map((l) => ({ itemId: l.itemId, qty: Math.min(l.qty, MAX_QTY), source: l.source === 'scan' ? 'scan' : 'menu' }) as CartLine)
}

/** The cart survives a reload through sessionStorage, which dies with the tab. */
export function useCart() {
  const [lines, dispatch] = useReducer(cartReducer, undefined, loadLines)

  useEffect(() => {
    writeSession(STORAGE_KEY, lines.length ? lines : null)
  }, [lines])

  const add = useCallback((itemId: string, source?: LineSource) => dispatch({ type: 'add', itemId, source }), [])
  const decrement = useCallback((itemId: string) => dispatch({ type: 'decrement', itemId }), [])
  const setQty = useCallback((itemId: string, qty: number) => dispatch({ type: 'setQty', itemId, qty }), [])
  const removeMany = useCallback((itemIds: string[]) => dispatch({ type: 'removeMany', itemIds }), [])
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  return { lines, add, decrement, setQty, removeMany, clear }
}

export type Cart = ReturnType<typeof useCart>
