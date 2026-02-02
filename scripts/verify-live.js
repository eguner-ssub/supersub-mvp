#!/usr/bin/env node

/**
 * END-TO-END LIVE ODDS VERIFICATION
 * 
 * Tests /api/odds/live endpoint to ensure:
 * 1. Route is registered and accessible
 * 2. Returns 200 OK with valid JSON
 * 3. Response structure matches spec
 */

const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

const log = (msg, color = 'reset') => console.log(`${COLORS[color]}${msg}${COLORS.reset}`);

// Try multiple possible ports
const PORTS = [3000, 3001, 5173];
const TEST_FIXTURE = '1379206';

async function testPort(port) {
    const url = `http://localhost:${port}/api/odds/live?fixture=${TEST_FIXTURE}`;

    try {
        const response = await fetch(url);
        return { port, response, error: null };
    } catch (error) {
        return { port, response: null, error };
    }
}

async function findWorkingPort() {
    log('\n🔍 SCANNING FOR ACTIVE SERVER...', 'cyan');

    const results = await Promise.all(PORTS.map(testPort));
    const working = results.find(r => r.response && r.response.status === 200);

    if (working) {
        log(`✅ Found server on port ${working.port}\n`, 'green');
        return working;
    }

    const refused = results.filter(r => r.error?.code === 'ECONNREFUSED');
    if (refused.length === PORTS.length) {
        log('❌ No server running on any port', 'red');
        log('\n💡 Start the server with:', 'yellow');
        log('   vercel dev', 'cyan');
        log('   OR', 'yellow');
        log('   npm run dev\n', 'cyan');
        process.exit(1);
    }

    return null;
}

async function verifyLiveRoute() {
    log('\n🧪 LIVE ODDS ROUTE VERIFICATION', 'bold');
    log('================================\n', 'cyan');

    const result = await findWorkingPort();
    if (!result) {
        log('❌ Server found but /api/odds/live not responding\n', 'red');
        process.exit(1);
    }

    const { port, response } = result;
    const url = `http://localhost:${port}/api/odds/live?fixture=${TEST_FIXTURE}`;

    log(`📡 Testing: ${url}`, 'cyan');
    log(`📊 Status: ${response.status} ${response.statusText}`, response.status === 200 ? 'green' : 'red');
    log(`📋 Content-Type: ${response.headers.get('content-type')}\n`);

    // Get response text
    const text = await response.text();

    // Check if HTML (404 page)
    if (text.trim().startsWith('<') || text.trim().startsWith('<!')) {
        log('❌ FAILED: Received HTML instead of JSON\n', 'red');
        log('📄 Response Preview:', 'yellow');
        log(text.substring(0, 300) + '...\n');
        log('🔍 DIAGNOSIS:', 'yellow');
        log('  • Route /api/odds/live is NOT registered', 'red');
        log('  • File api/odds/live.js may be missing', 'red');
        log('\n💡 SOLUTION:', 'yellow');
        log('  1. Ensure api/odds/live.js exists', 'cyan');
        log('  2. Restart server: Ctrl+C then run "vercel dev"', 'cyan');
        log('  3. Run this script again\n', 'cyan');
        process.exit(1);
    }

    // Parse JSON
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        log('❌ FAILED: Invalid JSON\n', 'red');
        log('📄 Raw Response:', 'yellow');
        log(text + '\n');
        process.exit(1);
    }

    log('✅ SUCCESS: Valid JSON received\n', 'green');
    log('📦 Response:', 'cyan');
    console.log(JSON.stringify(data, null, 2));
    console.log();

    // Validate structure
    const hasFixtureId = 'fixtureId' in data;
    const hasIsLive = 'isLive' in data;
    const hasOdds = data.odds && typeof data.odds === 'object';
    const hasHome = hasOdds && 'home' in data.odds;
    const hasDraw = hasOdds && 'draw' in data.odds;
    const hasAway = hasOdds && 'away' in data.odds;

    if (!hasFixtureId || !hasIsLive || !hasOdds || !hasHome || !hasDraw || !hasAway) {
        log('❌ FAILED: Invalid response structure\n', 'red');
        log('Expected:', 'yellow');
        log('  { fixtureId, isLive, odds: { home, draw, away } }\n');
        process.exit(1);
    }

    log('✅ Structure: Valid', 'green');
    log(`📍 Fixture ID: ${data.fixtureId}`, 'green');
    log(`🔴 Is Live: ${data.isLive}`, 'green');
    log(`📊 Odds: ${data.odds.home} / ${data.odds.draw} / ${data.odds.away}`, 'green');
    log(`🔖 Source: ${data.source || 'Unknown'}`, data.source === 'SIMULATION' ? 'yellow' : 'green');

    if (data.source === 'SIMULATION') {
        log('\n⚠️  Using simulation data (expected without API key)', 'yellow');
    }

    log('\n✅ LIVE ROUTE FUNCTIONAL', 'green');
    log('================================\n', 'green');

    log('Summary:', 'bold');
    log(`  • Server: Running on port ${port}`, 'green');
    log(`  • Route: /api/odds/live accessible`, 'green');
    log(`  • Response: Valid JSON`, 'green');
    log(`  • Structure: Correct`, 'green');
    log('');

    process.exit(0);
}

verifyLiveRoute();
