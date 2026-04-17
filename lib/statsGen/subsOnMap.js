// Build a Map<playerId, entryMinute> for every player subbed ON during a
// match. Mirrors the pattern in scripts/settle.js so any analytics
// endpoint reuses the same event-parsing logic that settlement relies on.
//
// Sportmonks v3 substitution events (type_id 18):
//   player_id         = player coming ON (the substitute)
//   related_player_id = player going OFF (the starter being replaced)
//   assist is undefined — NOT populated on sub events (was only used by
//   the legacy API-Football format).
//
// If teamId is provided, only that team's subs are included. If omitted,
// all subs across both teams are returned.

export function buildSubsOnMap(events, teamId = null) {
  const map = new Map();
  if (!Array.isArray(events)) return map;

  for (const event of events) {
    const isSub = event.type_id === 18 || event.type === 'subst';
    if (!isSub) continue;

    if (teamId != null) {
      const eventTeam = event.participant_id ?? event.team?.id;
      if (eventTeam !== teamId) continue;
    }

    const incomingPlayerId = event.player_id;
    if (incomingPlayerId == null) continue;

    const minute = event.minute ?? event.time?.elapsed ?? 0;
    map.set(Number(incomingPlayerId), minute);
  }

  return map;
}

// Helper for endpoints that need the goals scored by sub-on players
// after their entry minute. Returns an array of
// { scorerId, entryMinute, goalMinute, elapsedAfterEntry, event }.
export function findSubGoalsAfterEntry(events, subsOn) {
  const out = [];
  if (!Array.isArray(events) || !subsOn?.size) return out;

  for (const event of events) {
    const isGoal = event.type_id === 14 || event.type_id === 97 || event.type === 'Goal';
    if (!isGoal) continue;

    const scorerId = Number(event.player_id ?? event.player?.id);
    if (!scorerId) continue;

    const entryMinute = subsOn.get(scorerId);
    if (entryMinute === undefined) continue;

    const goalMinute = event.minute ?? event.time?.elapsed ?? 0;
    if (goalMinute < entryMinute || goalMinute > 120) continue;

    out.push({
      scorerId,
      entryMinute,
      goalMinute,
      elapsedAfterEntry: goalMinute - entryMinute,
      event,
    });
  }

  return out;
}
