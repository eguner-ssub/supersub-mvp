import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Tablet, Trophy, ArrowLeft } from 'lucide-react';
import MobileLayout from '../../shared/ui/MobileLayout';
import { usePredictions } from '../../shared/hooks/usePredictions';
import { useGame } from '../../shared/context/GameContext';
import ViewPendingGrid from './ViewPendingGrid';
import ViewLive from './ViewLive';
import ViewTrophyCabinet from './ViewTrophyCabinet';


const LockerRoom = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('whiteboard');

    const { predictions: pendingBets } = usePredictions('PENDING');
    const { predictions: liveBets }    = usePredictions('LIVE');

    const { unseenSettlements, markPredictionsSeen } = useGame();
    const newWinsCount = unseenSettlements.filter(p => p.settled_status === 'WON').length;

    // Read tab from query params on mount
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam && ['whiteboard', 'tablet', 'cabinet'].includes(tabParam)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    // Mark all unseen WON predictions as seen when entering the Cabinet tab.
    // Covers both handler taps and direct URL deep-links (?tab=cabinet).
    useEffect(() => {
        if (activeTab !== 'cabinet') return;
        const winIds = unseenSettlements
            .filter(p => p.settled_status === 'WON')
            .map(p => p.id);
        if (winIds.length > 0) markPredictionsSeen(winIds);
    }, [activeTab, unseenSettlements, markPredictionsSeen]);

    const tabs = [
        { id: 'whiteboard', label: 'Whiteboard', icon: ClipboardList, component: ViewPendingGrid },
        { id: 'tablet',     label: 'Tablet',     icon: Tablet,        component: ViewLive },
        { id: 'cabinet',    label: 'Cabinet',    icon: Trophy,        component: ViewTrophyCabinet },
    ];

    const activeTabData = tabs.find(t => t.id === activeTab) || tabs[0];
    const ActiveComponent = activeTabData.component;

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        navigate(`/predictions?tab=${tabId}`, { replace: true });
    };

    return (
        <MobileLayout>
            <div className="h-[100dvh] w-full flex flex-col bg-[#0D0D0D] overflow-hidden">
                {/* Fixed top header */}
                <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-black/80 backdrop-blur-md border-b border-white/10 flex items-center px-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-9 h-9 flex-shrink-0 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="flex-1 text-center text-[11px] font-black uppercase tracking-widest text-white">
                        {activeTabData.label}
                    </span>
                    {/* Spacer to balance the back button and keep label truly centred */}
                    <div className="w-9 h-9 flex-shrink-0" />
                </div>

                {/* Active View - Scrollable Content */}
                <div className={`flex-1 overflow-y-auto scrollbar-hide pb-32 pt-14 ${
                    activeTab === 'cabinet' ? 'bg-transparent' : 'bg-[#0D0D0D]'
                }`}>
                    <div className="relative z-10">
                        <ActiveComponent />
                    </div>
                </div>

                {/* Hotspot Navigation - Fixed */}
                <div
                    className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-t border-white/10"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                >
                    <div className="flex justify-around items-center max-w-md mx-auto py-4">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            const badgeCount =
                                tab.id === 'whiteboard' ? pendingBets.length :
                                tab.id === 'tablet'     ? liveBets.length :
                                tab.id === 'cabinet'    ? newWinsCount :
                                0;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`flex flex-col items-center gap-1 transition-all relative ${
                                        isActive ? 'scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'
                                    }`}
                                >
                                    <div className={`relative p-3 rounded-xl transition-all ${
                                        isActive
                                            ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                                            : 'bg-gray-700 hover:bg-gray-600'
                                    }`}>
                                        <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-300'}`} />
                                        {badgeCount > 0 && (
                                            <div className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 ${
                                                tab.id === 'cabinet' ? 'bg-emerald-500' : 'bg-red-500'
                                            }`}>
                                                <span className="text-[9px] font-black text-white leading-none">
                                                    {badgeCount > 99 ? '99+' : badgeCount}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${
                                        isActive ? 'text-emerald-400' : 'text-gray-400'
                                    }`}>
                                        {tab.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </MobileLayout>
    );
};

export default LockerRoom;
