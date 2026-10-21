const formatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  const key = `${locale}:${currency}`
  let fmt = formatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: 'currency', currency })
    formatters.set(key, fmt)
  }
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2
  return fmt.format(cents / 10 ** digits)
}

/** Same rule as the server: tax on the subtotal, rounded half up. Display only. */
export function taxFor(subtotalCents: number, rateBps: number): number {
  return Math.floor((subtotalCents * rateBps + 5_000) / 10_000)
}
