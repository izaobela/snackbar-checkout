import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

import seed from '../../../data/menu.json'
import type { ErrorBody, Menu, Order } from '../api/types'

export function seedMenu(overrides: Partial<Menu> = {}): Menu {
  return { currency: 'USD', tax_rate_bps: 825, categories: seed.categories, items: seed.items, ...overrides }
}

export function fakeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    pickup_number: '07',
    status: 'placed',
    currency: 'USD',
    subtotal_cents: 450,
    tax_cents: 37,
    total_cents: 487,
    created_at: '2026-10-21T18:00:00Z',
    lines: [{ item_id: 'flat-white', name: 'Flat white', unit_price_cents: 450, qty: 1, source: 'menu' }],
    payment: { method: 'tap', brand: 'visa', last4: '4242' },
    ...overrides,
  }
}

export function apiError(status: number, error: ErrorBody) {
  return HttpResponse.json({ error }, { status })
}

export const handlers = [
  http.get('/api/menu', () => HttpResponse.json(seedMenu())),
  http.post('/api/orders', () => HttpResponse.json(fakeOrder(), { status: 201 })),
]

export const server = setupServer(...handlers)
