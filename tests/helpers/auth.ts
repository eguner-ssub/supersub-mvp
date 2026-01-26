import { Page } from '@playwright/test';

/**
 * Test User Credentials
 * Create this user in Supabase before running tests:
 * Email: test@supersub.com
 * Password: TestPassword123!
 */
const TEST_USER = {
    email: 'test@supersub.com',
    password: 'TestPassword123!',
};

/**
 * Login as test user via the login page
 * This function navigates to /login, fills in credentials, and submits
 */
export async function loginAsTestUser(page: Page) {
    // Navigate to login page
    await page.goto('/login');

    // Wait for login form to be visible
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });

    // Fill in credentials
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to authenticated page
    // This could be dashboard or manager-office depending on app logic
    await page.waitForURL(/\/(dashboard|manager-office)/, { timeout: 10000 });
}

/**
 * Check if user is already logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
    const url = page.url();
    return url.includes('/dashboard') || url.includes('/manager-office');
}
