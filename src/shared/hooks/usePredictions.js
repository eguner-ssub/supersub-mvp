import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

export const usePredictions = (statusFilter = null) => {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { userProfile, supabase } = useGame();

    const fetchPredictions = async () => {
        if (!userProfile?.id || !supabase) {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            let query = supabase
                .from('predictions')
                .select(`
                    id,
                    match_id,
                    match_title,
                    team_name,
                    selection,
                    odds,
                    potential_reward,
                    status,
                    card_type,
                    created_at,
                    updated_at
                `)
                .eq('user_id', userProfile.id)
                .order('created_at', { ascending: false });

            if (statusFilter) {
                if (statusFilter === 'SETTLED') {
                    query = query.in('status', ['WON', 'LOST']);
                } else {
                    query = query.eq('status', statusFilter);
                }
            }

            const { data, error } = await query;

            if (error) throw error;

            // CLIENT-SIDE KICKOFF CHECK
            // If viewing PENDING bets, verify if any have actually started
            if (statusFilter === 'PENDING' && data?.length > 0) {
                const today = new Date().toLocaleDateString('sv-SE');
                const res = await fetch(`/api/matches?date=${today}`);
                const matchData = await res.json();
                const liveMatches = matchData.response || [];

                const liveStatuses = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'];

                for (const bet of data) {
                    const match = liveMatches.find(m => m.fixture.id === bet.match_id);
                    if (match && liveStatuses.includes(match.fixture.status.short)) {
                        // Update DB: move from PENDING to LIVE
                        await supabase
                            .from('predictions')
                            .update({ status: 'LIVE' })
                            .eq('id', bet.id);

                        console.log(`🚀 Match ${bet.match_id} started. Moving card ${bet.id} to Tablet.`);
                    }
                }

                // If any were updated, we return the filtered list (excluding now-live matches)
                // The real-time subscription will handle the UI refresh
                setPredictions(data.filter(b => {
                    const m = liveMatches.find(lm => lm.fixture.id === b.match_id);
                    return !(m && liveStatuses.includes(m.fixture.status.short));
                }));
            } else {
                setPredictions(data || []);
            }

        } catch (err) {
            console.error('Prediction Fetch Error:', err);
            setPredictions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPredictions();
    }, [userProfile?.id, statusFilter, supabase]);

    useEffect(() => {
        if (!userProfile?.id || !supabase) return;

        const subscription = supabase
            .channel('predictions-live-sync')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'predictions',
                    filter: `user_id=eq.${userProfile.id}`
                },
                () => fetchPredictions()
            )
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [userProfile?.id, supabase]);

    return { predictions, loading, refetch: fetchPredictions };
};