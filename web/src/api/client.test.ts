import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { api, ApiError } from './client'
import { apiError, server } from '../test/msw'

const order = { lines: [{ item_id: 'flat-white', qty: 1, unit_price_cents: 450, source: 'menu' as const }], payment: { method: 'tap' as const } }

describe('api client', () => {
  it('sends the body and the idempotency key', async () => {
    let seen: { key: string | null; body: unknown } | null = null
    server.use(
      http.post('/api/orders', async ({ request }) => {
        seen = { key: request.headers.get('idempotency-key'), body: await request.json() }
        return HttpResponse.json({ id: 'x' }, { status: 201 })
      }),
    )
    await api.placeOrder(order, 'key-1')
    expect(seen).toEqual({ key: 'key-1', body: order })
  })

  it('turns an error envelope into an ApiError with its code and data', async () => {
    server.use(http.post('/api/orders', () => apiError(409, { code: 'menu_changed', message: 'Changed', changes: [] })))
    const error = await api.placeOrder(order, 'k').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: 'menu_changed', message: 'Changed', retryable: false })
    expect((error as ApiError).data?.changes).toEqual([])
  })

  it('treats a network failure as retryable', async () => {
    server.use(http.get('/api/menu', () => HttpResponse.error()))
    await expect(api.getMenu()).rejects.toMatchObject({ status: 0, code: 'network', retryable: true })
  })

  it('treats a 500 as retryable and a 4xx as not', async () => {
    server.use(http.get('/api/menu', () => new HttpResponse('boom', { status: 502 })))
    await expect(api.getMenu()).rejects.toMatchObject({ status: 502, retryable: true })
    server.use(http.get('/api/menu', () => new HttpResponse(null, { status: 404 })))
    await expect(api.getMenu()).rejects.toMatchObject({ status: 404, retryable: false })
  })

  it('rejects a success that is not JSON', async () => {
    server.use(http.get('/api/menu', () => new HttpResponse('<html>portal</html>', { headers: { 'content-type': 'text/html' } })))
    await expect(api.getMenu()).rejects.toMatchObject({ code: 'bad_response' })
  })
})
