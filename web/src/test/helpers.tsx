import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import { App } from '../App'
import type { OrderIn } from '../api/types'
import { apiError, fakeOrder, server } from './msw'
import { renderWithQueries } from './render'

export type User = ReturnType<typeof userEvent.setup>
export type Captured = { body: OrderIn; key: string | null }

export function renderApp() {
  renderWithQueries(<App />)
  return userEvent.setup()
}

/** Record every POST /api/orders and answer with whatever `respond` returns for that call. */
export function captureOrders(respond: (calls: Captured[], n: number) => Response | Promise<Response>) {
  const calls: Captured[] = []
  server.use(
    http.post('/api/orders', async ({ request }) => {
      calls.push({ body: (await request.json()) as OrderIn, key: request.headers.get('idempotency-key') })
      return respond(calls, calls.length)
    }),
  )
  return calls
}

export const created = () => HttpResponse.json(fakeOrder(), { status: 201 })
export const failure = (status = 500) => apiError(status, { code: 'internal_error', message: 'Broken' })

export async function openMenu(user: User) {
  await user.click(await screen.findByTestId('start-browse'))
}

export async function addFlatWhite(user: User) {
  if (screen.queryByTestId('start-browse')) await openMenu(user)
  await user.click(await screen.findByRole('button', { name: /Add one Flat white/ }))
}

export async function goToPayment(user: User) {
  await addFlatWhite(user)
  await user.click(screen.getByTestId('pay'))
  await screen.findByTestId('tap-card')
}

export async function keyIn(user: User, digits: string) {
  for (const digit of digits) await user.click(screen.getByRole('button', { name: digit }))
}
