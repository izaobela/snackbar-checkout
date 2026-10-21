export type Category = { id: string; name: string }

export type Item = {
  id: string
  category: string
  name: string
  description: string
  price_cents: number
  tags: string[]
  allergens: string[]
  available: boolean
  stock?: number | null
  image?: string | null
  code?: string | null
}

export type Menu = {
  currency: string
  tax_rate_bps: number
  categories: Category[]
  items: Item[]
}

/** Where a line came from: scanned items are in the person's hands, menu items get made. */
export type LineSource = 'scan' | 'menu'

export type OrderLineIn = { item_id: string; qty: number; unit_price_cents: number; source: LineSource }

export type TapPayment = { method: 'tap' }
export type CardPayment = { method: 'card'; number: string; exp_month: number; exp_year: number; cvc: string }
export type Payment = TapPayment | CardPayment

/** expected_total_cents is the total the screen showed; the server will not charge any other. */
export type OrderIn = { lines: OrderLineIn[]; payment: Payment; expected_total_cents?: number }

export type OrderLine = { item_id: string; name: string; unit_price_cents: number; qty: number; source: LineSource }

export type Order = {
  id: string
  pickup_number: string | null // null when nothing has to be made at the counter
  status: string
  currency: string
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  created_at: string
  lines: OrderLine[]
  payment: { method: string; brand: string; last4: string }
}

export type Change = {
  item_id: string
  name: string
  reason: 'price_changed' | 'unavailable' | 'limited'
  old_price_cents: number
  new_price_cents: number | null
  left?: number | null
}

export type Totals = { subtotal_cents: number; tax_cents: number; total_cents: number }

export type ErrorBody = {
  code: string
  message: string
  changes?: Change[]
  current_totals?: Totals | null
  decline_code?: string
  last4?: string
  fields?: { field: string; message: string }[]
}
