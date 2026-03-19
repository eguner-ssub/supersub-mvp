/**
 * Country code → display name mapping.
 *
 * Covers the most common countries for football fans. Add entries as needed
 * when new country_code values appear in profiles.
 */

const COUNTRY_NAMES = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AR: 'Argentina',
  AU: 'Australia', AT: 'Austria', BD: 'Bangladesh', BE: 'Belgium',
  BR: 'Brazil', BG: 'Bulgaria', CA: 'Canada', CL: 'Chile',
  CN: 'China', CO: 'Colombia', HR: 'Croatia', CZ: 'Czechia',
  DK: 'Denmark', EG: 'Egypt', FI: 'Finland', FR: 'France',
  DE: 'Germany', GH: 'Ghana', GR: 'Greece', HK: 'Hong Kong',
  HU: 'Hungary', IN: 'India', ID: 'Indonesia', IE: 'Ireland',
  IL: 'Israel', IT: 'Italy', JP: 'Japan', KE: 'Kenya',
  KR: 'South Korea', MY: 'Malaysia', MX: 'Mexico', MA: 'Morocco',
  NL: 'Netherlands', NZ: 'New Zealand', NG: 'Nigeria', NO: 'Norway',
  PK: 'Pakistan', PE: 'Peru', PH: 'Philippines', PL: 'Poland',
  PT: 'Portugal', RO: 'Romania', RU: 'Russia', SA: 'Saudi Arabia',
  RS: 'Serbia', SG: 'Singapore', ZA: 'South Africa', ES: 'Spain',
  SE: 'Sweden', CH: 'Switzerland', TH: 'Thailand', TR: 'Turkey',
  UA: 'Ukraine', AE: 'United Arab Emirates', GB: 'United Kingdom',
  US: 'United States', UY: 'Uruguay', VE: 'Venezuela', VN: 'Vietnam',
};

/**
 * Get display name for an ISO 3166-1 alpha-2 country code.
 * Falls back to the code itself if unknown.
 * @param {string} code
 * @returns {string}
 */
export function getCountryName(code) {
  if (!code) return 'Unknown';
  return COUNTRY_NAMES[code.toUpperCase()] || code.toUpperCase();
}
