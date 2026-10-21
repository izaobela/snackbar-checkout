import { describe, expect, it } from 'vitest'

import { EMPTY_ENTRY, deleteDigit, detectBrand, enterDigit, luhnOk, nextField, toPayment, validateCard } from './card'

const typed = (digits: string) => [...digits].reduce(enterDigit, EMPTY_ENTRY)

describe('card rules', () => {
  it('checks the Luhn digit', () => {
    expect(luhnOk('4242424242424242')).toBe(true)
    expect(luhnOk('4242424242424241')).toBe(false)
  })

  it('detects brands', () => {
    expect(detectBrand('4242424242424242')).toBe('visa')
    expect(detectBrand('5555555555554444')).toBe('mastercard')
    expect(detectBrand('378282246310005')).toBe('amex')
    expect(detectBrand('6011111111111117')).toBe('discover')
  })

  it('explains what is wrong in plain words', () => {
    const now = new Date(2026, 9, 21)
    expect(validateCard({ number: '4242', expiry: '1230', cvc: '123' }, now).number).toMatch(/too short/)
    expect(validateCard({ number: '4242424242424242', expiry: '1320', cvc: '123' }, now).expiry).toMatch(/01 to 12/)
    expect(validateCard({ number: '4242424242424242', expiry: '0925', cvc: '123' }, now).expiry).toMatch(/passed/)
    expect(validateCard({ number: '378282246310005', expiry: '1230', cvc: '123' }, now).cvc).toMatch(/4 digits/)
    expect(validateCard({ number: '4242424242424242', expiry: '1230', cvc: '123' }, now)).toEqual({})
  })

  it('builds the payment payload', () => {
    expect(toPayment({ number: '4242424242424242', expiry: '0729', cvc: '123' })).toEqual({
      method: 'card',
      number: '4242424242424242',
      exp_month: 7,
      exp_year: 2029,
      cvc: '123',
    })
  })
})

describe('card entry', () => {
  it('moves from number to expiry to code as each one fills, so a paste lands everywhere', () => {
    expect(typed('4242424242424242').active).toBe('expiry')
    expect(typed('42424242424242421230').active).toBe('cvc')
    const full = typed('42424242424242421230123')
    expect(full.draft).toEqual({ number: '4242424242424242', expiry: '1230', cvc: '123' })
    expect(full.active).toBe('cvc')
    expect(typed('424242424242424212301239').draft.cvc).toBe('123')
  })

  it('knows an Amex is 15 digits with a 4-digit code', () => {
    expect(typed('378282246310005').active).toBe('expiry')
    expect(typed('3782822463100051230').active).toBe('cvc')
    expect(typed('37828224631000512301234').draft.cvc).toBe('1234')
  })

  it('deletes from the active field and cycles with Next', () => {
    const entry = { draft: { number: '4242', expiry: '12', cvc: '' }, active: 'expiry' as const }
    expect(deleteDigit(entry).draft.expiry).toBe('1')
    expect(nextField(entry).active).toBe('cvc')
    expect(nextField(nextField(entry)).active).toBe('number')
  })
})
