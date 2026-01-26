import { useEffect } from 'react';

const CRITICAL_ASSETS = [
    '/assets/bg-dressing-room.webp', // Dressing Room Background
    '/assets/manager-room.webp',     // Manager Office Background
    // Add other large assets here if needed
];

export function useAssetPreloader() {
    useEffect(() => {
        CRITICAL_ASSETS.forEach((src) => {
            const img = new Image();
            img.src = src;
            // This forces the browser to cache the image
            // even though it's not visible yet.
        });
    }, []);
}
