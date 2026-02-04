import React, { useState } from 'react';
import { Search, Server, Database, AlertCircle, Globe, Zap } from 'lucide-react';

const APIDebugger = () => {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [fixtureId, setFixtureId] = useState('');
    const [mode, setMode] = useState('api-football'); // 'api-football' | 'the-odds-api'

    // FETCH HANDLER
    const handleFetch = async () => {
        setLoading(true);
        setResponse(null);
        try {
            let url = '';

            // --- MODE A: API-FOOTBALL (Your Proxy) ---
            if (mode === 'api-football') {
                if (!fixtureId) { // Auto-fetch matches if no ID
                    url = '/api/matches';
                } else {
                    url = `/api/odds?fixture=${fixtureId}`;
                }
            }

            // --- MODE B: THE ODDS API (Direct) ---
            else if (mode === 'the-odds-api') {
                const apiKey = import.meta.env.VITE_ODDS_API_KEY;
                if (!apiKey) throw new Error("Missing VITE_ODDS_API_KEY in .env");
                // Fetch EPL Odds
                url = `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${apiKey}&regions=uk&markets=h2h,totals`;
            }

            console.log(`fetching: ${url}`);
            const res = await fetch(url);
            const data = await res.json();
            setResponse(data);

        } catch (err) {
            setResponse({ error: err.message });
        } finally {
            setLoading(false);
        }
    };

    // ANALYSIS HELPER
    const renderAnalysis = () => {
        if (!response) return null;

        // ERROR STATE
        if (response.error || (response.message && !response.response && !Array.isArray(response))) {
            return (
                <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30 mb-4 text-red-400 text-sm">
                    Error: {response.error || response.message}
                </div>
            );
        }

        // 1. ANALYZE API-FOOTBALL
        if (mode === 'api-football') {
            const data = response.response || [];
            if (data.length === 0) return <div className="text-zinc-500 mb-4">No data found in response.</div>;

            // Is it a Match List?
            if (data[0].teams) {
                return (
                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30 mb-4">
                        <h3 className="text-blue-400 font-bold mb-2">Match List (API-Football)</h3>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                            {data.map(m => (
                                <div key={m.fixture.id} onClick={() => setFixtureId(m.fixture.id)} className="flex justify-between text-xs text-white/70 hover:bg-white/5 p-1 cursor-pointer">
                                    <span>{m.teams.home.name} vs {m.teams.away.name}</span>
                                    <span className="text-yellow-500 font-mono">{m.fixture.id}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }
            // Is it Odds?
            const bookmakers = data[0]?.bookmakers || [];
            return (
                <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30 mb-4">
                    <h3 className="text-blue-400 font-bold mb-2">Odds Detail (API-Football)</h3>
                    <p className="text-sm mb-2">Bookmakers Found: {bookmakers.length}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-zinc-500 block uppercase">Bookies</span>
                            {bookmakers.map(b => <div key={b.id} className="text-white">{b.name}</div>)}
                        </div>
                        <div>
                            <span className="text-zinc-500 block uppercase">Markets (First Bookie)</span>
                            {bookmakers[0]?.bets.map((b, i) => <div key={i} className="text-zinc-400">{b.name}</div>)}
                        </div>
                    </div>
                </div>
            );
        }

        // 2. ANALYZE THE ODDS API
        if (mode === 'the-odds-api') {
            // The Odds API returns an array of events directly
            if (!Array.isArray(response)) return null;

            return (
                <div className="bg-green-900/20 p-4 rounded-lg border border-green-500/30 mb-4">
                    <h3 className="text-green-400 font-bold mb-2">Feed Analysis (The Odds API)</h3>
                    <p className="text-sm mb-2">Events Found: {response.length}</p>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {response.map(event => (
                            <div key={event.id} className="text-xs border-b border-white/5 pb-2 mb-2">
                                <div className="flex justify-between text-white font-bold">
                                    <span>{event.home_team} vs {event.away_team}</span>
                                    <span className="text-zinc-500">{new Date(event.commence_time).toLocaleDateString()}</span>
                                </div>
                                <div className="text-zinc-400 mt-1">
                                    Bookies: {event.bookmakers.map(b => b.title).join(', ')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <h1 className="text-3xl font-black uppercase tracking-widest mb-8 flex items-center gap-3">
                <Database className="text-red-600" /> Hybrid API Inspector
            </h1>

            {/* CONTROLS */}
            <div className="flex flex-wrap gap-4 mb-8 bg-zinc-900 p-6 rounded-2xl border border-white/10">

                {/* SOURCE TOGGLE */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Data Source</label>
                    <div className="flex bg-black rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => { setMode('api-football'); setResponse(null); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode === 'api-football' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <Zap className="w-4 h-4" /> API-Football
                        </button>
                        <button
                            onClick={() => { setMode('the-odds-api'); setResponse(null); setFixtureId(''); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode === 'the-odds-api' ? 'bg-green-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <Globe className="w-4 h-4" /> The Odds API
                        </button>
                    </div>
                </div>

                {/* INPUTS */}
                {mode === 'api-football' && (
                    <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Fixture ID (Optional)</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="text"
                                value={fixtureId}
                                onChange={(e) => setFixtureId(e.target.value)}
                                placeholder="Leave empty for Match List..."
                                className="w-full bg-black border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-end">
                    <button
                        onClick={handleFetch}
                        disabled={loading}
                        className="bg-white text-black font-black uppercase px-8 py-2 rounded-lg hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? <span className="animate-spin">⌛</span> : <Server className="w-4 h-4" />}
                        Fetch Data
                    </button>
                </div>
            </div>

            {/* ANALYSIS PANEL */}
            {renderAnalysis()}

            {/* RAW OUTPUT */}
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
