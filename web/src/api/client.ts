import type { ErrorBody, Menu, Order, OrderIn } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly data: ErrorBody | null

  constructor(status: number, code: string, message: string, data: ErrorBody | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }

  /** Worth retrying: the request never got a proper answer, or the server fell over. */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500
  }
}

type Options = { method?: 'GET' | 'POST'; body?: unknown; headers?: Record<string, string>; timeoutMs?: number }

async function fetchJson<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers }
  if (options.body !== undefined) headers['content-type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
    })
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the server.')
  }

  const isJson = (response.headers.get('content-type') ?? '').includes('json')
  const body: unknown = isJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    const error = (body as { error?: ErrorBody } | null)?.error
    throw new ApiError(response.status, error?.code ?? 'http_error', error?.message ?? `Request failed (${response.status})`, error ?? null)
  }
  if (body === null) throw new ApiError(0, 'bad_response', 'Unexpected response from the server.')
  return body as T
}

export const api = {
  getMenu: () => fetchJson<Menu>('/api/menu'),
  placeOrder: (order: OrderIn, idempotencyKey: string) =>
    fetchJson<Order>('/api/orders', {
      method: 'POST',
      body: order,
      headers: { 'Idempotency-Key': idempotencyKey },
      timeoutMs: 15_000,
    }),
}
