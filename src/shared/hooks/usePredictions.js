import { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';

export const usePredictions = (statusFilter = null) => {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { userProfile, supabase } = useGame();

    // Use a ref to keep track of the active channel across renders
    const channelRef = useRef(null);

    const fetchPredictions = async () => {
        if (!userProfile?.id || !supabase) {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            // Joined query for matches table (Scores/Status)
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

            // Status Lifecycle mapping
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

    // 1. Initial Data Load
    useEffect(() => {
        fetchPredictions();
    }, [userProfile?.id, statusFilter, supabase]);

    // 2. RESILIENT REAL-TIME SUBSCRIPTION
    useEffect(() => {
        if (!userProfile?.id || !supabase) return;

        // Cleanup any lingering channel before establishing a new one
        const cleanupChannel = async () => {
            if (channelRef.current) {
                await supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };

        const initRealtime = async () => {
            // Ensure we are starting fresh
            await cleanupChannel();

            // Create a unique channel ID based on user and filter to prevent collisions
            const channelId = `predictions-${statusFilter || 'all'}-${userProfile.id}`;

            const channel = supabase
                .channel(channelId)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'predictions',
                        filter: `user_id=eq.${userProfile.id}`
                    },
                    (payload) => {
                        console.log("⚡ Real-time update detected:", payload.new.status);
                        fetchPredictions();
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log(`📡 WebSocket established for ${channelId}`);
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error(`❌ WebSocket error on ${channelId}`);
                    }
                });

            channelRef.current = channel;
        };

        initRealtime();

        // Cleanup function for unmounting or dependency changes
        return () => {
            if (channelRef.current) {
                const currentChannel = channelRef.current;
                // We use a small timeout to allow pending connections to settle 
                // before trying to force-close them, which stops the "closed before established" error.
                setTimeout(() => {
                    if (currentChannel) {
                        supabase.removeChannel(currentChannel);
                    }
                }, 100);
            }
        };
    }, [userProfile?.id, statusFilter, supabase]);

    return { predictions, loading, refetch: fetchPredictions };
}; v