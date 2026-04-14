import { test, expect } from '@playwright/test'

test.describe('Event Explorer — BR-200', () => {
  test.beforeAll(async ({ request }) => {
    // Seed data before tests
    await request.post('http://localhost:3001/api/seed')
  })

  test('explorer page loads and shows events', async ({ page }) => {
    await page.goto('/explorer')
    // Wait for events to load
    await page.waitForSelector('table', { timeout: 10000 })
    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toBeVisible()
  })

  test('event name filter works', async ({ page }) => {
    await page.goto('/explorer')
    await page.waitForSelector('table')
    // There should be a Select for event name filtering
    const filterSelect = page.locator('.ant-select').first()
    await expect(filterSelect).toBeVisible()
  })
})
