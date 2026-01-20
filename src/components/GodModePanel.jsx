import React, { useState } from 'react';
import { Wrench, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * GodModePanel - Developer-Only Admin Tool
 * 
 * Floating action button that allows manual triggering of backend maintenance tasks.
 * Only visible in development mode.
 * 
 * Features:
 * - Manual cron job execution
 * - Authorization via CRON_SECRET
 * - Real-time feedback via toasts
 * 
 * @component
 */
const GodModePanel = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Only show in development
    if (import.meta.env.MODE !== 'development') {
        return null;
    }

    /**
     * Trigger the zombie bet resolver cron job
     */
    const handleForceJanitorRun = async () => {
        // Prompt for CRON_SECRET
        const secret = window.prompt(
            '🔐 Enter CRON_SECRET to authorize:\n\n(Found in .env.local)',
            ''
        );

        if (!secret) {
            toast.error('❌ Authorization cancelled');
            return;
        }

        setIsLoading(true);

        try {
            console.log('🧹 [GodMode] Triggering Janitor Run...');

            const response = await fetch('/api/cron/resolve-zombies', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${secret}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            // Handle different response codes
            if (response.status === 200 && data.success) {
                console.log('✅ [GodMode] Janitor run successful:', data);

                toast.success('🎉 Janitor Run Complete!', {
                    description: `
            ✅ Processed: ${data.processed_fixtures} fixtures
            💰 Settled: ${data.settled_bets} bets
            ⏭️  Skipped: ${data.skipped_fixtures} fixtures
            🧟 Total zombies: ${data.total_zombies_found}
            ⏱️  Duration: ${data.duration_ms}ms
          `.trim(),
                    duration: 8000
                });
            } else if (response.status === 401 || response.status === 403) {
                console.error('❌ [GodMode] Unauthorized:', data);

                toast.error('🔒 Unauthorized', {
                    description: 'Check your CRON_SECRET in .env.local',
                    duration: 5000
                });
            } else if (response.status === 500) {
                console.error('❌ [GodMode] Server error:', data);

                toast.error('💥 Server Error', {
                    description: data.message || data.error || 'Unknown error',
                    duration: 5000
                });
            } else {
                console.warn('⚠️ [GodMode] Unexpected response:', data);

                toast.warning('⚠️ Unexpected Response', {
                    description: JSON.stringify(data, null, 2),
                    duration: 5000
                });
            }

        } catch (error) {
            console.error('❌ [GodMode] Request failed:', error);

            toast.error('💥 Request Failed', {
                description: error.message || 'Network error',
                duration: 5000
            });
        } finally {
            setIsLoading(false);
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <div className="fixed bottom-6 right-6 z-50">
                {!isOpen ? (
                    // FAB - Closed State
                    <button
                        onClick={() => setIsOpen(true)}
                        className="
              w-14 h-14 rounded-full
              bg-gradient-to-br from-purple-600 to-purple-800
              hover:from-purple-500 hover:to-purple-700
              shadow-lg hover:shadow-xl
              transition-all duration-200
              flex items-center justify-center
              group
              border-2 border-purple-400/30
            "
                        title="God Mode Panel (Dev Only)"
                    >
                        <Wrench className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
                    </button>
                ) : (
                    // Panel - Open State
                    <div className="
            bg-gray-900/95 backdrop-blur-md
            rounded-xl shadow-2xl
            border-2 border-purple-500/30
            p-4 w-72
            animate-in slide-in-from-bottom-2 duration-200
          ">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Wrench className="w-5 h-5 text-purple-400" />
                                <h3 className="text-sm font-bold text-white">God Mode Panel</h3>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="
                  p-1 rounded-md
                  hover:bg-gray-800
                  transition-colors
                "
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>

                        {/* Dev Badge */}
                        <div className="mb-3 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400 text-center">
                            🚧 Development Only
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            {/* Force Janitor Run */}
                            <button
                                onClick={handleForceJanitorRun}
                                disabled={isLoading}
                                className="
                  w-full px-4 py-3
                  bg-gradient-to-r from-red-600 to-red-700
                  hover:from-red-500 hover:to-red-600
                  disabled:from-gray-700 disabled:to-gray-800
                  text-white font-bold text-sm
                  rounded-lg
                  transition-all duration-200
                  shadow-md hover:shadow-lg
                  disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                "
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Running Janitor...
                                    </>
                                ) : (
                                    <>
                                        🧹 FORCE JANITOR RUN
                                    </>
                                )}
                            </button>

                            {/* Info */}
                            <div className="text-xs text-gray-500 text-center mt-2">
                                Manually trigger zombie bet settlement
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-4 pt-3 border-t border-gray-800">
                            <div className="text-xs text-gray-600 space-y-1">
                                <div>• Requires CRON_SECRET</div>
                                <div>• Max 5 fixtures per run</div>
                                <div>• Check console for logs</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default GodModePanel;
