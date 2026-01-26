import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Core Navigation', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Login as test user
        await loginAsTestUser(page);

        // 2. Navigate to root (should redirect to manager-office)
        await page.goto('/');

        // 3. Wait for Preloader to vanish (Critical Check)
        await expect(page.getByText('Loading Assets...')).not.toBeVisible({ timeout: 10000 });
    });

    test('Redirects to Manager Office by default', async ({ page }) => {
        await expect(page).toHaveURL(/.*manager-office/);
        await expect(page.getByText('Office', { exact: true })).toHaveClass(/text-yellow-400/); // Active State
    });

    test('Bottom Nav: Can switch between rooms', async ({ page }) => {
        // Tap "Locker" (Dressing Room)
        await page.getByText('Locker').click();

        // Verify URL and Visuals
        await expect(page).toHaveURL(/.*dashboard/);
        await expect(page.getByTestId('hotspot-inventory')).toBeVisible();

        // Tap "Office"
        await page.getByText('Office').click();
        await expect(page).toHaveURL(/.*manager-office/);
        await expect(page.getByTestId('hotspot-window')).toBeVisible();
    });

    test('Gestures: Can SWIPE between rooms', async ({ page }) => {
        // START: Manager Office
        await expect(page).toHaveURL(/.*manager-office/);

        // ACTION: Swipe RIGHT (Office -> Locker)
        // Note: Playwright requires manual mouse/touch simulation for React custom handlers
        await page.mouse.move(50, 300);
        await page.mouse.down();
        await page.mouse.move(300, 300, { steps: 5 }); // Drag across screen
        await page.mouse.up();

        // ASSERT: Should be in Dashboard
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 2000 });

        // ACTION: Swipe LEFT (Locker -> Office)
        await page.mouse.move(300, 300);
        await page.mouse.down();
        await page.mouse.move(50, 300, { steps: 5 }); // Drag back
        await page.mouse.up();

        // ASSERT: Should be back in Office
        await expect(page).toHaveURL(/.*manager-office/, { timeout: 2000 });
    });
});
