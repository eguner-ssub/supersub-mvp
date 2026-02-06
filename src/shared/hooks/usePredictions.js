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
            // Fetching explicit columns to ensure data consistency
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

            // Apply existing status filters for UI tabs
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

    // 1. Initial Data Fetch
    useEffect(() => {
        fetchPredictions();
    }, [userProfile?.id, statusFilter, supabase]);

    // 2. REAL-TIME SUBSCRIPTION
    useEffect(() => {
        if (!userProfile?.id || !supabase) return;

        // Create a channel to listen for database changes specifically for this user
        const subscription = supabase
            .channel('public:predictions_updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE', // Listen for status transitions (e.g., LIVE -> WON)
                    schema: 'public',
                    table: 'predictions',
                    filter: `user_id=eq.${userProfile.id}`
                },
                (payload) => {
                    // When the settlement script updates a row, refresh the local state
                    console.log("📡 Real-time settlement update received:", payload);
                    fetchPredictions();
                }
            )
            .subscribe();

        // Cleanup subscription on unmount
        return () => {
            supabase.removeChannel(subscription);
        };
    }, [userProfile?.id, supabase]);

    return { predictions, loading, refetch: fetchPredictions };
};