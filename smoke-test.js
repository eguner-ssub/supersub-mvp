/**
 * Smoke Test - Diagnose White Screen of Death
 * 
 * This script uses Puppeteer to:
 * 1. Visit localhost:5173
 * 2. Capture console errors
 * 3. Check if root div exists
 * 4. Take a screenshot
 */

import puppeteer from 'puppeteer';

async function runSmokeTest() {
    console.log('🔍 Starting Smoke Test...\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await puppeteer.newPage();

    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        consoleMessages.push({ type, text });

        if (type === 'error' || type === 'warning') {
            console.log(`❌ [${type.toUpperCase()}] ${text}`);
        }
    });

    // Capture page errors
    const pageErrors = [];
    page.on('pageerror', error => {
        pageErrors.push(error.message);
        console.log(`💥 [PAGE ERROR] ${error.message}`);
    });

    try {
        console.log('📍 Navigating to http://localhost:5173/\n');
        await page.goto('http://localhost:5173/', {
            waitUntil: 'networkidle0',
            timeout: 10000
        });

        // Wait a bit for React to render
        await page.waitForTimeout(2000);

        // Check if root div exists
        const rootExists = await page.evaluate(() => {
            const root = document.getElementById('root');
            return {
                exists: !!root,
                innerHTML: root ? root.innerHTML.substring(0, 200) : null,
                hasChildren: root ? root.children.length > 0 : false
            };
        });

        console.log('\n📊 Root Element Status:');
        console.log(`  - Exists: ${rootExists.exists}`);
        console.log(`  - Has Children: ${rootExists.hasChildren}`);
        console.log(`  - Inner HTML (first 200 chars): ${rootExists.innerHTML || 'EMPTY'}\n`);

        // Take screenshot
        await page.screenshot({ path: 'smoke-test-screenshot.png', fullPage: true });
        console.log('📸 Screenshot saved to: smoke-test-screenshot.png\n');

        // Summary
        console.log('📋 Summary:');
        console.log(`  - Console Errors: ${consoleMessages.filter(m => m.type === 'error').length}`);
        console.log(`  - Page Errors: ${pageErrors.length}`);
        console.log(`  - Root Rendered: ${rootExists.hasChildren ? 'YES ✅' : 'NO ❌'}\n`);

        if (pageErrors.length > 0) {
            console.log('🔥 Page Errors Detected:');
            pageErrors.forEach((err, i) => {
                console.log(`\n${i + 1}. ${err}`);
            });
        }

        if (!rootExists.hasChildren) {
            console.log('\n⚠️  WHITE SCREEN CONFIRMED - Root div is empty!');
        }

    } catch (error) {
        console.error('❌ Smoke test failed:', error.message);
    } finally {
        await browser.close();
    }
}

runSmokeTest().catch(console.error);
