import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { addFlatWhite, captureOrders, created, failure, goToPayment, keyIn, openMenu, renderApp } from './test/helpers'
import { apiError, fakeOrder, seedMenu, server } from './test/msw'

const priceChange = () =>
  apiError(409, {
    code: 'menu_changed',
    message: 'The menu changed while you were ordering.',
    changes: [{ item_id: 'flat-white', name: 'Flat white', reason: 'price_changed', old_price_cents: 450, new_price_cents: 500 }],
    current_totals: { subtotal_cents: 500, tax_cents: 41, total_cents: 541 },
  })

const GOOD_CARD = '4242424242424242' + '1230' + '123'

describe('App', () => {
  it('offers scan or browse first, then places an order by tap', async () => {
    const calls = captureOrders(created)
    const user = renderApp()

    expect(await screen.findByText('How would you like to order?')).toBeInTheDocument()
    expect(screen.getByText('Welcome to Iza & Bela Snack Bar')).toBeInTheDocument()
    await openMenu(user)
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument()
    await addFlatWhite(user)
    expect(screen.getByTestId('pay')).toHaveTextContent('Pay $4.87')
    await user.click(screen.getByTestId('pay'))
    await user.click(await screen.findByTestId('tap-card'))

    expect(await screen.findByTestId('pickup-number')).toHaveTextContent('07')
    // The receipt the printer would print: the order code as text and as a barcode.
    expect(screen.getByText('Order 07')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Barcode ORDER1' })).toBeInTheDocument()
    expect(screen.getByText(/Oct 21, 2026/)).toBeInTheDocument()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toEqual({ lines: [{ item_id: 'flat-white', qty: 1, unit_price_cents: 450, source: 'menu' }], payment: { method: 'tap' }, expected_total_cents: 487 })
    expect(calls[0]?.key).toMatch(/[0-9a-f-]{20,}/)
    expect(window.sessionStorage.getItem('iza-bela.cart')).toBeNull()
    expect(window.sessionStorage.getItem('iza-bela.key')).toBeNull()
  })

  it('scanning a product adds it to the order, and a scanned order needs no pickup number', async () => {
    const scanned = () => HttpResponse.json(fakeOrder({ pickup_number: null, lines: [{ item_id: 'iced-tea', name: 'Iced tea', unit_price_cents: 325, qty: 1, source: 'scan' }] }), { status: 201 })
    const calls = captureOrders(scanned)
    const user = renderApp()
    await user.click(await screen.findByTestId('start-scan'))
    await user.click(await screen.findByRole('button', { name: 'Scan Iced tea' }))
    expect(await screen.findByText(/Iced tea, \$3\.25, added/)).toBeInTheDocument()
    const panel = screen.getByRole('complementary', { name: 'Your order' })
    expect(within(panel).getByText('Iced tea')).toBeInTheDocument()
    expect(screen.getByTestId('pay')).toHaveTextContent('Pay $3.52')
    expect(screen.getByRole('button', { name: 'Scan Blueberry muffin, sold out' })).toBeInTheDocument()

    await user.click(screen.getByTestId('pay'))
    await user.click(await screen.findByTestId('tap-card'))
    expect(await screen.findByTestId('all-set')).toHaveTextContent(/all set/)
    expect(screen.queryByTestId('pickup-number')).toBeNull()
    expect(screen.queryByText(/^Order \d/)).toBeNull() // no order number on the receipt either
    expect(calls[0]?.body.lines).toEqual([{ item_id: 'iced-tea', qty: 1, unit_price_cents: 325, source: 'scan' }])
  })

  it('sends one request on a double tap', async () => {
    const calls = captureOrders(async () => {
      await new Promise((r) => setTimeout(r, 200))
      return created()
    })
    const user = renderApp()
    await goToPayment(user)
    const tap = screen.getByTestId('tap-card')
    await user.click(tap)
    await user.click(tap)
    await screen.findByTestId('pickup-number')
    expect(calls).toHaveLength(1)
  })

  it('retries a server error with the same key', async () => {
    const calls = captureOrders((_, n) => (n === 1 ? failure() : created()))
    const user = renderApp()
    await goToPayment(user)
    await user.click(screen.getByTestId('tap-card'))
    await screen.findByTestId('pickup-number', {}, { timeout: 5_000 })
    expect(calls).toHaveLength(2)
    expect(calls[1]?.key).toBe(calls[0]?.key)
  })

  it('offers Try again when the server stays down', async () => {
    const calls = captureOrders((_, n) => (n <= 3 ? failure() : created()))
    const user = renderApp()
    await goToPayment(user)
    await user.click(screen.getByTestId('tap-card'))
    const alert = await screen.findByRole('alert', {}, { timeout: 8_000 })
    expect(alert).toHaveTextContent(/couldn't reach the register/)
    await user.click(within(alert).getByTestId('try-again'))
    await screen.findByTestId('pickup-number')
    expect(calls).toHaveLength(4)
    expect(new Set(calls.map((c) => c.key)).size).toBe(1)
  }, 15_000)

  it('reuses the key when the cart is unchanged', async () => {
    const calls = captureOrders((_, n) => (n === 1 ? apiError(422, { code: 'validation_error', message: 'Something in the order did not look right.' }) : created()))
    const user = renderApp()
    await goToPayment(user)
    await user.click(screen.getByTestId('tap-card'))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: /Back to order/ }))
    await user.click(screen.getByTestId('pay'))
    await user.click(await screen.findByTestId('tap-card'))
    await screen.findByTestId('pickup-number')
    expect(calls).toHaveLength(2)
    expect(calls[1]?.key).toBe(calls[0]?.key)
  })

  it('uses a new key when the cart changed', async () => {
    const calls = captureOrders((_, n) => (n === 1 ? apiError(422, { code: 'validation_error', message: 'Nope.' }) : created()))
    const user = renderApp()
    await goToPayment(user)
    await user.click(screen.getByTestId('tap-card'))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: /Back to order/ }))
    await user.click(screen.getByRole('button', { name: /Add one Iced tea/ }))
    await user.click(screen.getByTestId('pay'))
    await user.click(await screen.findByTestId('tap-card'))
    await screen.findByTestId('pickup-number')
    expect(calls[1]?.key).not.toBe(calls[0]?.key)
    expect(calls[1]?.body.lines).toHaveLength(2)
  })

  it('explains a 409 and resubmits with the new price and a new key', async () => {
    const calls = captureOrders((_, n) => (n === 1 ? priceChange() : created()))
    const user = renderApp()
    await goToPayment(user)
    await user.click(screen.getByTestId('tap-card'))
    expect(await screen.findByText('Flat white is now $5.00, was $4.50.')).toBeInTheDocument()
    expect(screen.getByText('Your new total is $5.41.')).toBeInTheDocument()
    await user.click(screen.getByTestId('confirm-new-total'))
    await screen.findByTestId('pickup-number')
    expect(calls).toHaveLength(2)
    expect(calls[1]?.body.lines).toEqual([{ item_id: 'flat-white', qty: 1, unit_price_cents: 500, source: 'menu' }])
    expect(calls[1]?.body.payment).toEqual({ method: 'tap' })
    expect(calls[1]?.body.expected_total_cents).toBe(541)
    expect(calls[1]?.key).not.toBe(calls[0]?.key)
  })

  it('explains a tax change, which has no line changes, and confirms the server total', async () => {
    const taxChange = () =>
      apiError(409, { code: 'menu_changed', message: 'The menu changed while you were ordering.', changes: [], current_totals: { subtotal_cents: 450, tax_cents: 50, total_cents: 500 } })
    const calls = captureOrders((_, n) => (n === 1 ? taxChange() : created()))
    const user = renderApp()
    await goToPayment(user)
    await user.click(screen.getByTestId('tap-card'))
    expect(await screen.findByText(/the tax rate changed/)).toBeInTheDocument()
    expect(screen.getByText('Your new total is $5.00.')).toBeInTheDocument()
    await user.click(screen.getByTestId('confirm-new-total'))
    await screen.findByTestId('pickup-number')
    expect(calls.map((c) => c.body.expected_total_cents)).toEqual([487, 500])
  })

  it('takes a sold-out item out of the order and confirms the rest', async () => {
    const calls = captureOrders((_, n) =>
      n === 1
        ? apiError(409, {
            code: 'menu_changed',
            message: 'The menu changed while you were ordering.',
            changes: [{ item_id: 'flat-white', name: 'Flat white', reason: 'unavailable', old_price_cents: 450, new_price_cents: null }],
            current_totals: { subtotal_cents: 325, tax_cents: 27, total_cents: 352 },
          })
        : created(),
    )
    const user = renderApp()
    await addFlatWhite(user)
    await user.click(screen.getByRole('button', { name: /Add one Iced tea/ }))
    await user.click(screen.getByTestId('pay'))
    await user.click(await screen.findByTestId('tap-card'))
    expect(await screen.findByText(/Flat white just sold out/)).toBeInTheDocument()
    await user.click(screen.getByTestId('confirm-new-total'))
    await screen.findByTestId('pickup-number')
    expect(calls[1]?.body.lines).toEqual([{ item_id: 'iced-tea', qty: 1, unit_price_cents: 325, source: 'menu' }])
  })

  it('shows a decline and uses a new key for the next attempt', async () => {
    const calls = captureOrders((_, n) =>
      n === 1 ? apiError(402, { code: 'payment_declined', message: 'Your card was declined. Try another card.', decline_code: 'generic_decline', last4: '0002' }) : created(),
    )
    const user = renderApp()
    await goToPayment(user)
    await keyIn(user, '4000000000000002' + '1230' + '123')
    await user.click(screen.getByTestId('pay-card'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/declined/)
    expect(alert).toHaveTextContent(/ending in 0002/)
    expect(alert).not.toHaveTextContent(/generic_decline/)
    expect(screen.getByLabelText('Card number')).toHaveValue('')
    await user.click(screen.getByTestId('tap-card'))
    await screen.findByTestId('pickup-number')
    expect(calls[1]?.key).not.toBe(calls[0]?.key)
  })

  it('validates the keyed card in plain words and sends it once', async () => {
    const calls = captureOrders(created)
    const user = renderApp()
    await goToPayment(user)
    await user.click(screen.getByTestId('pay-card'))
    expect(await screen.findByText(/looks too short/)).toBeInTheDocument()
    await keyIn(user, GOOD_CARD)
    expect(screen.getByLabelText('Card number')).toHaveValue('4242 4242 4242 4242')
    expect(screen.getByLabelText(/Expiry/)).toHaveValue('12/30')
    await user.click(screen.getByTestId('pay-card'))
    await screen.findByTestId('pickup-number')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body.payment).toEqual({ method: 'card', number: '4242424242424242', exp_month: 12, exp_year: 2030, cvc: '123' })
    expect(calls[0]?.body.expected_total_cents).toBe(487)
  })

  it('takes the card from a keyboard, a paste or the input itself, not only the keypad', async () => {
    const calls = captureOrders(created)
    const user = renderApp()
    await goToPayment(user)
    await user.click(screen.getByLabelText('Card number'))
    await user.keyboard('4242')
    expect(screen.getByLabelText('Card number')).toHaveValue('4242')
    await user.paste('4242 4242 4242 12/30 123')
    expect(screen.getByLabelText('Card number')).toHaveValue('4242 4242 4242 4242')
    expect(screen.getByLabelText(/Expiry/)).toHaveValue('12/30')
    fireEvent.change(screen.getByLabelText(/Security code/), { target: { value: '987' } })
    await user.click(screen.getByTestId('pay-card'))
    await screen.findByTestId('pickup-number')
    expect(calls[0]?.body.payment).toEqual({ method: 'card', number: '4242424242424242', exp_month: 12, exp_year: 2030, cvc: '987' })
  })

  it('keeps the cart across a reload and skips the welcome screen', async () => {
    window.sessionStorage.setItem('iza-bela.cart', JSON.stringify([{ itemId: 'flat-white', qty: 2 }]))
    renderApp()
    await waitFor(() => expect(screen.getByTestId('pay')).toHaveTextContent('Pay $9.74'))
    expect(screen.queryByTestId('start-browse')).toBeNull()
  })

  it('keeps the key across a reload, so a request that was out is replayed, not repeated', async () => {
    const calls = captureOrders(created)
    const lines = [{ item_id: 'flat-white', qty: 2, unit_price_cents: 450, source: 'menu' }]
    window.sessionStorage.setItem('iza-bela.cart', JSON.stringify([{ itemId: 'flat-white', qty: 2 }]))
    window.sessionStorage.setItem('iza-bela.key', JSON.stringify({ key: 'minted-before-the-reload', fingerprint: JSON.stringify(lines) }))
    const user = renderApp()
    await waitFor(() => expect(screen.getByTestId('pay')).toHaveTextContent('Pay $9.74'))
    await user.click(screen.getByTestId('pay'))
    await user.click(await screen.findByTestId('tap-card'))
    await screen.findByTestId('pickup-number')
    expect(calls[0]?.key).toBe('minted-before-the-reload')
    expect(calls[0]?.body.lines).toEqual(lines)
  })

  it('says so when the menu cannot load, and recovers on Retry', async () => {
    server.use(http.get('/api/menu', () => failure(503)))
    const user = renderApp()
    await openMenu(user)
    expect(await screen.findByText(/can't take orders right now/, {}, { timeout: 5_000 })).toBeInTheDocument()
    server.use(http.get('/api/menu', () => HttpResponse.json(seedMenu())))
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('button', { name: /Add one Flat white/ })).toBeInTheDocument()
  }, 10_000)

  it('shows allergens and keeps sold-out items visible but not tappable', async () => {
    const user = renderApp()
    await openMenu(user)
    const muffin = await screen.findByRole('button', { name: /Blueberry muffin, Sold out/ })
    expect(muffin).toBeDisabled()
    expect(screen.getByRole('button', { name: /Butter croissant, \$3\.75, vegetarian, Contains wheat, milk, egg/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sparkling water, \$2\.50, vegan, gluten-free, 1 left/ })).toBeInTheDocument()
  })

  it('keeps what is left when the server says the stock ran short', async () => {
    const short = () =>
      apiError(409, {
        code: 'menu_changed',
        message: 'The menu changed while you were ordering.',
        changes: [{ item_id: 'sparkling-water', name: 'Sparkling water', reason: 'limited', old_price_cents: 250, new_price_cents: 250, left: 1 }],
        current_totals: { subtotal_cents: 250, tax_cents: 21, total_cents: 271 },
      })
    const calls = captureOrders((_, n) => (n === 1 ? short() : created()))
    const user = renderApp()
    await openMenu(user)
    const water = await screen.findByRole('button', { name: /Add one Sparkling water/ })
    await user.click(water)
    await user.click(water)
    await user.click(screen.getByTestId('pay'))
    await user.click(await screen.findByTestId('tap-card'))
    expect(await screen.findByText('Only 1 Sparkling water left, so your order has 1.')).toBeInTheDocument()
    await user.click(screen.getByTestId('confirm-new-total'))
    await screen.findByTestId('pickup-number')
    expect(calls[0]?.body.lines).toEqual([{ item_id: 'sparkling-water', qty: 2, unit_price_cents: 250, source: 'menu' }])
    expect(calls[1]?.body.lines).toEqual([{ item_id: 'sparkling-water', qty: 1, unit_price_cents: 250, source: 'menu' }])
  })

  it('asks before clearing a started order, then returns to the welcome screen', async () => {
    const user = renderApp()
    await addFlatWhite(user)
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: /Start over/ }))
    await user.click(screen.getByRole('button', { name: 'Clear the order' }))
    expect(screen.getByTestId('start-browse')).toBeInTheDocument()
  })
})
