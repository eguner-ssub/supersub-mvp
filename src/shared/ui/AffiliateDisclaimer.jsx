import React from 'react';

/**
 * AffiliateDisclaimer
 * Required on every affiliate placement (PostPredictionSheet, WinCelebrationModal, etc.)
 * to satisfy UKGC affiliate guidelines.
 *
 * Props:
 *   className — optional additional Tailwind classes for placement flexibility
 */
const AffiliateDisclaimer = ({ className = '' }) => (
  <p className={`text-[9px] text-white/25 uppercase tracking-widest text-center leading-relaxed ${className}`}>
    18+&nbsp;·&nbsp;
    <a
      href="https://www.begambleaware.org"
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-white/50 transition-colors"
    >
      BeGambleAware.org
    </a>
    &nbsp;·&nbsp;T&amp;Cs apply&nbsp;·&nbsp;Play responsibly.
  </p>
);

export default AffiliateDisclaimer;
