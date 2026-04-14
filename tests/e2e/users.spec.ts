import { test, expect } from '@playwright/test'

test.describe('User Profiles — BR-304', () => {
  test('users page loads with search', async ({ page }) => {
    await page.goto('/users')
    await expect(page.locator('input[type="search"], .ant-input-search input')).toBeVisible({ timeout: 5000 })
  })
})
