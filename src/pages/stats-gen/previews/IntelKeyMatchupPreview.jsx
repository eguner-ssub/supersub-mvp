import React from 'react';
import {
  MatchHeader, JosebaByline, IntelUnavailable,
  SECTION_TITLE_CLS, SECTION_PROSE_CLS,
} from './IntelShell';

export function IntelKeyMatchupPreview({ data }) {
  if (data?.dataStatus === 'unavailable') {
    return <IntelUnavailable match={data.match} generatedAt={data.generatedAt} reason={data.reason} />;
  }

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
      <MatchHeader match={data.match} />
      <p className={SECTION_TITLE_CLS}>Key Matchup</p>
      <p className={SECTION_PROSE_CLS}>{data.content?.prose}</p>
      <JosebaByline generatedAt={data.generatedAt} />
    </div>
  );
}
