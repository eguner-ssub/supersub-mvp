import { test, expect } from '@playwright/test';

test('App Boot & Sanity Check', async ({ page }) => {
    // 1. Boot App
    await page.goto('/');

    // 2. Verify Critical Render (Login or Dashboard)
    // Wait for a known element that confirms React hydrated successfully
    await expect(
        page.locator('text=Log In').or(page.locator('text=Eren\'s FC'))
    ).toBeVisible({ timeout: 15000 });

    // 3. Navigation Smoke Test
    // Ensure we can click a link and the URL changes (Basic Router check)
    const officeLink = page.locator('a[href*="manager-office"]').or(page.getByText('Office'));
    if (await officeLink.isVisible()) {
        await officeLink.click();
        await expect(page).toHaveURL(/.*manager-office/);
    }
});
