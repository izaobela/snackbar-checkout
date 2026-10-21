/**
 * sessionStorage with its failure modes swallowed. A tablet in private mode, or with storage
 * full, still takes orders; it just forgets them on a reload.
 */
export function readSession<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = window.sessionStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) window.sessionStorage.removeItem(key)
    else window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Nothing to do: the order still works for this page load.
  }
}
