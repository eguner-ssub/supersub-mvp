/**
 * formatTeamName — shorten full team names for narrow mobile surfaces.
 *
 * Priority order:
 *   1. Manual override (handles edge cases & fan-facing shortenings)
 *   2. Strip common prefix ("Borussia", "TSG", "VfL", etc.)
 *   3. Strip common suffix ("Wanderers", "Calcio", etc.)
 *   4. If still too long and short_code is available, use that
 *   5. Fall back to the original name
 *
 * Bet records and share-card titles intentionally retain the full name for
 * historical integrity — this formatter is only for UI-display surfaces
 * where horizontal space is constrained (match cards, headers, filters).
 */

const STRIPPABLE_PREFIXES = [
  'Borussia', 'Bayer', 'Bayern', 'TSG', 'VfL', 'VfB', 'SC', 'FC',
  'RB', 'Eintracht', 'SV', 'Hertha', '1. FC', 'SpVgg',
  'Real', 'Atlético', 'Deportivo',
  'AS', 'AC', 'US', 'SS', 'UC',
  'Olympique',
];

const STRIPPABLE_SUFFIXES = [
  'Hove Albion', 'United', 'City', 'Town', 'Rovers', 'Wanderers',
  'FC', 'CF', 'Calcio',
];

const MANUAL_OVERRIDES = {
  // Bundesliga
  'Borussia Dortmund':        'Dortmund',
  'Borussia Mönchengladbach': "M'gladbach",
  'Bayer 04 Leverkusen':      'Leverkusen',
  'Bayer Leverkusen':         'Leverkusen',
  'Bayern Munich':            'Bayern',
  'Bayern München':           'Bayern',
  'TSG Hoffenheim':           'Hoffenheim',
  'Eintracht Frankfurt':      'Frankfurt',

  // Premier League
  'Brighton Hove Albion':     'Brighton',
  'Brighton and Hove Albion': 'Brighton',
  'Wolverhampton Wanderers':  'Wolves',
  'Tottenham Hotspur':        'Tottenham',
  'West Ham United':          'West Ham',
  'Newcastle United':         'Newcastle',
  'Manchester United':        'Man United',
  'Manchester City':          'Man City',
  'Nottingham Forest':        "Nott'm Forest",
  'AFC Bournemouth':          'Bournemouth',
  'Sheffield United':         'Sheffield Utd',
  'Leicester City':           'Leicester',
  'Leeds United':             'Leeds',

  // Serie A
  'Inter Milan':              'Inter',
  'AC Milan':                 'Milan',

  // La Liga
  'Atlético Madrid':          'Atlético',
  'Real Madrid':              'Real Madrid', // short enough, explicit to prevent prefix strip
  'Real Sociedad':            'Sociedad',

  // Ligue 1
  'Paris Saint-Germain':      'PSG',
};

/**
 * Returns a display name that fits narrow mobile UI.
 *
 * @param {string} fullName   - The full team name (e.g. "Borussia Dortmund")
 * @param {string} [shortCode] - Sportmonks 3-letter code (e.g. "BVB")
 * @param {number} [maxChars] - Character budget before falling back to short_code. Default 14.
 */
export function formatTeamName(fullName, shortCode = null, maxChars = 14) {
  if (!fullName) return shortCode || '';

  // 1. Manual override — highest priority, handles edge cases explicitly.
  if (MANUAL_OVERRIDES[fullName]) return MANUAL_OVERRIDES[fullName];

  // 2. Strip common prefixes.
  let trimmed = fullName;
  for (const prefix of STRIPPABLE_PREFIXES) {
    if (trimmed.startsWith(prefix + ' ')) {
      trimmed = trimmed.slice(prefix.length + 1);
      break;
    }
  }

  // 3. Strip common suffixes (only if the remaining head is still meaningful).
  for (const suffix of STRIPPABLE_SUFFIXES) {
    if (trimmed.endsWith(' ' + suffix) && trimmed.length - suffix.length > 3) {
      trimmed = trimmed.slice(0, trimmed.length - suffix.length - 1);
      break;
    }
  }

  // 4. Still too long? Fall back to the short code.
  if (trimmed.length > maxChars && shortCode) {
    return shortCode;
  }

  return trimmed;
}
