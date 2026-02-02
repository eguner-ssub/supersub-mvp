#!/usr/bin/env node

/**
 * API STRUCTURE DIAGNOSTIC
 * 
 * Verifies the API directory refactor and tests endpoint accessibility
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

const log = (msg, color = 'reset') => console.log(`${COLORS[color]}${msg}${COLORS.reset}`);

const API_DIR = path.join(__dirname, '..', 'api');
const PORTS = [3000, 3001, 5173];
const TEST_FIXTURE = '123456';

async function checkFileStructure() {
    log('\n🔍 STEP 1: FILE STRUCTURE VERIFICATION', 'bold');
    log('========================================\n', 'cyan');

    const oddsIndexPath = path.join(API_DIR, 'odds', 'index.js');
    const oddsLivePath = path.join(API_DIR, 'odds', 'live.js');
    const oldOddsPath = path.join(API_DIR, 'odds.js');

    // Check if old file still exists (should NOT)
    if (fs.existsSync(oldOddsPath)) {
        log('❌ Refactor Failed: api/odds.js still exists', 'red');
        log('💡 This file blocks the odds/ directory', 'yellow');
        log(`   Run: mv api/odds.js api/odds/index.js\n`, 'cyan');
        return false;
    }
    log('✅ api/odds.js removed (good)', 'green');

    // Check if index.js exists
    if (!fs.existsSync(oddsIndexPath)) {
        log('❌ Refactor Failed: api/odds/index.js missing', 'red');
        log('💡 This file should handle /api/odds endpoint', 'yellow');
        log(`   Run: mv api/odds.js api/odds/index.js\n`, 'cyan');
        return false;
    }
    log('✅ api/odds/index.js exists', 'green');

    // Check if live.js exists
    if (!fs.existsSync(oddsLivePath)) {
        log('❌ api/odds/live.js missing', 'red');
        log('💡 This file should handle /api/odds/live endpoint\n', 'yellow');
        return false;
    }
    log('✅ api/odds/live.js exists', 'green');

    log('\n📁 Final Structure:', 'cyan');
    log('  /api', 'cyan');
    log('    ├── matches.js', 'cyan');
    log('    └── odds/', 'cyan');
    log('         ├── index.js  ← handles /api/odds', 'green');
    log('         └── live.js   ← handles /api/odds/live', 'green');
    log('');

    return true;
}

async function testEndpoint(port, endpoint) {
    const url = `http://localhost:${port}${endpoint}`;

    try {
        const response = await fetch(url);
        return { port, response, error: null };
    } catch (error) {
        return { port, response: null, error };
    }
}

async function findWorkingPort() {
    const results = await Promise.all(PORTS.map(p => testEndpoint(p, '/api/odds/live?fixture=' + TEST_FIXTURE)));
    return results.find(r => r.response && r.response.status === 200);
}

async function testLiveEndpoint() {
    log('\n🔍 STEP 2: ENDPOINT ACCESSIBILITY TEST', 'bold');
    log('========================================\n', 'cyan');

    log('🔍 Scanning for active server...', 'cyan');
    const result = await findWorkingPort();

    if (!result) {
        log('❌ No server responding on any port', 'red');
        log('\n💡 Start the server:', 'yellow');
        log('   vercel dev\n', 'cyan');
        return false;
    }

    const { port, response } = result;
    const url = `http://localhost:${port}/api/odds/live?fixture=${TEST_FIXTURE}`;

    log(`✅ Server found on port ${port}\n`, 'green');
    log(`📡 Testing: ${url}`, 'cyan');
    log(`📊 Status: ${response.status} ${response.statusText}`, response.status === 200 ? 'green' : 'red');

    const contentType = response.headers.get('content-type');
    log(`📋 Content-Type: ${contentType}`, contentType?.includes('json') ? 'green' : 'red');

    // Get response text
    const text = await response.text();

    // Check if HTML (404)
    if (text.trim().startsWith('<') || text.trim().startsWith('<!')) {
        log('\n❌ FAILED: Received HTML instead of JSON', 'red');
        log('📄 Response Preview:', 'yellow');
        log(text.substring(0, 200) + '...\n');
        log('🔍 DIAGNOSIS:', 'yellow');
        log('  • Route /api/odds/live is NOT accessible', 'red');
        log('  • File structure may be incorrect', 'red');
        log('  • Server may need restart\n', 'red');
        log('💡 SOLUTION:', 'yellow');
        log('  1. Verify api/odds/index.js exists', 'cyan');
        log('  2. Verify api/odds/live.js exists', 'cyan');
        log('  3. Restart server: Ctrl+C then "vercel dev"', 'cyan');
        log('  4. Run this script again\n', 'cyan');
        return false;
    }

    // Parse JSON
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        log('\n❌ FAILED: Invalid JSON', 'red');
        log('📄 Raw Response:', 'yellow');
        log(text + '\n');
        return false;
    }

    log('\n✅ SUCCESS: Valid JSON received\n', 'green');
    log('📦 Response Preview:', 'cyan');
    console.log(JSON.stringify(data, null, 2));
    console.log();

    // Validate structure
    if (data.fixtureId && data.odds) {
        log('✅ Response structure: Valid', 'green');
        log(`📍 Fixture ID: ${data.fixtureId}`, 'green');
        log(`📊 Odds: ${data.odds.home} / ${data.odds.draw} / ${data.odds.away}`, 'green');
        log(`🔖 Source: ${data.source || 'Unknown'}`, data.source === 'SIMULATION' ? 'yellow' : 'green');
    } else {
        log('⚠️  Response structure unexpected', 'yellow');
    }

    return true;
}

async function runDiagnostics() {
    log('\n🧪 API STRUCTURE DIAGNOSTIC', 'bold');
    log('============================\n', 'cyan');

    const structureOk = await checkFileStructure();
    if (!structureOk) {
        log('\n❌ DIAGNOSTIC FAILED: Fix file structure first\n', 'red');
        process.exit(1);
    }

    const endpointOk = await testLiveEndpoint();
    if (!endpointOk) {
        log('\n❌ DIAGNOSTIC FAILED: Endpoint not accessible\n', 'red');
        process.exit(1);
    }

    log('\n✅ ALL DIAGNOSTICS PASSED', 'green');
    log('============================\n', 'green');

    log('Summary:', 'bold');
    log('  • File structure: Correct', 'green');
    log('  • /api/odds endpoint: Preserved', 'green');
    log('  • /api/odds/live endpoint: Accessible', 'green');
    log('  • Response: Valid JSON', 'green');
    log('\n🎉 Refactor successful!\n', 'green');

    process.exit(0);
}

runDiagnostics();
