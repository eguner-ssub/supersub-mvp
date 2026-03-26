import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Privacy = () => (
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
        Privacy Policy
      </h1>
    </div>

    {/* Content */}
    <div className="flex-1 px-5 py-8 max-w-2xl mx-auto w-full">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-6">
        Last updated: January 2025
      </p>

      <Section title="1. Who We Are">
        Supersub ("we", "us", "our") operates the Supersub football prediction game at
        supersub.mobi. This policy explains what data we collect, how we use it, and your
        rights.
      </Section>

      <Section title="2. Data We Collect">
        We collect the email address and password hash you provide at signup. During
        gameplay we store your prediction history, card inventory, points balance, and energy
        level. We also record anonymous affiliate interaction events (impressions and clicks
        on operator links) without linking them to identifiable information in external
        systems.
      </Section>

      <Section title="3. How We Use Your Data">
        Your data is used solely to operate the game: authenticating your account, recording
        predictions, updating leaderboards, and displaying your history. We do not sell your
        personal data to third parties.
      </Section>

      <Section title="4. Affiliate Links">
        When you click a link to a third-party betting operator, that operator may set
        cookies or collect data under their own privacy policy. We encourage you to read
        their policies before registering. Supersub passes no personal information to
        operators on click.
      </Section>

      <Section title="5. Data Storage">
        Your data is stored securely via Supabase (PostgreSQL, hosted on AWS). All
        connections are encrypted in transit (TLS). We retain your account data for as long
        as your account is active or as required by law.
      </Section>

      <Section title="6. Your Rights">
        You have the right to access, correct, or delete your personal data at any time.
        To request deletion of your account and associated data, contact us at{' '}
        <a
          href="mailto:hello@supersub.mobi"
          className="text-green-400 underline underline-offset-2"
        >
          hello@supersub.mobi
        </a>.
      </Section>

      <Section title="7. Cookies">
        Supersub uses only essential session cookies required for authentication. We do not
        use tracking or advertising cookies.
      </Section>

      <Section title="8. Changes to This Policy">
        We may update this policy from time to time. We will notify users of material
        changes via the app or email.
      </Section>

      <Section title="9. Contact">
        Questions about this policy? Email{' '}
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
          to="/terms"
          className="text-[9px] text-white/25 uppercase tracking-widest hover:text-white/45 transition-colors"
        >
          Terms of Service
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

export default Privacy;
