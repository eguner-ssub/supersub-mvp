import React, { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Shirt } from 'lucide-react';

export default function NavigationShell({ children }) {
    const location = useLocation();
    const navigate = useNavigate();

    // GESTURE PHYSICS
    const touchStart = useRef(null);
    const touchEnd = useRef(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        touchEnd.current = null;
        touchStart.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e) => {
        touchEnd.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = () => {
        if (!touchStart.current || !touchEnd.current) return;
        const distance = touchStart.current - touchEnd.current;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        // LOGIC: Dressing Room (/dashboard) <-> Office (/manager-office)
        if (location.pathname === '/dashboard' && isLeftSwipe) {
            navigate('/manager-office');
        }
        if (location.pathname === '/manager-office' && isRightSwipe) {
            navigate('/dashboard');
        }
    };

    // ACTIVE STATE
    const isOffice = location.pathname === '/manager-office';
    const isDressingRoom = location.pathname === '/dashboard';

    return (
        <div
            className="w-full h-[100dvh] relative overflow-hidden bg-black"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* 1. VIEWPORT (The Page Content) */}
            <div className="w-full h-full">
                {children}
            </div>

            {/* 2. NAVIGATION DOCK (Z-50) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[360px]">
                <div className="flex items-center justify-between bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl">

                    {/* TAB 1: MANAGER OFFICE (Landing) */}
                    <button
                        onClick={() => navigate('/manager-office')}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 active:scale-95 ${isOffice
                            ? 'bg-white/10 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Office</span>
                    </button>

                    {/* DIVIDER */}
                    <div className="w-px h-8 bg-white/10 mx-2 opacity-20"></div>

                    {/* TAB 2: DRESSING ROOM */}
                    <button
                        onClick={() => navigate('/dashboard')}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 active:scale-95 ${isDressingRoom
                            ? 'bg-white/10 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <Shirt className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Dressing Room</span>
                    </button>

                </div>
            </div>
        </div>
    );
}
