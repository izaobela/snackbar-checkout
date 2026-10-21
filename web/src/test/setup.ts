import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { server } from './msw'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  // Vitest runs with globals off, so Testing Library does not clean up on its own.
  cleanup()
  server.resetHandlers()
  window.sessionStorage.clear()
})
afterAll(() => server.close())
