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
            // JOIN: Linking predictions to the matches table for real-time scores
            let query = supabase
                .from('predictions')
                .select(`
                    *,
                    match:matches!match_id (
                        home_score,
                        away_score,
                        status
                    )
                `)
                .eq('user_id', userProfile.id)
                .order('created_at', { ascending: false });

            // Apply filters based on the new status lifecycle
            if (statusFilter === 'SETTLED') {
                query = query.in('status', ['SETTLED', 'WON', 'LOST', 'CANCELLED']);
            } else if (statusFilter) {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;
            if (error) throw error;

            setPredictions(data || []);
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

    // REAL-TIME: Listen for DB triggers moving bets to LIVE or WON/LOST
    useEffect(() => {
        if (!userProfile?.id || !supabase) return;

        const subscription = supabase
            .channel('predictions-automated-sync')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'predictions',
                    filter: `user_id=eq.${userProfile.id}`
                },
                () => fetchPredictions() // Refetch joined data on any update
            )
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [userProfile?.id, supabase]);

    return { predictions, loading, refetch: fetchPredictions };
};