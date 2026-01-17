import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Tablet, Backpack, BookOpen, Refrigerator } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';
import ViewPending from '../components/locker/ViewPending';
import ViewLive from '../components/locker/ViewLive';
import ViewDeck from '../components/locker/ViewDeck';
import ViewLedger from '../components/locker/ViewLedger';
import ViewFridge from '../components/locker/ViewFridge';

const LockerRoom = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('pending');

    // Read tab from query params on mount
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam && ['pending', 'live', 'deck', 'ledger', 'fridge'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    const tabs = [
        { id: 'pending', label: 'Whiteboard', icon: ClipboardList, component: ViewPending, bgColor: 'bg-white' },
        { id: 'live', label: 'Tablet', icon: Tablet, component: ViewLive, bgColor: 'bg-gray-950' },
        { id: 'deck', label: 'Kit Bag', icon: Backpack, component: ViewDeck, bgColor: 'bg-gray-900' },
        { id: 'ledger', label: 'Ledger', icon: BookOpen, component: ViewLedger, bgColor: 'bg-amber-100' },
        { id: 'fridge', label: 'Fridge', icon: Refrigerator, component: ViewFridge, bgColor: 'bg-gray-900' }
    ];

    const activeTabData = tabs.find(t => t.id === activeTab) || tabs[0];
    const ActiveComponent = activeTabData.component;

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        // Update URL without navigation
        navigate(`/inventory?tab=${tabId}`, { replace: true });
    };

    return (
        <MobileLayout bgImage="/bg-locker-room.webp">
            <div className="w-full max-w-md h-full flex flex-col relative">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-black/60 backdrop-blur-md border-b border-white/10 z-10">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-bold">Back</span>
                    </button>
                    <h1 className="text-xl font-black text-white uppercase tracking-wide">Locker Room</h1>
                    <div className="w-16" /> {/* Spacer */}
                </div>

                {/* Active View */}
                <div className={`flex-1 overflow-hidden ${activeTabData.bgColor} transition-colors duration-300`}>
                    <ActiveComponent />
                </div>

                {/* Hotspot Navigation */}
                <div className="bg-black/80 backdrop-blur-md border-t border-white/10 p-4">
                    <div className="flex justify-around items-center max-w-md mx-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`flex flex-col items-center gap-1 transition-all ${isActive
                                            ? 'scale-110'
                                            : 'opacity-60 hover:opacity-100 hover:scale-105'
                                        }`}
                                >
                                    <div className={`p-3 rounded-xl transition-all ${isActive
                                            ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                                            : 'bg-gray-700 hover:bg-gray-600'
                                        }`}>
                                        <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-300'}`} />
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-emerald-400' : 'text-gray-400'
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
