import { describe, expect, it } from 'vitest'

import { CODE39_PATTERNS, code39 } from './barcode'

describe('code39', () => {
  it('has a well-formed table: nine elements per character, three of them wide', () => {
    for (const [char, pattern] of Object.entries(CODE39_PATTERNS)) {
      expect(pattern, char).toHaveLength(9)
      expect([...pattern].filter((w) => w === 'w'), char).toHaveLength(3)
    }
    expect(new Set(Object.values(CODE39_PATTERNS)).size).toBe(Object.keys(CODE39_PATTERNS).length)
  })

  it('wraps the text in the start and stop character and leaves a gap between characters', () => {
    // A character is 15 units: three wide elements of 3 and six narrow of 1.
    const star = code39('')
    expect(star).toHaveLength(15 * 2 + 1) // two asterisks and one gap
    expect(star.slice(0, 15).map(Number).join('')).toBe('100010111011101') // nwnnwnwnn, bars first
    const one = code39('1')
    expect(one).toHaveLength(15 * 3 + 2)
    expect(one[0]).toBe(true)
    expect(one[one.length - 1]).toBe(true)
  })

  it('encodes order codes and refuses what the symbol cannot carry', () => {
    expect(code39('7f3a9c2e')).toEqual(code39('7F3A9C2E'))
    expect(() => code39('order#1')).toThrow(/cannot encode/)
  })
})
