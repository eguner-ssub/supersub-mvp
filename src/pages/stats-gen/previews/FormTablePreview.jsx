import React from 'react';
import { PreviewShell } from './PreviewShell';

const FORM_COLORS = { W: 'bg-emerald-400', D: 'bg-amber-400', L: 'bg-red-400' };

function FormDot({ result }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-5 h-5 rounded-full ${FORM_COLORS[result] || 'bg-zinc-700'}`} />
      <span className="text-zinc-500 text-[9px] font-bold">{result}</span>
    </div>
  );
}

function TeamRow({ team, side }) {
  return (
    <div className="flex items-center gap-4 py-4">
      {team.badge && (
        <img src={team.badge} alt={team.name} className="w-8 h-8 rounded-md object-contain flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-bold truncate">{team.name}</p>
          <span className="text-zinc-600 text-[9px] font-bold uppercase">{side}</span>
        </div>
        <p className="text-zinc-500 text-xs mt-0.5">
          {team.position != null ? (
            <><span className="text-cyan-400 font-bold">{team.position}</span><sup>{ordinal(team.position)}</sup></>
          ) : '–'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {(team.form || []).map((f, i) => <FormDot key={i} result={f} />)}
      </div>
    </div>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function FormTablePreview({ data }) {
  return (
    <PreviewShell
      contentType="Form Table"
      context={`${data.home_team?.name} vs ${data.away_team?.name}`}
      fetchedAt={data._fetchedAt}
    >
      <div className="divide-y divide-zinc-900">
        <TeamRow team={data.home_team} side="Home" />
        <TeamRow team={data.away_team} side="Away" />
      </div>
    </PreviewShell>
  );
}
