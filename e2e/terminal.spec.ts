import { test, expect } from '@playwright/test'

test.describe('Real-Time Trading Terminal E2E', () => {
  test('loads terminal layout, orderbook, trade tape, and form', async ({ page }) => {
    await page.goto('/')

    // Check title and container
    await expect(page.getByTestId('app-container')).toBeVisible()
    await expect(page.getByTestId('terminal-header')).toBeVisible()
    await expect(page.getByTestId('telemetry-bar')).toBeVisible()
    await expect(page.getByTestId('order-entry-form')).toBeVisible()
    await expect(page.getByTestId('positions-view')).toBeVisible()

    // Check brand
    await expect(page.locator('.brand-name')).toHaveText('NEXUS')

    // Check order placement flow
    const priceInput = page.locator('#order-price')
    const amountInput = page.locator('#order-amount')

    await priceInput.fill('64500')
    await amountInput.fill('0.5')
    await page.getByRole('button', { name: /BUY \/ LONG BTC/i }).click()

    await expect(page.locator('.order-success-banner')).toBeVisible()
  })
})
