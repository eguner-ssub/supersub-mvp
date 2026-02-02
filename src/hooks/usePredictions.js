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
            // EXPLICIT SCHEMA: Bypass Supabase cache by listing all columns
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
                    created_at
                `)
                .eq('user_id', userProfile.id)
                .order('created_at', { ascending: false });

            // Apply status filter
            if (statusFilter === 'PENDING') {
                query = query.eq('status', 'PENDING');
            } else if (statusFilter === 'LIVE') {
                query = query.eq('status', 'LIVE');
            } else if (statusFilter === 'SETTLED') {
                query = query.in('status', ['WON', 'LOST']);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching predictions:', error);
                setPredictions([]);
            } else {
                setPredictions(data || []);
            }
        } catch (err) {
            console.error('Exception fetching predictions:', err);
            setPredictions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPredictions();
    }, [userProfile?.id, statusFilter, supabase]);

    return { predictions, loading, refetch: fetchPredictions };
};