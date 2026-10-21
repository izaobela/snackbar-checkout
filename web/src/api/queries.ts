import { useMutation, useQuery } from '@tanstack/react-query'

import { MENU_REFRESH_MS } from '../config'
import { api, ApiError } from './client'
import type { OrderIn } from './types'

export const menuKey = ['menu'] as const

export function useMenu() {
  return useQuery({
    queryKey: menuKey,
    queryFn: api.getMenu,
    retry: 1,
    staleTime: 10_000,
    // Re-probe quickly while the menu cannot be loaded, refresh calmly once it can.
    refetchInterval: (query) => (query.state.status === 'error' ? 5_000 : MENU_REFRESH_MS),
  })
}

export function usePlaceOrder() {
  return useMutation({
    mutationFn: ({ order, key }: { order: OrderIn; key: string }) => api.placeOrder(order, key),
    // Same variables on every retry, so the Idempotency-Key is the same too.
    retry: (failureCount, error) => failureCount < 2 && error instanceof ApiError && error.retryable,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
  })
}
