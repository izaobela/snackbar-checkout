import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useIdleTimer } from './useIdleTimer'

describe('useIdleTimer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('warns after the quiet spell, counts down, then expires', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useIdleTimer({ enabled: true, warnAfterMs: 1000, graceMs: 500, onExpire }))
    expect(result.current.warning).toBe(false)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.warning).toBe(true)
    expect(result.current.secondsLeft).toBe(1)
    act(() => vi.advanceTimersByTime(600))
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(result.current.warning).toBe(false)
  })

  it('a tap during the warning restores the timer', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useIdleTimer({ enabled: true, warnAfterMs: 1000, graceMs: 500, onExpire }))
    act(() => vi.advanceTimersByTime(1000))
    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
    })
    expect(result.current.warning).toBe(false)
    act(() => vi.advanceTimersByTime(900))
    expect(result.current.warning).toBe(false)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('does nothing while disabled', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useIdleTimer({ enabled: false, warnAfterMs: 100, graceMs: 100, onExpire }))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.warning).toBe(false)
    expect(onExpire).not.toHaveBeenCalled()
  })
})
