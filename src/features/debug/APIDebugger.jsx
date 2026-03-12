import React, { useState } from 'react';
import { Search, Server, Database, AlertCircle } from 'lucide-react';

const APIDebugger = () => {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [fixtureId, setFixtureId] = useState('');

    const handleFetch = async () => {
        if (!fixtureId) return;
        setLoading(true);
        setResponse(null);
        try {
            const res = await fetch(`/api/odds/sportmonks?fixture=${fixtureId}`);
            const data = await res.json();
            setResponse(data);
        } catch (err) {
            setResponse({ error: err.message });
        } finally {
            setLoading(false);
        }
    };

    const renderAnalysis = () => {
        if (!response) return null;

        if (response.error) {
            return (
                <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30 mb-4 text-red-400 text-sm">
                    Error: {response.error}
                </div>
            );
        }

        return (
            <div className="bg-green-900/20 p-4 rounded-lg border border-green-500/30 mb-4">
                <h3 className="text-green-400 font-bold mb-2">Sportmonks Odds — Fixture {response.fixture_id}</h3>
                {response.match_result && (
                    <p className="text-sm text-zinc-300">Match Result: H {response.match_result.home} / D {response.match_result.draw} / A {response.match_result.away}</p>
                )}
                {response.total_goals && (
                    <p className="text-sm text-zinc-300">O/U 2.5: Over {response.total_goals.over_2_5} / Under {response.total_goals.under_2_5}</p>
                )}
                {response.first_goalscorer && (
                    <p className="text-sm text-zinc-300">Goalscorers: {response.first_goalscorer.length} players</p>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <h1 className="text-3xl font-black uppercase tracking-widest mb-8 flex items-center gap-3">
                <Database className="text-red-600" /> Sportmonks Odds Inspector
            </h1>

            <div className="flex flex-wrap gap-4 mb-8 bg-zinc-900 p-6 rounded-2xl border border-white/10">
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Fixture ID</label>
                    <input
                        type="text"
                        value={fixtureId}
                        onChange={(e) => setFixtureId(e.target.value)}
                        placeholder="e.g. 18533878"
                        className="bg-black text-white px-4 py-2 rounded-lg border border-white/10 text-sm font-mono w-48"
                    />
                </div>

                <div className="flex items-end">
                    <button
                        onClick={handleFetch}
                        disabled={loading || !fixtureId}
                        className="bg-white text-black font-black uppercase px-8 py-2 rounded-lg hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? <span className="animate-spin">⌛</span> : <Server className="w-4 h-4" />}
                        Fetch Odds
                    </button>
                </div>
            </div>

            {renderAnalysis()}

            <div className="bg-zinc-950 rounded-xl border border-white/10 overflow-hidden relative">
                <div className="bg-zinc-900 px-4 py-2 border-b border-white/10 flex justify-between items-center">
                    <span className="text-xs font-mono text-zinc-400">RAW JSON RESPONSE</span>
                    <span className="text-xs font-mono text-zinc-600">{response ? (JSON.stringify(response).length / 1024).toFixed(2) + ' KB' : '0 KB'}</span>
                </div>
                <div className="p-4 overflow-auto max-h-[60vh]">
                    {response ? (
                        <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
                            {JSON.stringify(response, null, 2)}
                        </pre>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
                            <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                            <p>No data loaded.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default APIDebugger;
