/**
 * EPL team alias map — maps any common variant to the canonical Sportmonks team name.
 * Used to tag news articles with a team_id by scanning headline + summary text.
 *
 * Format: { alias (lowercase) → canonical name (matches teams.name in DB) }
 */
export const EPL_TEAM_ALIASES = {
  // Arsenal
  'arsenal':                  'Arsenal',

  // Aston Villa
  'aston villa':              'Aston Villa',
  'villa':                    'Aston Villa',

  // Bournemouth
  'bournemouth':              'Bournemouth',
  'afc bournemouth':          'Bournemouth',

  // Brentford
  'brentford':                'Brentford',

  // Brighton
  'brighton':                 'Brighton & Hove Albion',
  'brighton & hove albion':   'Brighton & Hove Albion',
  'brighton and hove albion': 'Brighton & Hove Albion',

  // Chelsea
  'chelsea':                  'Chelsea',
  'the blues':                'Chelsea',

  // Crystal Palace
  'crystal palace':           'Crystal Palace',
  'palace':                   'Crystal Palace',

  // Everton
  'everton':                  'Everton',
  'the toffees':              'Everton',

  // Fulham
  'fulham':                   'Fulham',

  // Ipswich
  'ipswich':                  'Ipswich Town',
  'ipswich town':             'Ipswich Town',

  // Leicester
  'leicester':                'Leicester City',
  'leicester city':           'Leicester City',
  'the foxes':                'Leicester City',

  // Liverpool
  'liverpool':                'Liverpool',
  'the reds':                 'Liverpool',

  // Man City
  'manchester city':          'Manchester City',
  'man city':                 'Manchester City',
  'man. city':                'Manchester City',
  'the citizens':             'Manchester City',

  // Man Utd
  'manchester united':        'Manchester United',
  'man united':               'Manchester United',
  'man utd':                  'Manchester United',
  'man. united':              'Manchester United',
  'the red devils':           'Manchester United',

  // Newcastle
  'newcastle':                'Newcastle United',
  'newcastle united':         'Newcastle United',
  'the magpies':              'Newcastle United',

  // Nottingham Forest
  'nottingham forest':        'Nottingham Forest',
  'notts forest':             'Nottingham Forest',
  'forest':                   'Nottingham Forest',

  // Southampton
  'southampton':              'Southampton',
  'the saints':               'Southampton',

  // Spurs / Tottenham
  'tottenham':                'Tottenham Hotspur',
  'tottenham hotspur':        'Tottenham Hotspur',
  'spurs':                    'Tottenham Hotspur',

  // West Ham
  'west ham':                 'West Ham United',
  'west ham united':          'West Ham United',
  'the hammers':              'West Ham United',

  // Wolves
  'wolverhampton':            'Wolverhampton Wanderers',
  'wolverhampton wanderers':  'Wolverhampton Wanderers',
  'wolves':                   'Wolverhampton Wanderers',
};

/**
 * Scan text for any EPL team alias.
 * Returns the canonical team name if found, null otherwise.
 * Longest alias match wins to avoid "Forest" matching before "Nottingham Forest".
 */
export function detectTeam(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Sort aliases longest-first so multi-word names take priority
  const aliases = Object.keys(EPL_TEAM_ALIASES).sort((a, b) => b.length - a.length);

  for (const alias of aliases) {
    // Word-boundary-style check: alias surrounded by non-alpha chars or string edges
    const idx = lower.indexOf(alias);
    if (idx === -1) continue;

    const before = idx === 0 ? '' : lower[idx - 1];
    const after  = idx + alias.length >= lower.length ? '' : lower[idx + alias.length];
    const boundBefore = !before || /[^a-z]/.test(before);
    const boundAfter  = !after  || /[^a-z]/.test(after);

    if (boundBefore && boundAfter) {
      return EPL_TEAM_ALIASES[alias];
    }
  }

  return null;
}
