import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

// Captured once when the module loads — filters out wins settled before this session.
const SESSION_START = new Date().toISOString();

/**
 * Compute live energy from stored profile data.
 * Regen rate: 1 unit per 4 hours, capped at max_energy.
 * Pure calculation — never writes to the DB.
 *
 * energy_last_updated_at in state is always the timestamp when energy was
 * last written (load, spend, or gain), so the elapsed calculation is correct
 * whether the value came from the DB or a prior local action.
 */
function computeCurrentEnergy(profile) {
  const maxEnergy = profile.max_energy || 5;
  const stored    = profile.energy ?? 0;
  const lastTs    = profile.energy_last_updated_at;
  if (!lastTs) return Math.min(stored, maxEnergy);
  const elapsedMs   = Date.now() - new Date(lastTs).getTime();
  const regenUnits  = Math.floor(elapsedMs / (4 * 60 * 60 * 1000));
  return Math.min(maxEnergy, stored + regenUnits);
}

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function todayUTC() {
  return new Date().toISOString().split('T')[0];
}
function yesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Returns the streak tier (0–3) for a given streak count.
 * Exported so components can derive training-bag size and UI tier badge.
 *   Tier 0: no active streak (0 days)
 *   Tier 1: days 1–3  (training bag 2 cards + 1 bonus)
 *   Tier 2: days 4–6  (training bag 3 cards + 2 bonus; drinks on days 3 & 5)
 *   Tier 3: days 7+   (training bag 3 cards + 3 bonus; drink on day 7)
 */
export function streakTier(streak) {
  if (streak >= 7) return 3;
  if (streak >= 4) return 2;
  if (streak >= 1) return 1;
  return 0;
}

/**
 * Compute streak decay for a given profile snapshot.
 * Decay applies when last_streak_date is more than one day old (gap > 1 day).
 *
 * Decay rules:
 *   current_streak ≥ 7  → drops to 4  (top of tier 2)
 *   current_streak 4–6  → drops to 1  (top of tier 1)
 *   current_streak 1–3  → drops to 0
 *
 * After decay, last_streak_date is set to yesterday so that:
 *   • The next loadProfile call sees "yesterday" and doesn't re-decay
 *     within the same absent-day window.
 *   • incrementStreak() sees "yesterday" and can fire if the user trains today.
 *
 * Returns null if no decay is needed, or { current_streak, last_streak_date }
 * ready to spread into state and write to the DB.
 */
function computeStreakDecay(profile) {
  const lastDate  = profile.last_streak_date; // 'YYYY-MM-DD' or null
  const streak    = profile.current_streak ?? 0;
  const yesterday = yesterdayUTC();

  // No decay: never trained, trained yesterday, or trained today
  if (!lastDate || lastDate >= yesterday) return null;

  // Gap > 1 day → apply tier-boundary decay
  let decayedStreak;
  if (streak >= 7)      decayedStreak = 4;
  else if (streak >= 4) decayedStreak = 1;
  else                  decayedStreak = 0;

  return { current_streak: decayedStreak, last_streak_date: yesterday };
}

// Streak milestones that grant 1 energy drink
const STREAK_DRINK_MILESTONES = new Set([3, 5, 7]);

/**
 * Returns the card reward for a training session score (0–10).
 * Pure helper — no side effects.
 */
function trainingRewardForScore(score) {
  if (score === 10) return { common: 5, supersub: true,  drink: true  };
  if (score === 9)  return { common: 4, supersub: false, drink: false };
  if (score >= 7)   return { common: 3, supersub: false, drink: false };
  if (score >= 5)   return { common: 2, supersub: false, drink: false };
  return              { common: 1, supersub: false, drink: false };
}

// Common card types that expire on Monday 23:59 UTC.
// c_supersub never expires (null).
const COMMON_CARD_TYPES = new Set(['c_match_result', 'c_total_goals', 'c_player_score']);

/**
 * Returns the ISO timestamp of the next (or current) Monday at 23:59:00 UTC.
 * Rules:
 *   - If today IS Monday and the current UTC time is before 23:59 → return today at 23:59.
 *   - Otherwise → return the coming Monday at 23:59.
 *
 * Exported so it can be tested in isolation.
 */
