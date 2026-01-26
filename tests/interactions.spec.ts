import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test('Room B: Manager Office Interactions', async ({ page }) => {
    // Login first
    await loginAsTestUser(page);

    await page.goto('/manager-office');

    // Wait for loading
    await expect(page.getByText('Loading Assets...')).not.toBeVisible({ timeout: 10000 });

    // Test: Click Window -> Match Hub
    await page.getByTestId('hotspot-window').click();
    await expect(page).toHaveURL(/.*match-hub/);

    // Go back (simulating browser back or nav)
    await page.goBack();

    // Test: Click Laptop -> Scouting
    await page.getByTestId('hotspot-laptop').click();
    await expect(page).toHaveURL(/.*scouting/);
});

test('Room A: Dressing Room Interactions', async ({ page }) => {
    // Login first
    await loginAsTestUser(page);

    await page.goto('/dashboard');

    // Wait for loading
    await expect(page.getByText('Loading Assets...')).not.toBeVisible({ timeout: 10000 });

    // Test: Tap Kitbag -> Inventory
    await page.getByTestId('hotspot-inventory').click();
    await expect(page).toHaveURL(/.*inventory/);
});
