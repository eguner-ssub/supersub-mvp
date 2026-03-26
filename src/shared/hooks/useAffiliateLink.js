import { getActiveOperator, DEFAULT_STAKE_GBP } from '../config/affiliates';

/**
 * useAffiliateLink
 *
 * Returns everything a CTA component needs to render an affiliate placement.
 * Not a stateful React hook — no useState/useEffect — but named with the
 * use* convention for consistency and future upgradability.
 *
 * @param {object} params
 * @param {string} params.cardType       — e.g. 'c_supersub', 'c_match_result'
 * @param {string} params.selectionLabel — human-readable label shown in the CTA
 * @param {number} params.odds           — decimal odds (0 for Supersub fixed-reward cards)
 * @param {string} params.matchName      — e.g. 'Arsenal vs Chelsea' (optional)
 *
 * @returns {{
 *   operator:      object,   — full operator config from affiliates.js
 *   affiliateUrl:  string,   — URL to open on CTA click
 *   displayReturn: string|null, — e.g. '35.00' or null if odds unavailable
 *   stakeDisplay:  string,   — e.g. '£10'
 * }}
 */
export function useAffiliateLink({ cardType, selectionLabel, odds, matchName } = {}) {
  const operator = getActiveOperator();

  // Build affiliate URL.
  // When trackingParam and affiliateId are populated in affiliates.js,
  // this automatically appends the tracking parameter — no other changes needed.
  let affiliateUrl = operator.baseUrl;
  if (operator.trackingParam && operator.affiliateId) {
    affiliateUrl = `${operator.baseUrl}?${operator.trackingParam}=${encodeURIComponent(operator.affiliateId)}`;
  }

  // Compute display return.
  // Returns null for Supersub (odds === 0) and for any unavailable/invalid odds value.
  // Components must handle null gracefully (fallback copy: "Place this bet at [operator]").
  let displayReturn = null;
  if (odds != null && odds > 0 && isFinite(odds)) {
    displayReturn = (DEFAULT_STAKE_GBP * odds).toFixed(2);
  }

  const stakeDisplay = `£${DEFAULT_STAKE_GBP}`;

  return { operator, affiliateUrl, displayReturn, stakeDisplay };
}
