import { test, expect } from '@playwright/test'

test.describe('Funnel Analysis — BR-303', () => {
  test('funnel page loads with step builder', async ({ page }) => {
    await page.goto('/funnels')
    await expect(page.locator('text=Funnel')).toBeVisible()
  })
})
