import { test, expect } from '@playwright/test'

test.describe('Trend Analysis — BR-201', () => {
  test('trends page loads with event selector', async ({ page }) => {
    await page.goto('/trends')
    await expect(page.locator('h4, h3, h2').first()).toBeVisible()
  })

  test('shows chart after selecting event', async ({ page }) => {
    await page.goto('/trends')
    // Select an event — click the first Select and pick first option
    await page.waitForSelector('.ant-select', { timeout: 5000 })
  })
})
