import React from 'react';
import { X } from 'lucide-react';

/**
 * MatchBriefingSheet — full-height modal sheet that surfaces the pre-match
 * intel (greeting + four narrative sections + SUPERSUB WATCH). Rendered only
 * during PRE_LINEUPS phase from MatchDetail.jsx once `analysisData` is ready.
 *
 * The PRE_NO_LINEUPS inline briefing panel in MatchDetail.jsx keeps its own
 * rendering; the section-card token styles here mirror those tokens exactly
 * so both surfaces read as one briefing with two presentation contexts.
 */

const SECTION_CARD_STYLE = {
  background: 'rgba(245,240,232,0.06)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
  padding: '14px 16px',
  marginBottom: '10px',
};

const SECTION_TITLE_STYLE = {
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 800,
  fontSize: '10px',
  color: '#00e5ff',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  margin: '0 0 6px',
};

const SECTION_BODY_STYLE = {
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 500,
  fontSize: '12px',
  color: 'rgba(255,255,255,0.75)',
  lineHeight: 1.5,
  margin: 0,
};

const GreetingBubble = ({ message }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    marginBottom: '14px', padding: '10px 14px',
    background: '#f5f0e8', borderRadius: '14px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
  }}>
    <img
      src="/assets/assistant-head.png"
      alt="Tactical Expert"
      style={{
        width: '44px', height: '44px', borderRadius: '50%',
        objectFit: 'cover', flexShrink: 0,
        border: '2px solid rgba(0,0,0,0.08)',
      }}
    />
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{
        fontFamily: "'Montserrat', sans-serif",
        fontWeight: 700, fontSize: '9px',
        color: '#888',
        textTransform: 'uppercase', letterSpacing: '1px',
      }}>
        Tactical Expert
      </span>
      <p style={{
        fontFamily: "'Montserrat', sans-serif",
        fontWeight: 700, fontSize: '12px',
        color: '#121212',
        margin: '3px 0 0', lineHeight: 1.35,
      }}>
        {message}
      </p>
    </div>
  </div>
);

const SupersubWatch = ({ items }) => (
  <div style={SECTION_CARD_STYLE}>
    <p style={SECTION_TITLE_STYLE}>Supersub Watch</p>
    {items.map((it, i) => {
      const per90 = typeof it.goalsPer90AsSub === 'number' ? it.goalsPer90AsSub : 0;
      const goalWord = it.goalsAsSub === 1 ? 'goal' : 'goals';
      return (
        <p
          key={`${it.playerName}-${i}`}
          style={{ ...SECTION_BODY_STYLE, marginBottom: i < items.length - 1 ? '6px' : 0 }}
        >
          {it.teamName}&rsquo;s{' '}
          <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{it.playerName}</strong>
          {' '}— {it.goalsAsSub} {goalWord} as sub this season ({per90.toFixed(1)} per 90).
        </p>
      );
    })}
  </div>
);

export default function MatchBriefingSheet({
  analysisData,
  open,
  onClose,
}) {
  if (!open || !analysisData) return null;

  const greeting = analysisData.greeting || 'Hi Boss. Here is the briefing.';
  const sections = analysisData.sections || [];
  const supersubItems = analysisData.supersubWatch?.items || [];

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col justify-end animate-in fade-in duration-200"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pre-match briefing"
    >
      <div
        className="w-full rounded-t-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{
          background: 'rgba(14,14,14,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '90dvh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — sticky close */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800, fontSize: '11px',
            color: '#FFFFFF',
            textTransform: 'uppercase', letterSpacing: '1.5px',
          }}>
            Pre-Match Briefing
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/70"
            aria-label="Close briefing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: '16px 12px',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          }}
        >
          <GreetingBubble message={greeting} />

          {sections.map((section, i) => (
            <div key={i} style={SECTION_CARD_STYLE}>
              <p style={SECTION_TITLE_STYLE}>{section.title}</p>
              <p style={SECTION_BODY_STYLE}>{section.content}</p>
            </div>
          ))}

          {analysisData.supersubWatch?.available === true && supersubItems.length > 0 && (
            <SupersubWatch items={supersubItems} />
          )}
        </div>
      </div>
    </div>
  );
}
