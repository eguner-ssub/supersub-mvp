import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext';

export const usePredictions = (statusFilter = null) => {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { userProfile, supabase } = useGame();

    // REF: Tracks the active channel to prevent stale cleanup calls
    const channelRef = useRef(null);

    // WRAPPED IN USECALLBACK: Prevents infinite re-renders when used in useEffect
    const fetchPredictions = useCallback(async () => {
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
    }, [userProfile?.id, statusFilter, supabase]);

    // 1. Initial Data Fetch
    useEffect(() => {
        fetchPredictions();
    }, [fetchPredictions]);

    // 2. ROBUST REAL-TIME SUBSCRIPTION
    useEffect(() => {
        if (!userProfile?.id || !supabase) return;

        // Cleanup helper to remove existing channels safely
        const cleanupChannel = async () => {
            if (channelRef.current) {
                const oldChannel = channelRef.current;
                channelRef.current = null;
                await supabase.removeChannel(oldChannel);
            }
        };

        const initRealtime = async () => {
            // Ensure we start with a clean slate
            await cleanupChannel();

            // Unique channel ID per user/filter to avoid collisions
            const channelId = `predictions-${statusFilter || 'all'}-${userProfile.id}`;

            const channel = supabase
                .channel(channelId)
                .on(
                    'postgres_changes',
                    {
                        event: '*', // Listen for INSERT, UPDATE, DELETE
                        schema: 'public',
                        table: 'predictions',
                        filter: `user_id=eq.${userProfile.id}`
                    },
                    (payload) => {
                        console.log("⚡ [Realtime] Update detected:", payload.eventType);
                        // Refresh the data to get the new scores/status from the join
                        fetchPredictions();
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log(`📡 Connected to channel: ${channelId}`);
                    }
                });

            channelRef.current = channel;
        };

        initRealtime();

        // CLEANUP: Prevents "WebSocket closed" error by adding a safety check
        return () => {
            if (channelRef.current) {
                const activeChannel = channelRef.current;
                // Small timeout allows pending handshakes to finish before closing
                // This fixes the "closed before established" console error
                setTimeout(() => {
                    if (activeChannel) {
                        supabase.removeChannel(activeChannel);
                    }
                }, 100);
            }
        };
    }, [userProfile?.id, statusFilter, supabase, fetchPredictions]);

    return { predictions, loading, refetch: fetchPredictions };
};