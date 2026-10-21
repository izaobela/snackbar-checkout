import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('browse, tap to pay, read the pickup number', async ({ page }) => {
  await expectAccessible(page)
  await page.getByTestId('start-browse').tap()
  await expect(page.getByRole('button', { name: /Add one Flat white/ })).toBeVisible()
  await expectAccessible(page)

  await page.getByRole('button', { name: /Add one Flat white/ }).tap()
  await page.getByRole('button', { name: /Add one Flat white/ }).tap()
  await page.getByRole('button', { name: /Add one Butter croissant/ }).tap()
  await expect(page.getByTestId('pay')).toHaveText(/Pay \$13\.80/)

  await page.getByTestId('pay').tap()
  await expect(page.getByTestId('tap-card')).toBeVisible()
  await expectAccessible(page)

  await page.getByTestId('tap-card').tap()
  await expect(page.getByTestId('pickup-number')).toHaveText(/\d\d/)
  await expectAccessible(page)

  await page.getByTestId('done').tap()
  await expect(page.getByTestId('start-browse')).toBeVisible()
})

test('scan a product, keyed card declined, then approved by tap', async ({ page }) => {
  await page.getByTestId('start-scan').tap()
  await page.getByRole('button', { name: 'Scan Iced tea' }).tap()
  await expect(page.getByText(/Iced tea, \$3\.25, added/)).toBeVisible()
  await expectAccessible(page)
  await page.getByTestId('pay').tap()

  for (const digit of '4000000000000002' + '1230' + '123') {
    await page.getByRole('button', { name: digit, exact: true }).tap()
  }
  await page.getByTestId('pay-card').tap()
  await expect(page.getByRole('alert')).toContainText(/declined/)

  await page.getByTestId('tap-card').tap()
  // Scanned items are already in hand: no pickup number, just the receipt.
  await expect(page.getByTestId('all-set')).toBeVisible()
  await expect(page.getByTestId('pickup-number')).toHaveCount(0)
})
