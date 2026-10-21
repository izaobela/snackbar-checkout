import type { CardPayment } from '../api/types'

export type Brand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown'

export function luhnOk(number: string): boolean {
  if (number.length < 2) return false
  let total = 0
  const parity = number.length % 2
  for (let i = 0; i < number.length; i++) {
    let digit = Number(number[i])
    if (i % 2 === parity) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    total += digit
  }
  return total % 10 === 0
}

export function detectBrand(number: string): Brand {
  if (number.startsWith('4')) return 'visa'
  const two = number.slice(0, 2)
  const four = Number(number.slice(0, 4) || '0')
  if (two === '34' || two === '37') return 'amex'
  if (['51', '52', '53', '54', '55'].includes(two) || (four >= 2221 && four <= 2720)) return 'mastercard'
  if (number.startsWith('6011') || two === '65') return 'discover'
  return 'unknown'
}

export function brandName(brand: string): string {
  const names: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover' }
  return names[brand] ?? 'card'
}

export const cvcLengthFor = (brand: Brand) => (brand === 'amex' ? 4 : 3)
export const numberLengthFor = (brand: Brand) => (brand === 'amex' ? 15 : 16)

export function groupNumber(number: string, brand: Brand): string {
  if (brand === 'amex') return [number.slice(0, 4), number.slice(4, 10), number.slice(10, 15)].filter(Boolean).join(' ')
  return number.match(/.{1,4}/g)?.join(' ') ?? ''
}

export function formatExpiry(digits: string): string {
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2, 4)}`
}

export type CardDraft = { number: string; expiry: string; cvc: string }
export type CardField = keyof CardDraft
export type CardErrors = Partial<Record<CardField, string>>

/** What is typed so far and which field the next digit goes to. */
export type CardEntry = { draft: CardDraft; active: CardField }

export const FIELDS: CardField[] = ['number', 'expiry', 'cvc']
export const EMPTY_ENTRY: CardEntry = { draft: { number: '', expiry: '', cvc: '' }, active: 'number' }

/** Adds one digit to the active field and moves on when that field is full. Pure, so a pasted string is just a reduce. */
export function enterDigit({ draft, active }: CardEntry, digit: string): CardEntry {
  const value = draft[active] + digit
  const brand = detectBrand(active === 'number' ? value : draft.number)
  // Numbers can run to 19 digits, but the common length is where the entry moves on.
  const limit = active === 'number' ? (brand === 'amex' ? 15 : 19) : active === 'expiry' ? 4 : cvcLengthFor(brand)
  const full = active === 'number' ? numberLengthFor(brand) : limit
  const next = { ...draft, [active]: value.slice(0, limit) }
  const following = FIELDS[FIELDS.indexOf(active) + 1]
  return { draft: next, active: next[active].length === full && following ? following : active }
}

export function deleteDigit({ draft, active }: CardEntry): CardEntry {
  return { draft: { ...draft, [active]: draft[active].slice(0, -1) }, active }
}

export function nextField({ draft, active }: CardEntry): CardEntry {
  return { draft, active: FIELDS[(FIELDS.indexOf(active) + 1) % FIELDS.length]! }
}

export function validateCard(draft: CardDraft, now: Date = new Date()): CardErrors {
  const errors: CardErrors = {}
  if (draft.number.length < 13) errors.number = 'That card number looks too short.'
  else if (!luhnOk(draft.number)) errors.number = 'That card number does not look right. Check the digits.'

  const month = Number(draft.expiry.slice(0, 2))
  const year = 2000 + Number(draft.expiry.slice(2, 4))
  if (draft.expiry.length !== 4 || month < 1 || month > 12) errors.expiry = 'Check the month: it should be 01 to 12.'
  else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.expiry = 'That expiry date has passed.'

  const cvcLength = cvcLengthFor(detectBrand(draft.number))
  if (draft.cvc.length !== cvcLength) errors.cvc = `The security code is ${cvcLength} digits.`
  return errors
}

export function toPayment(draft: CardDraft): CardPayment {
  return {
    method: 'card',
    number: draft.number,
    exp_month: Number(draft.expiry.slice(0, 2)),
    exp_year: 2000 + Number(draft.expiry.slice(2, 4)),
    cvc: draft.cvc,
  }
}
