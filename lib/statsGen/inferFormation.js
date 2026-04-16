// Infer a formation string ("4-3-3", "3-5-2", …) from a Sportmonks lineup
// array. Mirrors the inline logic in api/matches.js:42-57 so both code
// paths produce identical output and no callers drift apart.
//
// starters is a flat array of lineup entries with `formation_field`
// strings shaped like "R:C" where R is the row (1 = GK, ≥2 = outfield).
// Returns null when formation can't be determined; callers typically fall
// back to "4-4-2" for display.

export function inferFormation(starters) {
  if (!Array.isArray(starters) || !starters.some(e => e?.formation_field)) {
    return null;
  }

  const rowCounts = {};
  for (const e of starters) {
    if (!e?.formation_field) continue;
    const row = parseInt(String(e.formation_field).split(':')[0], 10) || 1;
    rowCounts[row] = (rowCounts[row] || 0) + 1;
  }

  const outfieldRows = Object.keys(rowCounts)
    .map(Number)
    .filter(r => r > 1)
    .sort((a, b) => a - b)
    .map(r => rowCounts[r]);

  return outfieldRows.length > 0 ? outfieldRows.join('-') : null;
}
