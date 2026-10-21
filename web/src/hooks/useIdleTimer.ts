import { useCallback, useEffect, useRef, useState } from 'react'

type Options = { enabled: boolean; warnAfterMs: number; graceMs: number; onExpire: () => void }

const ACTIVITY = ['pointerdown', 'keydown'] as const

/** Warn after a quiet spell, give a grace period any tap extends, then expire. */
export function useIdleTimer({ enabled, warnAfterMs, graceMs, onExpire }: Options) {
  const [activity, setActivity] = useState(0)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [wasEnabled, setWasEnabled] = useState(enabled)
  const expire = useRef(onExpire)

  useEffect(() => {
    expire.current = onExpire
  }, [onExpire])

  // Toggling the timer starts it fresh.
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled)
    setDeadline(null)
    setActivity((n) => n + 1)
  }

  const extend = useCallback(() => {
    setActivity((n) => n + 1)
    setDeadline(null)
  }, [])

  useEffect(() => {
    if (!enabled) return
    for (const name of ACTIVITY) window.addEventListener(name, extend, { passive: true })
    return () => {
      for (const name of ACTIVITY) window.removeEventListener(name, extend)
    }
  }, [enabled, extend])

  useEffect(() => {
    if (!enabled || deadline !== null) return
    const timer = window.setTimeout(() => {
      const current = Date.now()
      setNow(current)
      setDeadline(current + graceMs)
    }, warnAfterMs)
    return () => window.clearTimeout(timer)
  }, [enabled, deadline, activity, warnAfterMs, graceMs])

  useEffect(() => {
    if (!enabled || deadline === null) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= deadline) {
        setDeadline(null)
        setActivity((n) => n + 1)
        expire.current()
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [enabled, deadline])

  const warning = enabled && deadline !== null
  return { warning, secondsLeft: warning ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0, extend }
}
