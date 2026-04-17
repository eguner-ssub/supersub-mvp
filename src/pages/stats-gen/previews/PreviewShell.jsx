import React from 'react';

export function PreviewShell({ contentType, context, lineupConfirmed, fetchedAt, children }) {
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
      <header className="flex items-start justify-between mb-6 pb-4 border-b border-zinc-900">
        <div>
          <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-1">
            {contentType}
          </p>
          <p className="text-white text-sm">{context}</p>
        </div>
        <div className="flex items-center gap-2">
          {lineupConfirmed !== undefined && (
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
              lineupConfirmed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
            }`}>
              {lineupConfirmed ? 'Confirmed XI' : 'Predicted XI'}
            </span>
          )}
          {fetchedAt && (
            <span className="text-zinc-600 text-[9px] font-mono">
              {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
