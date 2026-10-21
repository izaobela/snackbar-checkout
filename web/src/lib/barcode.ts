/**
 * Code 39, the barcode on receipts and shelf labels: digits, capitals and a few symbols, each
 * character nine bars and spaces of which three are wide. Enough for an order code, and small
 * enough to write here instead of loading a library for one symbol.
 */

// n = narrow, w = wide; the nine elements alternate bar, space, bar, ... starting with a bar.
const PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '*': 'nwnnwnwnn',
}

const WIDE = 3

/** The bars and spaces for `text`, one entry per unit of width: true is ink. */
export function code39(text: string): boolean[] {
  const modules: boolean[] = []
  for (const char of `*${text.toUpperCase()}*`) {
    const pattern = PATTERNS[char]
    if (!pattern) throw new Error(`Code 39 cannot encode ${JSON.stringify(char)}`)
    ;[...pattern].forEach((width, index) => {
      for (let unit = 0; unit < (width === 'w' ? WIDE : 1); unit++) modules.push(index % 2 === 0)
    })
    modules.push(false) // the gap between characters
  }
  modules.pop()
  return modules
}

export const CODE39_PATTERNS = PATTERNS
