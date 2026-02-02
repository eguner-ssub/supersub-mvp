#!/usr/bin/env node

/**
 * END-TO-END VERIFICATION: Flat API Structure
 * 
 * Verifies the flattened API structure is working correctly
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

const BACKEND_PORT = 3000;
const TEST_FIXTURE = '123456';

async function verifyFlatStructure() {
    log('\n🧪 FLAT API STRUCTURE VERIFICATION', 'bold');
    log('====================================\n', 'cyan');

    const url = `http://localhost:${BACKEND_PORT}/api/live-odds?fixture=${TEST_FIXTURE}`;

    log(`📡 Testing: ${url}`, 'cyan');
    log(`⏳ Fetching...\n`);

    try {
        const response = await fetch(url);

        log(`📊 Status: ${response.status} ${response.statusText}`, response.status === 200 ? 'green' : 'red');

        const contentType = response.headers.get('content-type');
        log(`📋 Content-Type: ${contentType}`, contentType?.includes('json') ? 'green' : 'red');

        if (response.status !== 200) {
            log('\n❌ FAILED: Expected status 200', 'red');
            const text = await response.text();
            log('📄 Response:', 'yellow');
            log(text.substring(0, 300) + '\n');
            process.exit(1);
        }

        if (!contentType?.includes('json')) {
            log('\n❌ FAILED: Expected JSON response', 'red');
            const text = await response.text();
            log('📄 Response:', 'yellow');
            log(text.substring(0, 300) + '\n');
            process.exit(1);
        }

        const data = await response.json();

        log('\n✅ SUCCESS: Valid JSON received\n', 'green');
        log('📦 Response:', 'cyan');
        console.log(JSON.stringify(data, null, 2));
        console.log();

        // Validate structure
        if (!data.odds || typeof data.odds !== 'object') {
            log('❌ FAILED: Missing odds object', 'red');
            process.exit(1);
        }

        if (!('home' in data.odds) || !('draw' in data.odds) || !('away' in data.odds)) {
            log('❌ FAILED: Missing odds values (home/draw/away)', 'red');
            process.exit(1);
        }

        log('✅ FLATTENED ROUTE SUCCESS', 'green');
        log('====================================\n', 'green');

        log('Verification Summary:', 'bold');
        log(`  • Endpoint: /api/live-odds`, 'green');
        log(`  • Status: 200 OK`, 'green');
        log(`  • Content-Type: application/json`, 'green');
        log(`  • Structure: Valid`, 'green');
        log(`  • Odds: ${data.odds.home} / ${data.odds.draw} / ${data.odds.away}`, 'green');
        log(`  • Source: ${data.source || 'Unknown'}`, data.source === 'SIMULATION' ? 'yellow' : 'green');
        log('');

        process.exit(0);

    } catch (error) {
        log('\n❌ VERIFICATION FAILED', 'red');
        log('====================================\n', 'red');

        if (error.code === 'ECONNREFUSED') {
            log('Connection refused. Is the backend server running?', 'yellow');
            log('\n💡 Start the server:', 'yellow');
            log('   vercel dev\n', 'cyan');
        } else {
            log(`Error: ${error.message}`, 'red');
            log(`\nStack:\n${error.stack}\n`);
        }

        process.exit(1);
    }
}

verifyFlatStructure();
