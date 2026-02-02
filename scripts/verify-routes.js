#!/usr/bin/env node

/**
 * TRUTH SERUM SCRIPT: API Route Verification
 * 
 * Verifies all API routes are accessible and not blocked by file system shadowing
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
const TEST_FIXTURE = '123';

async function testRoute(name, url, expectedStatus = 200) {
    try {
        const response = await fetch(url);
        const success = response.status === expectedStatus;

        return {
            name,
            url,
            status: response.status,
            success,
            contentType: response.headers.get('content-type')
        };
    } catch (error) {
        return {
            name,
            url,
            status: 'ERROR',
            success: false,
            error: error.message
        };
    }
}

async function runVerification() {
    log('\n🧪 TRUTH SERUM: API ROUTE VERIFICATION', 'bold');
    log('==========================================\n', 'cyan');

    const tests = [
        {
            name: 'Matches API',
            url: `http://localhost:${BACKEND_PORT}/api/matches`,
            description: 'Base matches endpoint'
        },
        {
            name: 'Odds Index',
            url: `http://localhost:${BACKEND_PORT}/api/odds?fixture=${TEST_FIXTURE}&bookmaker=6`,
            description: 'Pre-match odds (directory index)'
        },
        {
            name: 'Live Odds',
            url: `http://localhost:${BACKEND_PORT}/api/odds/live?fixture=${TEST_FIXTURE}`,
            description: 'Live odds (nested route)'
        }
    ];

    log('Running checks...\n', 'cyan');

    const results = [];
    for (const test of tests) {
        log(`📡 Check ${results.length + 1}: ${test.name}`, 'cyan');
        log(`   ${test.url}`, 'cyan');

        const result = await testRoute(test.name, test.url);
        results.push({ ...result, description: test.description });

        if (result.success) {
            log(`   ✅ Status: ${result.status} OK`, 'green');
            log(`   📋 Content-Type: ${result.contentType}\n`, 'green');
        } else {
            log(`   ❌ Status: ${result.status}`, 'red');
            if (result.error) {
                log(`   Error: ${result.error}\n`, 'red');
            } else {
                log(`   Content-Type: ${result.contentType}\n`, 'yellow');
            }
        }
    }

    // Summary
    log('\n==========================================', 'cyan');
    log('VERIFICATION SUMMARY', 'bold');
    log('==========================================\n', 'cyan');

    const allPassed = results.every(r => r.success);

    results.forEach((result, index) => {
        const icon = result.success ? '✅' : '❌';
        const color = result.success ? 'green' : 'red';
        log(`${icon} Check ${index + 1}: ${result.name} - ${result.status}`, color);
    });

    log('');

    // Specific diagnostics
    const liveOddsResult = results.find(r => r.name === 'Live Odds');

    if (!liveOddsResult.success) {
        log('🔍 DIAGNOSIS: Live Odds Route Failed', 'yellow');
        log('==========================================\n', 'yellow');

        if (liveOddsResult.status === 404) {
            log('❌ ROUTING CONFLICT DETECTED', 'red');
            log('   Possible causes:', 'yellow');
            log('   • api/odds.js might still exist (blocks directory)', 'red');
            log('   • api/odds-live.js might be interfering', 'red');
            log('   • Server needs restart to clear router cache\n', 'red');

            log('💡 SOLUTION:', 'yellow');
            log('   1. Verify file structure:', 'cyan');
            log('      ls -la api/odds/', 'cyan');
            log('   2. Delete conflicting files:', 'cyan');
            log('      rm -f api/odds.js api/odds-live.js api/live-odds.js', 'cyan');
            log('   3. Restart server:', 'cyan');
            log('      Ctrl+C then run: vercel dev', 'cyan');
            log('   4. Run this script again\n', 'cyan');
        } else if (liveOddsResult.status === 'ERROR') {
            log('❌ SERVER NOT RUNNING', 'red');
            log('💡 Start the server:', 'yellow');
            log('   vercel dev\n', 'cyan');
        }
    } else {
        log('✅ LIVE ROUTE UNBLOCKED', 'green');
        log('==========================================\n', 'green');
        log('Directory-based routing is working correctly.', 'green');
        log('The /api/odds/live endpoint is accessible!\n', 'green');
    }

    // Final status
    if (allPassed) {
        log('🎉 ALL CHECKS PASSED', 'green');
        log('==========================================\n', 'green');
        process.exit(0);
    } else {
        const criticalFailed = !liveOddsResult.success;
        if (criticalFailed) {
            log('❌ CRITICAL: Live Odds route failed', 'red');
            log('==========================================\n', 'red');
            process.exit(1);
        } else {
            log('⚠️  Some checks failed but Live Odds is working', 'yellow');
            log('==========================================\n', 'yellow');
            process.exit(0);
        }
    }
}

runVerification();
