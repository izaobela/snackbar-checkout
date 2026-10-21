import { describe, expect, it } from 'vitest'

import { formatMoney, taxFor } from './money'

describe('money', () => {
  it('formats cents', () => {
    expect(formatMoney(487)).toBe('$4.87')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(1234, 'EUR', 'de-DE')).toMatch(/12,34/)
  })

  it('rounds tax half up like the server', () => {
    expect(taxFor(450, 825)).toBe(37)
    expect(taxFor(1212, 825)).toBe(100)
    expect(taxFor(0, 825)).toBe(0)
    // 200 and 1000 land exactly on a half cent at 8.25%: up, not down, same as the API.
    expect(taxFor(200, 825)).toBe(17)
    expect(taxFor(1000, 825)).toBe(83)
  })
})
