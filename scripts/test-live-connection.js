#!/usr/bin/env node

/**
 * TRUTH SERUM TEST
 * Tests the /api/odds/live endpoint to diagnose connection issues
 */

const BACKEND_URL = 'http://localhost:3001'; // Vercel dev port
const TEST_FIXTURE = '1379206'; // Use a real live fixture ID

console.log('\n🔬 LIVE ODDS CONNECTION TEST');
console.log('================================\n');

async function testConnection() {
    const endpoint = `${BACKEND_URL}/api/odds-live?fixture=${TEST_FIXTURE}`;

    console.log(`📡 Testing: ${endpoint}`);
    console.log(`⏳ Fetching...\n`);

    try {
        const response = await fetch(endpoint);

        console.log(`📊 Status: ${response.status} ${response.statusText}`);
        console.log(`📋 Content-Type: ${response.headers.get('content-type')}\n`);

        // Get raw text first
        const text = await response.text();

        // Check if it's HTML (404 page)
        if (text.trim().startsWith('<')) {
            console.log('❌ FAILED: Received HTML instead of JSON');
            console.log('📄 Raw Response (first 500 chars):\n');
            console.log(text.substring(0, 500));
            console.log('\n...\n');
            console.log('\n🔍 DIAGNOSIS: Backend route not found or not registered');
            console.log('💡 SOLUTION: Restart Vercel dev server to register new routes\n');
            process.exit(1);
        }

        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.log('❌ FAILED: Invalid JSON response');
            console.log('📄 Raw Response:\n');
            console.log(text);
            process.exit(1);
        }

        // Success!
        console.log('✅ SUCCESS: Valid JSON response received\n');
        console.log('📦 Response Data:');
        console.log(JSON.stringify(data, null, 2));
        console.log('\n');

        // Validate structure
        if (data.fixtureId && data.odds) {
            console.log('✅ Structure: Valid');
            console.log(`📍 Fixture ID: ${data.fixtureId}`);
            console.log(`📊 Odds: ${data.odds.home} / ${data.odds.draw} / ${data.odds.away}`);
            console.log(`🔖 Source: ${data.source || 'Unknown'}\n`);

            console.log('🎉 LIVE ODDS ENDPOINT IS OPERATIONAL!\n');
            process.exit(0);
        } else {
            console.log('⚠️  WARNING: Response structure unexpected');
            console.log('Expected: { fixtureId, isLive, odds: {home, draw, away} }\n');
            process.exit(1);
        }

    } catch (error) {
        console.log('❌ CONNECTION FAILED\n');

        if (error.code === 'ECONNREFUSED') {
            console.log('🔴 Error: Connection refused');
            console.log(`💡 Is Vercel dev running on port 3001?`);
            console.log(`   Run: vercel dev\n`);
        } else {
            console.log(`🔴 Error: ${error.message}`);
            console.log(`\nStack:\n${error.stack}\n`);
        }

        process.exit(1);
    }
}

testConnection();
