import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { addFlatWhite, renderApp } from './test/helpers'

vi.mock('./config', () => ({ IDLE_WARN_MS: 300, IDLE_GRACE_MS: 400, THANK_YOU_MS: 15_000, MENU_REFRESH_MS: 60_000 }))

describe('idle reset', () => {
  it('warns, then clears the order and returns to the welcome screen', async () => {
    const user = renderApp()
    await addFlatWhite(user)
    const dialog = screen.getByText('Still there?').closest('dialog')
    await waitFor(() => expect(dialog).toHaveAttribute('open'), { timeout: 2_000 })
    await waitFor(() => expect(screen.getByTestId('start-browse')).toBeInTheDocument(), { timeout: 2_000 })
    expect(dialog).not.toHaveAttribute('open')
    expect(window.sessionStorage.getItem('iza-bela.cart')).toBeNull()
  })

  it('a tap during the warning keeps the order', async () => {
    const user = renderApp()
    await addFlatWhite(user)
    const dialog = screen.getByText('Still there?').closest('dialog')
    await waitFor(() => expect(dialog).toHaveAttribute('open'), { timeout: 2_000 })
    await user.click(screen.getByRole('button', { name: "I'm still here" }))
    expect(dialog).not.toHaveAttribute('open')
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.getByTestId('pay')).toHaveTextContent('Pay $4.87')
  })
})
