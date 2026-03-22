#!/usr/bin/env node
// scripts/sync-news-intel.js
// Usage: node scripts/sync-news-intel.js
// Cron:  every 30 minutes via api/cron/index.js?job=sync-news-intel

import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import { detectTeam } from '../lib/news/team-aliases.js';

const PREFIX = '[sync-news-intel]';

// ── Dotenv for standalone CLI runs ───────────────────────────────────────────
const isMain = process.argv[1]?.endsWith('sync-news-intel.js');
if (isMain) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
}

// ── Config ───────────────────────────────────────────────────────────────────
const EPL_LEAGUE_ID = 8; // Sportmonks ID for Premier League

const FEEDS = [
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',  source: 'BBC' },
  { url: 'https://www.skysports.com/rss/12040',               source: 'Sky Sports' },
  { url: 'https://www.theguardian.com/football/rss',          source: 'The Guardian' },
];

const RETENTION_HOURS = 72;

// ── Supabase ─────────────────────────────────────────────────────────────────
let _client = null;

function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  _client = createClient(url, key);
  return _client;
}

// ── Fetch & parse one RSS feed ────────────────────────────────────────────────
async function fetchFeed(feed) {
  const parser = new Parser({ timeout: 10000 });
  try {
    const result = await parser.parseURL(feed.url);
    return (result.items || []).map(item => ({
      title:       item.title?.trim()   || null,
      summary:     item.contentSnippet?.trim() || item.summary?.trim() || null,
      url:         item.link?.trim()    || null,
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      source:      feed.source,
    })).filter(item => item.url && item.title);
  } catch (err) {
    console.error(`${PREFIX} ✗ Failed to fetch ${feed.source}: ${err.message}`);
    return [];
  }
}

// ── Build team name → team_id lookup from DB ─────────────────────────────────
async function buildTeamLookup(supabase) {
  // Load all teams — alias map ensures only EPL teams get matched anyway
  const { data, error } = await supabase
    .from('teams')
    .select('id, name');

  if (error) {
    console.warn(`${PREFIX} ⚠ Could not load teams: ${error.message}`);
    return new Map();
  }

  // Map canonical name → id (case-insensitive key)
  return new Map((data || []).map(t => [t.name.toLowerCase(), t.id]));
}

// ── Prune expired articles ────────────────────────────────────────────────────
async function pruneExpired(supabase) {
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  // 1. Delete articles older than 72 hours
  const { count: byAge } = await supabase
    .from('news_intel')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  // 2. Delete articles whose tagged match has already kicked off
  //    (join via team_id → find past matches for that team)
  const { data: pastTeams } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .lt('kickoff_time', new Date().toISOString())
    .gt('kickoff_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // last 24h only

  const kickedOffTeamIds = new Set();
  for (const m of pastTeams || []) {
    if (m.home_team_id) kickedOffTeamIds.add(m.home_team_id);
    if (m.away_team_id) kickedOffTeamIds.add(m.away_team_id);
  }

  let byKickoff = 0;
  if (kickedOffTeamIds.size > 0) {
    const { count } = await supabase
      .from('news_intel')
      .delete({ count: 'exact' })
      .in('team_id', [...kickedOffTeamIds]);
    byKickoff = count || 0;
  }

  return { byAge: byAge || 0, byKickoff };
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function syncNewsIntel() {
  const supabase = getSupabase();

  console.log(`${PREFIX} Building team lookup …`);
  const teamLookup = await buildTeamLookup(supabase);
  console.log(`${PREFIX} ${teamLookup.size} EPL teams loaded`);

  // Fetch all feeds in parallel
  console.log(`${PREFIX} Fetching ${FEEDS.length} RSS feeds …`);
  const feedResults = await Promise.all(FEEDS.map(fetchFeed));
  const allItems = feedResults.flat();
  console.log(`${PREFIX} ${allItems.length} raw articles fetched`);

  // Filter to EPL-tagged articles only
  const tagged = [];
  for (const item of allItems) {
    const searchText = [item.title, item.summary].filter(Boolean).join(' ');
    const canonicalName = detectTeam(searchText);
    if (!canonicalName) continue;

    const teamId = teamLookup.get(canonicalName.toLowerCase()) || null;
    tagged.push({
      ...item,
      team_id:   teamId,
      league_id: EPL_LEAGUE_ID,
    });
  }
  console.log(`${PREFIX} ${tagged.length} articles matched EPL teams`);

  // Upsert — ON CONFLICT (url) DO NOTHING
  let inserted = 0;
  if (tagged.length > 0) {
    const { error, count } = await supabase
      .from('news_intel')
      .upsert(tagged, { onConflict: 'url', ignoreDuplicates: true, count: 'exact' });

    if (error) {
      console.error(`${PREFIX} ✗ Upsert failed: ${error.message}`);
    } else {
      inserted = count || 0;
    }
  }

  // Prune expired
  const pruned = await pruneExpired(supabase);

  console.log(`${PREFIX} ─── Summary ───────────────────────────`);
  console.log(`${PREFIX}   Articles fetched  : ${allItems.length}`);
  console.log(`${PREFIX}   EPL-tagged        : ${tagged.length}`);
  console.log(`${PREFIX}   New inserts       : ${inserted}`);
  console.log(`${PREFIX}   Pruned (age)      : ${pruned.byAge}`);
  console.log(`${PREFIX}   Pruned (kickoff)  : ${pruned.byKickoff}`);
  console.log(`${PREFIX} ────────────────────────────────────────`);

  return { fetched: allItems.length, tagged: tagged.length, inserted, pruned };
}

// ── Standalone run ────────────────────────────────────────────────────────────
if (isMain) {
  syncNewsIntel().catch(err => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });
}
