#!/usr/bin/env node

/**
 * Live Odds API Verification Script
 * 
 * Tests the /api/odds-live endpoint to ensure:
 * 1. The endpoint is reachable (200 OK)
 * 2. Returns correct JSON structure
 * 3. Contains valid odds data
 */

const VERCEL_DEV_URL = 'http://localhost:3001';
const TEST_FIXTURE_ID = '12345'; // Use a known live match ID for real testing

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function verifyLiveOddsEndpoint() {
    log('\n🔍 LIVE ODDS API VERIFICATION', 'bold');
    log('================================\n', 'cyan');

    const endpoint = `${VERCEL_DEV_URL}/api/odds-live?fixture=${TEST_FIXTURE_ID}`;

    log(`📡 Testing endpoint: ${endpoint}`, 'cyan');
    log(`⏳ Fetching...\n`);

    try {
        const startTime = Date.now();
        const response = await fetch(endpoint);
        const duration = Date.now() - startTime;

        log(`📊 Response Status: ${response.status}`, response.status === 200 ? 'green' : 'red');
        log(`⏱️  Response Time: ${duration}ms\n`);

        // Assert 1: Status should be 200
        if (response.status !== 200) {
            log(`❌ FAILED: Expected status 200, got ${response.status}`, 'red');
            const text = await response.text();
            log(`\nRaw Response:\n${text}`, 'yellow');
            process.exit(1);
        }

        const data = await response.json();
        log(`📦 Response Data:`, 'cyan');
        console.log(JSON.stringify(data, null, 2));
        console.log();

        // Assert 2: Should have required structure
        const requiredFields = ['fixtureId', 'isLive', 'odds'];
        const missingFields = requiredFields.filter(field => !(field in data));

        if (missingFields.length > 0) {
            log(`❌ FAILED: Missing required fields: ${missingFields.join(', ')}`, 'red');
            process.exit(1);
        }

        // Assert 3: Odds should have home, draw, away
        const requiredOdds = ['home', 'draw', 'away'];
        const missingOdds = requiredOdds.filter(field => !(field in data.odds));

        if (missingOdds.length > 0) {
            log(`❌ FAILED: Missing odds fields: ${missingOdds.join(', ')}`, 'red');
            process.exit(1);
        }

        // Assert 4: Odds should be numbers
        const oddsValues = [data.odds.home, data.odds.draw, data.odds.away];
        const invalidOdds = oddsValues.filter(val => typeof val !== 'number' || isNaN(val));

        if (invalidOdds.length > 0) {
            log(`❌ FAILED: Odds values must be numbers`, 'red');
            process.exit(1);
        }

        // Assert 5: Check source
        log(`📍 Data Source: ${data.source || 'Unknown'}`, data.source === 'SIMULATION' ? 'yellow' : 'green');

        if (data.source === 'SIMULATION') {
            log(`⚠️  WARNING: Using simulation data (expected if no API key or minor league)`, 'yellow');
        }

        // Success!
        log('\n✅ LIVE ODDS SYSTEM OPERATIONAL', 'green');
        log('================================\n', 'green');

        log('Summary:', 'bold');
        log(`  • Endpoint: Reachable`, 'green');
        log(`  • Status: 200 OK`, 'green');
        log(`  • Structure: Valid`, 'green');
        log(`  • Odds: ${data.odds.home} / ${data.odds.draw} / ${data.odds.away}`, 'green');
        log(`  • Source: ${data.source}`, data.source === 'SIMULATION' ? 'yellow' : 'green');
        log('');

        process.exit(0);

    } catch (error) {
        log(`\n❌ VERIFICATION FAILED`, 'red');
        log('================================\n', 'red');

        if (error.code === 'ECONNREFUSED') {
            log(`Connection refused. Is Vercel dev server running on port 3000?`, 'yellow');
            log(`Run: vercel dev`, 'cyan');
        } else {
            log(`Error: ${error.message}`, 'red');
            log(`\nStack trace:`, 'yellow');
            console.error(error.stack);
        }

        process.exit(1);
    }
}

// Run verification
verifyLiveOddsEndpoint();
