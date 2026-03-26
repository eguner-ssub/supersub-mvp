/**
 * affiliates.js — Operator configuration for affiliate revenue engine
 *
 * PLACEHOLDER: trackingParam and affiliateId are null until a formal
 * agreement is signed. When an agreement is in place:
 *   1. Set trackingParam to the operator's tracking parameter name (e.g. 'btag')
 *   2. Set affiliateId to the value assigned by the operator
 * The useAffiliateLink hook will automatically append the tracking param
 * to the URL without any other code changes.
 */

export const OPERATORS = [
  {
    id:             'bet365',
    name:           'bet365',
    baseUrl:        'https://www.bet365.com',
    trackingParam:  null,   // populate with e.g. 'btag' when agreement signed
    affiliateId:    null,   // populate with assigned btag value when agreement signed
    brandColor:     '027B5B', // bet365 green (no leading #, applied as template literal)
    active:         true,
  },
];

/** Default stake used for computing display return figures (GBP) */
export const DEFAULT_STAKE_GBP = 10;

/** Look up an operator by id; falls back to first operator if not found */
export const getOperator = (id) => OPERATORS.find(o => o.id === id) ?? OPERATORS[0];

/** Returns the first active operator — used when no specific operator is requested */
export const getActiveOperator = () => OPERATORS.find(o => o.active) ?? OPERATORS[0];
