import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Terms = () => (
  <div className="min-h-screen bg-black text-white flex flex-col">
    {/* Header */}
    <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-white/10 px-5 pt-10 pb-4 flex items-center gap-4">
      <Link
        to="/"
        className="w-9 h-9 flex-shrink-0 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-4 h-4" />
      </Link>
      <h1 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">
        Terms of Service
      </h1>
    </div>

    {/* Content */}
    <div className="flex-1 px-5 py-8 max-w-2xl mx-auto w-full">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-6">
        Last updated: January 2025
      </p>

      <Section title="1. About Supersub">
        Supersub is a free-to-play football prediction game. No real money is wagered and no
        prizes of monetary value are awarded. Points earned within the game have no cash
        equivalent and cannot be redeemed or transferred.
      </Section>

      <Section title="2. Eligibility">
        You must be 18 years of age or older to use Supersub. By creating an account you
        confirm that you meet this requirement. We reserve the right to suspend accounts
        where age eligibility cannot be verified.
      </Section>

      <Section title="3. Your Account">
        You are responsible for keeping your login credentials secure. You may not share,
        sell, or transfer your account. We reserve the right to suspend or terminate accounts
        that breach these terms.
      </Section>

      <Section title="4. Acceptable Use">
        You agree not to use Supersub in any way that is unlawful, harmful, or disruptive to
        other users or the platform. Automated scripts, bots, or any attempt to manipulate
        game mechanics are strictly prohibited.
      </Section>

      <Section title="5. Affiliate Links">
        Supersub displays links to licensed third-party betting operators. These are clearly
        labelled. Clicking them is entirely optional and will open the operator's site in a
        new tab. Supersub may receive a commission if you register or place a bet with a
        linked operator. Gambling involves risk — please bet responsibly.
      </Section>

      <Section title="6. Intellectual Property">
        All content, design, and code within Supersub is owned by or licensed to Supersub
        and may not be reproduced without written permission.
      </Section>

      <Section title="7. Limitation of Liability">
        Supersub is provided "as is" without warranties of any kind. We are not liable for
        any losses arising from use of the platform or linked third-party services.
      </Section>

      <Section title="8. Changes to These Terms">
        We may update these terms from time to time. Continued use of Supersub after changes
        are published constitutes acceptance of the updated terms.
      </Section>

      <Section title="9. Contact">
        For any questions about these terms, contact us at{' '}
        <a
          href="mailto:hello@supersub.mobi"
          className="text-green-400 underline underline-offset-2"
        >
          hello@supersub.mobi
        </a>.
      </Section>

      {/* Responsible gambling footer */}
      <div className="mt-10 pt-6 border-t border-white/10 flex items-center justify-center gap-4">
        <span className="text-[9px] text-white/25 uppercase tracking-widest font-black border border-white/15 rounded px-1.5 py-0.5">
          18+
        </span>
        <a
          href="https://www.begambleaware.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-white/25 uppercase tracking-widest hover:text-white/45 transition-colors"
        >
          BeGambleAware.org
        </a>
        <Link
          to="/privacy"
          className="text-[9px] text-white/25 uppercase tracking-widest hover:text-white/45 transition-colors"
        >
          Privacy Policy
        </Link>
      </div>
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-white/60 mb-3">
      {title}
    </h2>
    <p className="text-sm text-white/40 leading-relaxed">{children}</p>
  </div>
);

export default Terms;
