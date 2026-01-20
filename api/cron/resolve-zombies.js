/**
 * Zombie Bet Resolver - Serverless Cron Job
 * 
 * This function automatically settles "zombie" bets that are stuck in OPEN status
 * after their matches have finished. It respects API quota limits and handles errors gracefully.
 * 
 * Security: Requires Authorization header with CRON_SECRET
 * Quota Safety: Processes max 5 fixtures per run to avoid exhausting API limits
 * 
 * @module api/cron/resolve-zombies
 */

import { createClient } from '@supabase/supabase-js';
import { calculateBetResult, isMatchFinished, shouldVoidMatch } from '../../src/utils/settlementEngine.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_FIXTURES_PER_RUN = 5; // Strict quota limit
const ZOMBIE_THRESHOLD_HOURS = 4; // Bets older than this are considered zombies

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req, res) {
    const startTime = Date.now();

    console.log('🧹 [Zombie Resolver] Starting cron job...');

    // ============================================================================
    // SECURITY: Authorization Check
    // ============================================================================

    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!authHeader || authHeader !== expectedAuth) {
        console.error('❌ [Zombie Resolver] Unauthorized access attempt');
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or missing authorization token'
        });
    }

    // ============================================================================
    // INITIALIZE SUPABASE CLIENT
    // ============================================================================

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ [Zombie Resolver] Missing Supabase credentials');
        return res.status(500).json({
            success: false,
            error: 'Configuration Error',
            message: 'Supabase credentials not configured'
        });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============================================================================
    // STEP 1: FETCH ZOMBIE BETS
    // ============================================================================

    let zombieBets = [];

    try {
        const zombieThreshold = new Date();
        zombieThreshold.setHours(zombieThreshold.getHours() - ZOMBIE_THRESHOLD_HOURS);

        const { data, error } = await supabase
            .from('predictions')
            .select('*')
            .eq('status', 'OPEN')
            .lt('fixture_date', zombieThreshold.toISOString())
            .order('fixture_date', { ascending: true })
            .limit(100); // Fetch up to 100 zombies

        if (error) {
            console.error('❌ [Zombie Resolver] Error fetching zombie bets:', error);
            return res.status(500).json({
                success: false,
                error: 'Database Error',
                message: 'Failed to fetch zombie bets',
                details: error.message
            });
        }

        zombieBets = data || [];
        console.log(`📊 [Zombie Resolver] Found ${zombieBets.length} zombie bets`);

    } catch (error) {
        console.error('❌ [Zombie Resolver] Exception fetching zombies:', error);
        return res.status(500).json({
            success: false,
            error: 'Unexpected Error',
            message: error.message
        });
    }

    if (zombieBets.length === 0) {
        console.log('✅ [Zombie Resolver] No zombie bets found. Exiting.');
        return res.status(200).json({
            success: true,
            processed_fixtures: 0,
            settled_bets: 0,
            skipped_fixtures: 0,
            duration_ms: Date.now() - startTime
        });
    }

    // ============================================================================
    // STEP 2: GROUP BY FIXTURE ID
    // ============================================================================

    const fixtureGroups = {};

    for (const bet of zombieBets) {
        const fixtureId = bet.match_id;
        if (!fixtureGroups[fixtureId]) {
            fixtureGroups[fixtureId] = [];
        }
        fixtureGroups[fixtureId].push(bet);
    }

    const fixtureIds = Object.keys(fixtureGroups);
    const totalFixtures = fixtureIds.length;
    const fixturesToProcess = fixtureIds.slice(0, MAX_FIXTURES_PER_RUN);
    const skippedFixtures = totalFixtures - fixturesToProcess.length;

    console.log(`🎯 [Zombie Resolver] Processing ${fixturesToProcess.length}/${totalFixtures} fixtures (quota limit: ${MAX_FIXTURES_PER_RUN})`);

    // ============================================================================
    // STEP 3: PROCESS EACH FIXTURE
    // ============================================================================

    let processedFixtures = 0;
    let settledBets = 0;
    const errors = [];

    for (const fixtureId of fixturesToProcess) {
        try {
            console.log(`\n🔍 [Zombie Resolver] Processing fixture ${fixtureId}...`);

            // Fetch match data from API-Football
            const apiKey = process.env.VITE_API_FOOTBALL_KEY;
            const matchResponse = await fetch(
                `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
                {
                    headers: {
                        'x-apisports-key': apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!matchResponse.ok) {
                console.error(`❌ [Zombie Resolver] API request failed for fixture ${fixtureId}: ${matchResponse.status}`);
                errors.push({
                    fixtureId,
                    error: `API request failed: ${matchResponse.status}`
                });
                continue; // Skip to next fixture
            }

            const matchData = await matchResponse.json();
            const fixture = matchData.response?.[0];

            if (!fixture) {
                console.error(`❌ [Zombie Resolver] No data found for fixture ${fixtureId}`);
                errors.push({
                    fixtureId,
                    error: 'No match data found'
                });
                continue;
            }

            const matchStatus = fixture.fixture?.status?.short;
            const betsForFixture = fixtureGroups[fixtureId];

            console.log(`📍 [Zombie Resolver] Fixture ${fixtureId} status: ${matchStatus}, ${betsForFixture.length} bets`);

            // ============================================================================
            // CASE 1: Match Finished (FT, AET, PEN)
            // ============================================================================

            if (isMatchFinished(matchStatus)) {
                console.log(`✅ [Zombie Resolver] Match finished. Settling ${betsForFixture.length} bets...`);

                for (const bet of betsForFixture) {
                    try {
                        const result = calculateBetResult(
                            bet.bet_type || 'MATCH_RESULT',
                            bet.selection,
                            fixture.goals?.home || 0,
                            fixture.goals?.away || 0,
                            matchStatus
                        );

                        console.log(`  💰 Bet ${bet.id}: ${result.status} (${result.reason})`);

                        if (result.status === 'WON' || result.status === 'VOID') {
                            // Use RPC for atomic balance update
                            const { data: rpcData, error: rpcError } = await supabase.rpc('settle_prediction', {
                                p_prediction_id: bet.id,
                                p_new_status: result.status
                            });

                            if (rpcError) {
                                console.error(`  ❌ RPC error for bet ${bet.id}:`, rpcError.message);
                                errors.push({
                                    fixtureId,
                                    betId: bet.id,
                                    error: `RPC failed: ${rpcError.message}`
                                });
                            } else {
                                console.log(`  ✅ Bet ${bet.id} settled: ${result.status}`);
                                settledBets++;
                            }
                        } else {
                            // LOST - Simple status update (no balance change)
                            const { error: updateError } = await supabase
                                .from('predictions')
                                .update({
                                    status: 'LOST',
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', bet.id);

                            if (updateError) {
                                console.error(`  ❌ Update error for bet ${bet.id}:`, updateError.message);
                                errors.push({
                                    fixtureId,
                                    betId: bet.id,
                                    error: `Update failed: ${updateError.message}`
                                });
                            } else {
                                console.log(`  ✅ Bet ${bet.id} settled: LOST`);
                                settledBets++;
                            }
                        }
                    } catch (betError) {
                        console.error(`  ❌ Error processing bet ${bet.id}:`, betError.message);
                        errors.push({
                            fixtureId,
                            betId: bet.id,
                            error: betError.message
                        });
                    }
                }

                processedFixtures++;
            }

            // ============================================================================
            // CASE 2: Match Voided (PST, CANC, ABD, etc.)
            // ============================================================================

            else if (shouldVoidMatch(matchStatus)) {
                console.log(`⚠️ [Zombie Resolver] Match voided (${matchStatus}). Refunding ${betsForFixture.length} bets...`);

                for (const bet of betsForFixture) {
                    try {
                        const { data: rpcData, error: rpcError } = await supabase.rpc('settle_prediction', {
                            p_prediction_id: bet.id,
                            p_new_status: 'VOID'
                        });

                        if (rpcError) {
                            console.error(`  ❌ RPC error for bet ${bet.id}:`, rpcError.message);
                            errors.push({
                                fixtureId,
                                betId: bet.id,
                                error: `RPC failed: ${rpcError.message}`
                            });
                        } else {
                            console.log(`  ✅ Bet ${bet.id} voided and refunded`);
                            settledBets++;
                        }
                    } catch (betError) {
                        console.error(`  ❌ Error voiding bet ${bet.id}:`, betError.message);
                        errors.push({
                            fixtureId,
                            betId: bet.id,
                            error: betError.message
                        });
                    }
                }

                processedFixtures++;
            }

            // ============================================================================
            // CASE 3: Match Not Yet Finished (NS, LIVE, HT, etc.)
            // ============================================================================

            else {
                console.log(`⏳ [Zombie Resolver] Match not finished yet (${matchStatus}). Skipping.`);
                // Don't count as processed - will be picked up in next run
            }

        } catch (fixtureError) {
            console.error(`❌ [Zombie Resolver] Error processing fixture ${fixtureId}:`, fixtureError.message);
            errors.push({
                fixtureId,
                error: fixtureError.message
            });
            // Continue to next fixture
        }
    }

    // ============================================================================
    // FINAL RESPONSE
    // ============================================================================

    const duration = Date.now() - startTime;

    console.log(`\n🎉 [Zombie Resolver] Job complete!`);
    console.log(`  ✅ Processed fixtures: ${processedFixtures}`);
    console.log(`  💰 Settled bets: ${settledBets}`);
    console.log(`  ⏭️  Skipped fixtures: ${skippedFixtures}`);
    console.log(`  ⏱️  Duration: ${duration}ms`);
    console.log(`  ❌ Errors: ${errors.length}`);

    return res.status(200).json({
        success: true,
        processed_fixtures: processedFixtures,
        settled_bets: settledBets,
        skipped_fixtures: skippedFixtures,
        total_zombies_found: zombieBets.length,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: duration,
        timestamp: new Date().toISOString()
    });
}