export function nextMondayExpiry() {
  const now  = new Date();
  const day  = now.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const h    = now.getUTCHours();
  const m    = now.getUTCMinutes();

  let daysUntil;
  if (day === 1 && (h < 23 || (h === 23 && m < 59))) {
    daysUntil = 0; // It's Monday and still before the cutoff — use today
  } else if (day === 0) {
    daysUntil = 1; // Sunday → tomorrow (Monday)
  } else {
    // Mon after 23:59 → 7 days; Tue=6, Wed=5, Thu=4, Fri=3, Sat=2
    daysUntil = 8 - day;
  }

  return new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntil,
    23, 59, 0, 0,
  )).toISOString();
}

export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statDictionary, setStatDictionary] = useState(null);
  // Settled predictions the user hasn't seen yet — drives WinCelebrationModal on Dashboard
  const [unseenSettlements, setUnseenSettlements] = useState([]);
  const activeRequestId = useRef(0);
  const realtimeChannelRef = useRef(null);

  const loadProfile = async (session) => {
    if (!session?.user) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    const myRequestId = activeRequestId.current + 1;
    activeRequestId.current = myRequestId;

    try {
      setLoading(true);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (activeRequestId.current !== myRequestId) return;
      if (profileError) throw profileError;

      const { data: invData, error: invError } = await supabase
        .from('inventory')
        .select('card_id, count, expires_at')
        .eq('user_id', session.user.id)
        // Exclude rows that have already expired; null = never expires (Supersub).
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      if (invError) throw invError;

      const inventoryMap = {};
      const expiryMap = {};
      invData?.forEach(row => {
        inventoryMap[row.card_id] = row.count;
        if (row.expires_at) expiryMap[row.card_id] = row.expires_at;
      });

      // Apply regen formula on read — no DB write.
      // Also reset energy_last_updated_at in state to now() so subsequent
      // computeCurrentEnergy calls in spendEnergy/gainEnergy don't double-count.
      const computedEnergy = computeCurrentEnergy(profile);
      const loadedAt = new Date().toISOString();

      // Compute streak decay (pure, no DB side-effect here).
      // If the user has energy drinks, intercept the decay and hold it as pendingDecay
      // so Dashboard can offer a "spend 1 drink to save your streak" prompt first.
      const streakDecay = computeStreakDecay(profile);
      const hasDrinks   = (profile.energy_drinks ?? 0) > 0;
      const pendingDecay = streakDecay && hasDrinks
        ? { fromStreak: profile.current_streak ?? 0, toStreak: streakDecay.current_streak, decayFields: streakDecay }
        : null;
      const decayedFields = (!pendingDecay && streakDecay) ? streakDecay : {};

      // Daily-reset training sessions in local state: if last_training_date is not today,
      // treat sessions_today as 0 so the cap check is accurate immediately on load.
      // The DB write is deferred until startTrainingSession() is called.
      const today = todayUTC();
      const effectiveSessions = profile.last_training_date === today
        ? (profile.training_sessions_today ?? 0)
        : 0;

      setUserProfile({
        ...profile,
        inventoryMap,
        expiryMap,
        energy: computedEnergy,
        energy_last_updated_at: loadedAt,
        ...decayedFields, // overlays streak fields only when decay occurred (not intercepted)
        training_sessions_today: effectiveSessions,
        pendingDecay, // non-null when decay was intercepted; cleared by save/decline
      });

      // Fire-and-forget decay DB write only if we're applying decay immediately.
      if (streakDecay && !pendingDecay) {
        supabase.from('profiles').update(streakDecay).eq('id', session.user.id);
      }

      // Check for unseen settled predictions (drives WinCelebrationModal on Dashboard).
      // Gracefully no-ops if migration 034 hasn't been applied yet (column missing → error → []).
      const { data: unseen, error: unseenError } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('seen_by_user', false)
        .eq('status', 'SETTLED')
        .gte('settled_at', SESSION_START)
        .order('created_at', { ascending: false })
        .limit(5);

      if (activeRequestId.current !== myRequestId) return;
      setUnseenSettlements(unseenError ? [] : (unseen ?? []));

    } catch (error) {
      if (activeRequestId.current !== myRequestId) return;
      console.error('🔥 CONNECTION FAILURE:', error.message);
    } finally {
      if (activeRequestId.current === myRequestId) setLoading(false);
    }
  };

  const consumeCard = async (cardId) => {
    if (!userProfile) return false;
    const currentCount = userProfile.inventoryMap?.[cardId] || 0;
    if (currentCount <= 0) return false;

    const { error } = await supabase
      .from('inventory')
      .update({ count: currentCount - 1 })
      .eq('user_id', userProfile.id)
      .eq('card_id', cardId);

    if (error) {
      console.error("Card consumption failed:", error.message);
      return false;
    }

    setUserProfile(prev => ({
      ...prev,
      inventoryMap: { ...prev.inventoryMap, [cardId]: currentCount - 1 }
    }));
    return true;
  };

  /**
   * MARK PREDICTIONS SEEN
   * Called when WinCelebrationModal is dismissed.
   * Sets seen_by_user = true in the DB and removes the rows from local state
   * so the modal doesn't re-appear. Requires migration 034.
   */
  const markPredictionsSeen = async (ids) => {
    if (!ids?.length) return;
    await supabase
      .from('predictions')
      .update({ seen_by_user: true })
      .in('id', ids);
    setUnseenSettlements(prev => prev.filter(p => !ids.includes(p.id)));
  };

  const updateInventory = async (newCardIds) => {
    if (!userProfile?.id || !newCardIds.length) return;

    const additions = {};
    newCardIds.forEach(id => { additions[id] = (additions[id] || 0) + 1; });
    const newMap = { ...userProfile.inventoryMap };

    for (const [cardId, amount] of Object.entries(additions)) {
      const currentCount = newMap[cardId] || 0;

      const { error } = await supabase
        .from('inventory')
        .upsert({
          user_id:    userProfile.id,
          card_id:    cardId,
          count:      currentCount + amount,
          expires_at: COMMON_CARD_TYPES.has(cardId) ? nextMondayExpiry() : null,
        }, { onConflict: 'user_id,card_id' });

      if (!error) newMap[cardId] = currentCount + amount;
    }

    setUserProfile(prev => ({ ...prev, inventoryMap: newMap }));
  };

  /**
   * PLACE BET
   * - displayLabel: human-readable label ("Over 2.5 Goals", player name, etc.)
   * - teamId: required for Supersub cards — the integer team ID the user is backing.
   *   Pass match.teams.home.id or match.teams.away.id at the call site.
   *   Without this, the backend settlement engine will always settle Supersub as LOST.
   */
  const placeBet = async (match, selection, potentialReward, cardType, odds, displayLabel, teamId = null, oddsSnapshot = null, playerId = null) => {
    if (!userProfile) return { success: false, error: 'No user' };
    try {
      const homeTeam = match.teams?.home?.name || match.home_team || 'Home';
      const awayTeam = match.teams?.away?.name || match.away_team || 'Away';
      const matchId = match.fixture?.id || match.id;

      // Supersub requires team_id (integer) for backend settlement.
      // Derive it from match data if not explicitly passed.
      const isSupersub = String(cardType).toLowerCase().includes('supersub');

      let resolvedTeamId = teamId;
      if (!resolvedTeamId) {
        // Derive Team ID for Supersub
        if (isSupersub) {
          if (selection === 'HOME' || String(selection).toUpperCase().includes('HOME')) {
            resolvedTeamId = match.teams?.home?.id ?? match.home_team_id ?? null;
          } else if (selection === 'AWAY' || String(selection).toUpperCase().includes('AWAY')) {
            resolvedTeamId = match.teams?.away?.id ?? match.away_team_id ?? null;
          }
        }
        // Derive Team ID for Match Result
        else if (cardType === 'c_match_result') {
          if (selection === 'HOME_WIN') {
            resolvedTeamId = match.teams?.home?.id ?? match.home_team_id ?? null;
          } else if (selection === 'AWAY_WIN') {
            resolvedTeamId = match.teams?.away?.id ?? match.away_team_id ?? null;
          }
          // Note: If selection is 'DRAW', resolvedTeamId safely remains null.
        }
      }

      // Enforce: Supersub selection must be exactly 'HOME' or 'AWAY'
      let resolvedSelection = selection;
      if (isSupersub) {
        if (String(selection).toUpperCase().includes('HOME')) resolvedSelection = 'HOME';
        else if (String(selection).toUpperCase().includes('AWAY')) resolvedSelection = 'AWAY';
      }

      // Extract Player ID from Player Score selections (e.g., "SCORE_12345")
      // Also carry through player_id for player-specific supersub bets
      let resolvedPlayerId = playerId ?? null;
      if (!resolvedPlayerId && cardType === 'c_player_score' && String(resolvedSelection).startsWith('SCORE_')) {
        const parts = String(resolvedSelection).split('_');
        resolvedPlayerId = parts.length > 1 ? Number(parts[1]) : null;
      }

      const payload = {
        user_id: userProfile.id,
        match_id: matchId,
        selection: resolvedSelection,
        team_name: displayLabel,
        potential_reward: potentialReward,
        card_type: cardType,
        status: 'PENDING',
        match_title: `${homeTeam} vs ${awayTeam}`,
        odds,
        stake: 100,
        // Always include team_id in the payload.
        // Non-Supersub cards send null — backend ignores it for those card types.
        team_id: resolvedTeamId,
        player_id: resolvedPlayerId,
        league_id: match.league_id ?? null,
      };

      const { data, error } = await supabase
        .from('predictions')
        .insert([payload])
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const spendEnergy = async (amount) => {
    if (!userProfile) return;
    // Recompute from state — catches any regen that accrued since last load/action.
    const current  = computeCurrentEnergy(userProfile);
    const newEnergy = Math.max(0, current - amount);
    const now = new Date().toISOString();
    setUserProfile(prev => ({ ...prev, energy: newEnergy, energy_last_updated_at: now }));
    await supabase.from('profiles').update({ energy: newEnergy, energy_last_updated_at: now }).eq('id', userProfile.id);
  };

  /**
   * GAIN ENERGY
   * Increments the user's energy by `amount`, capped at max_energy.
   * Used by: energy drink flow (Dashboard/ViewFridge).
   * NOT used for ad rewards — see claimAdReward() below.
   */
  const gainEnergy = async (amount) => {
    if (!userProfile) return;
    const maxEnergy = userProfile.max_energy || 5;
    // Recompute from state — catches any regen that accrued since last load/action.
    const current  = computeCurrentEnergy(userProfile);
    const newEnergy = Math.min(current + amount, maxEnergy);
    const now = new Date().toISOString();
    setUserProfile(prev => ({ ...prev, energy: newEnergy, energy_last_updated_at: now }));
    await supabase.from('profiles').update({ energy: newEnergy, energy_last_updated_at: now }).eq('id', userProfile.id);
  };

  /**
   * USE ENERGY DRINK
   * Consumes one energy drink from the user's six-pack and restores 1 energy.
   * Returns { success: boolean, reason?: string } so the caller can toast on failure.
   *
   * Guards:
   *   - No drinks left  → { success: false, reason: 'No energy drinks left' }
   *   - Energy already full → { success: false, reason: 'Energy is already full' }
   */
  const useEnergyDrink = async () => {
    if (!userProfile) return { success: false, reason: 'Not logged in' };

    const drinks = userProfile.energy_drinks ?? 0;
    if (drinks <= 0) return { success: false, reason: 'No energy drinks left' };

    const currentEnergy = computeCurrentEnergy(userProfile);
    if (currentEnergy >= (userProfile.max_energy || 5)) {
      return { success: false, reason: 'Energy is already full' };
    }

    const newDrinks = drinks - 1;

    // Optimistic state update for energy_drinks; gainEnergy handles energy + its own state/DB write.
    setUserProfile(prev => prev ? { ...prev, energy_drinks: newDrinks } : prev);
    await supabase.from('profiles').update({ energy_drinks: newDrinks }).eq('id', userProfile.id);

    // Delegate the +1 energy increment and its DB write to gainEnergy.
    await gainEnergy(1);

    return { success: true };
  };

  /**
   * GRANT ENERGY DRINK
   * Increments the user's energy drink stock by `amount`, capped at 6 (one six-pack).
   * Called by streak milestones, perfect training rewards, and ad reward grants.
   * Grant TRIGGERS are implemented separately — this is the write primitive only.
   */
  const ENERGY_DRINK_CAP = 6;

  const grantEnergyDrink = async (amount) => {
    if (!userProfile) return;
    const current  = userProfile.energy_drinks ?? 0;
    const newDrinks = Math.min(current + amount, ENERGY_DRINK_CAP);
    setUserProfile(prev => prev ? { ...prev, energy_drinks: newDrinks } : prev);
    await supabase.from('profiles').update({ energy_drinks: newDrinks }).eq('id', userProfile.id);
  };

  /* ── Streak Helpers ────────────────────────────────────────────────────── */

  /**
   * Returns the streak tier and card count for a given streak value.
   *   Tier 1 (days 1–3)  → 2 cards
   *   Tier 2 (days 4–6)  → 3 cards
   *   Tier 3 (day 7+)    → 3 cards
   */
  function getStreakTier(streak) {
    if (streak >= 7) return { tier: 3, cardCount: 3 };
    if (streak >= 4) return { tier: 2, cardCount: 3 };
    return { tier: 1, cardCount: 2 };
  }

  /**
   * INCREMENT STREAK
   * Advances the user's login streak by 1 (or resets to 1 if they missed a day).
   * Guards against double-incrementing the same day via last_streak_date.
   * Milestone: grants 1 energy drink on day 7.
   */
  const incrementStreak = async () => {
    if (!userProfile) return;
    const today     = new Date().toISOString().split('T')[0];
    const lastDate  = userProfile.last_streak_date;
    if (lastDate === today) return; // already incremented today

    const yesterday  = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const newStreak  = lastDate === yesterday ? (userProfile.current_streak ?? 0) + 1 : 1;
    const newBest    = Math.max(newStreak, userProfile.best_streak ?? 0);

    // 7-day milestone: grant an energy drink + 1 Supersub card (rarity gate)
    if (newStreak === 7) {
      await grantEnergyDrink(1);
      await updateInventory(['c_supersub']);
    }

    await supabase.from('profiles').update({
      current_streak:  newStreak,
      last_streak_date: today,
      best_streak:     newBest,
    }).eq('id', userProfile.id);

    setUserProfile(prev => prev ? {
      ...prev,
      current_streak:  newStreak,
      last_streak_date: today,
      best_streak:     newBest,
    } : prev);
  };

  /**
   * CLAIM TRAINING BAG
   * Triggered once per day on first app open.
   * Guards on last_streak_date == today (already claimed / streak already incremented).
   * Grants c_match_result cards based on streak tier, with expires_at = next Monday 23:59 UTC.
   * Calls incrementStreak() which writes last_streak_date = today (preventing re-claim).
   * Returns { cardCount, cardType, tier } on success, or null if already claimed.
   */
  const claimTrainingBag = async () => {
    if (!userProfile) return null;
    const today = new Date().toISOString().split('T')[0];
    if (userProfile.last_streak_date === today) return null; // already claimed

    // Compute the new streak value (same logic as incrementStreak) to determine tier
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const newStreak = userProfile.last_streak_date === yesterday
      ? (userProfile.current_streak ?? 0) + 1
      : 1;

    const { tier, cardCount } = getStreakTier(newStreak);
    const cardType  = 'c_match_result';
    const expiresAt = nextMondayExpiry();
    const currentCount = userProfile.inventoryMap?.[cardType] ?? 0;

    // Upsert inventory with expires_at (updateInventory helper doesn't set expires_at)
    const { error: invError } = await supabase.from('inventory').upsert({
      user_id:    userProfile.id,
      card_id:    cardType,
      count:      currentCount + cardCount,
      expires_at: expiresAt,
    }, { onConflict: 'user_id,card_id' });

    if (invError) {
      console.error('claimTrainingBag: inventory upsert failed', invError.message);
      throw invError;
    }

    // Sync inventory into local state
    setUserProfile(prev => prev ? {
      ...prev,
      inventoryMap: { ...prev.inventoryMap, [cardType]: currentCount + cardCount },
    } : prev);

    // Increment streak — this also writes last_streak_date = today (claim guard)
    await incrementStreak();

    return { cardCount, cardType, tier };
  };

  /**
   * SAVE STREAK WITH DRINK
   * Spends 1 energy drink to bypass the pending streak decay, then claims the bag.
   * Only callable when userProfile.pendingDecay is non-null.
   */
  const saveStreakWithDrink = async () => {
    if (!userProfile?.pendingDecay) return null;
    const drinks = userProfile.energy_drinks ?? 0;
    if (drinks <= 0) return null;

    const newDrinks = drinks - 1;
    // Optimistic: spend drink, clear pendingDecay (streak unchanged)
    setUserProfile(prev => prev ? { ...prev, energy_drinks: newDrinks, pendingDecay: null } : prev);
    await supabase.from('profiles').update({ energy_drinks: newDrinks }).eq('id', userProfile.id);

    return claimTrainingBag();
  };

  /**
   * DECLINE STREAK SAVE
   * Applies the intercepted decay to DB + state, then claims the bag normally.
   */
  const declineStreakSave = async () => {
    if (!userProfile?.pendingDecay) return null;
    const { decayFields } = userProfile.pendingDecay;
    // Apply decay and clear pendingDecay
    setUserProfile(prev => prev ? { ...prev, ...decayFields, pendingDecay: null } : prev);
    await supabase.from('profiles').update(decayFields).eq('id', userProfile.id);

    return claimTrainingBag();
  };

  /**
   * START TRAINING SESSION
   * Guards: training_sessions_today < 2 AND energy > 0.
   * On success: increments training_sessions_today, sets last_training_date = today,
   * and spends 1 energy. Returns { success: true } or { success: false, reason }.
   *
   * Reason values:
   *   'cap'    — daily session limit reached (2/day)
   *   'energy' — no energy remaining
   */
  const startTrainingSession = async () => {
    if (!userProfile) return { success: false, reason: 'not_logged_in' };
    const today = todayUTC();
    // Apply daily reset in-memory (mirrors what loadProfile() does)
    const sessions = userProfile.last_training_date === today
      ? (userProfile.training_sessions_today ?? 0)
      : 0;
    if (sessions >= 2) return { success: false, reason: 'cap' };
    const currentEnergy = computeCurrentEnergy(userProfile);
    if (currentEnergy <= 0) return { success: false, reason: 'energy' };

    const newSessions = sessions + 1;
    // Optimistic state update for session count + date
    setUserProfile(prev => prev ? {
      ...prev,
      training_sessions_today: newSessions,
      last_training_date: today,
    } : prev);
    // Write session tracking fields (spendEnergy handles energy separately)
    await supabase.from('profiles').update({
      training_sessions_today: newSessions,
      last_training_date: today,
    }).eq('id', userProfile.id);
    // Spend 1 energy (handles its own optimistic state + DB write)
    await spendEnergy(1);
    return { success: true };
  };

  /**
   * COMPLETE TRAINING SESSION
   * Determines reward tier for score (0–10), grants common cards and optionally
   * a Supersub card + energy drink.
   * Returns { commonCount, hasSupersub, hasDrink } for the completion screen.
   *
   * Reward tiers:
   *   10/10 → 5 × c_match_result + 1 × c_supersub + 1 energy drink
   *    9/10 → 4 × c_match_result
   *   7–8   → 3 × c_match_result
   *   5–6   → 2 × c_match_result
   *   0–4   → 1 × c_match_result
   */
  const completeTrainingSession = async (score) => {
    const { common, supersub, drink } = trainingRewardForScore(score);
    const cardIds = [
      ...Array(common).fill('c_match_result'),
      ...(supersub ? ['c_supersub'] : []),
    ];
    if (cardIds.length) await updateInventory(cardIds);
    if (drink) await grantEnergyDrink(1);
    return { commonCount: common, hasSupersub: supersub, hasDrink: drink };
  };

  /**
   * CLAIM AD REWARD
   * Calls the watch_ad_reward() RPC which atomically:
   *   - Resets ads_watched_today if last_ad_date != today
   *   - Raises 'daily_cap_reached' if ads_watched_today >= 2
   *   - Increments energy_drinks by 1 (capped at 6)
   *   - Increments ads_watched_today and sets last_ad_date = today
   *
   * On success: calls grantEnergyDrink(1) to sync local state.
   * On daily cap: throws Error('daily_cap_reached') for the caller to toast.
   */
  const claimAdReward = async () => {
    if (!userProfile) return;

    const { data, error } = await supabase.rpc('watch_ad_reward', { p_user_id: userProfile.id });

    if (error) {
      if (error.message === 'daily_cap_reached') {
        throw new Error('daily_cap_reached');
      }
      console.error('claimAdReward: RPC failed', error.message);
      throw new Error(error.message);
    }

    // Sync ads_watched_today + last_ad_date into local state
    const today = new Date().toISOString().split('T')[0];
    setUserProfile(prev => prev ? {
      ...prev,
      ads_watched_today: (prev.ads_watched_today ?? 0) + 1,
      last_ad_date: today,
    } : prev);

    // Grant the energy drink in local state + DB (grantEnergyDrink applies the cap of 6)
    await grantEnergyDrink(1);
  };

  /**
   * CREATE PROFILE
   * Called once during onboarding after the user signs the manager contract.
   * Inserts the initial profile row and seeds the signing-bonus values.
   * On success, updates userProfile in context so Onboarding switches to the
   * "Welcome Aboard" screen immediately without a page reload.
   */
  const createProfile = async (clubName) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('createProfile: no authenticated user', authError?.message);
      return { success: false, error: authError?.message || 'No authenticated user' };
    }

    const profileData = {
      id: user.id,
      club_name: clubName,
      points: 500,      // signing bonus
      energy: 3,        // signing bonus
      max_energy: 5,
      ads_watched: 0,
      onboarding_complete: false,
    };

    // Upsert instead of insert so re-submitting the onboarding form (e.g. after
    // a partial failure or page refresh) doesn't crash with a duplicate-key 409.
    // ignoreDuplicates:false means existing rows are updated, preserving idempotency.
    const { data, error } = await supabase
      .from('profiles')
      .upsert([profileData], { onConflict: 'id', ignoreDuplicates: false })
      .select()
      .single();

    if (error) {
      console.error('createProfile: upsert failed', error.message);
      return { success: false, error: error.message };
    }

    // Immediately reflect in context so Onboarding re-renders to the bonus screen.
    setUserProfile({ ...data, inventoryMap: {} });
    return { success: true, data };
  };
  // GLOBAL APP STATE: Load the Sportmonks Dictionary immediately on mount
  useEffect(() => {
    const fetchGlobalDictionary = async () => {
      try {
        const { data, error } = await supabase
          .from('reference_cache')
          .select('value')
          .like('key', 'type:%');

        if (!error && data) {
          const dict = {};
          data.forEach(row => {
            const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            dict[val.id] = val;
          });
          setStatDictionary(dict);
        }
      } catch (err) {
        console.error("Failed to load stat dictionary:", err);
      }
    };
    fetchGlobalDictionary();
  }, []);
  // Auth init — loads profile on mount and on auth state changes
  useEffect(() => {
    let mounted = true;
    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted && session) await loadProfile(session);
      else if (mounted) setLoading(false);
    }
    initSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) { activeRequestId.current += 1; loadProfile(session); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // Realtime subscriptions — fires whenever the logged-in user changes
  useEffect(() => {
    if (!userProfile?.id) return;

    const cleanupChannel = async () => {
      if (realtimeChannelRef.current) {
        const old = realtimeChannelRef.current;
        realtimeChannelRef.current = null;
        await supabase.removeChannel(old);
      }
    };

    const initRealtime = async () => {
      await cleanupChannel();

      const channel = supabase
        .channel(`user-data-${userProfile.id}`)
        // Profile row changes (points, energy, coins, etc.)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userProfile.id}` },
          (payload) => {
            setUserProfile(prev => prev ? { ...prev, ...payload.new } : prev);
          }
        )
        // Inventory row changes (card counts — manual edits, settlement, rewards)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inventory', filter: `user_id=eq.${userProfile.id}` },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setUserProfile(prev => {
                if (!prev) return prev;
                const newMap = { ...prev.inventoryMap };
                delete newMap[payload.old.card_id];
                return { ...prev, inventoryMap: newMap };
              });
            } else {
              const { card_id, count } = payload.new;
              setUserProfile(prev => prev ? {
                ...prev,
                inventoryMap: { ...prev.inventoryMap, [card_id]: count },
              } : prev);
            }
          }
        )
        .subscribe((status) => {
          console.log(`📡 [Realtime] user-data channel: ${status}`);
        });

      realtimeChannelRef.current = channel;
    };

    initRealtime();

    return () => {
      setTimeout(() => {
        if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
      }, 100);
    };
  }, [userProfile?.id]);

  const value = {
    userProfile,
    loading,
    statDictionary,
    supabase,
    // Energy
    energyDrinks: userProfile?.energy_drinks ?? 0,
    spendEnergy,
    gainEnergy,
    useEnergyDrink,
    grantEnergyDrink,
    claimAdReward,
    // Streak
    currentStreak: userProfile?.current_streak ?? 0,
    streakTier,
    incrementStreak,
    claimTrainingBag,
    pendingDecay: userProfile?.pendingDecay ?? null,
    saveStreakWithDrink,
    declineStreakSave,
    // Training sessions
    trainingSessionsToday: userProfile?.training_sessions_today ?? 0,
    startTrainingSession,
    completeTrainingSession,
    // Cards / bets
    expiryMap: userProfile?.expiryMap ?? {},
    consumeCard,
    placeBet,
    updateInventory,
    // Profile lifecycle
    loadProfile,
    createProfile,
    // Settlements
    unseenSettlements,
    markPredictionsSeen,
  };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};