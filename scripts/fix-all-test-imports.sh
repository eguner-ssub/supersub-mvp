#!/bin/bash

# Comprehensive test import path fixer for feature-based architecture

echo "🔧 Applying comprehensive test import path fixes..."

cd "$(dirname "$0")/../src/tests/integration" || exit 1

# Shared Core & UI
echo "📝 Fixing shared imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from '../context/GameContext'|from '../../shared/context/GameContext'|g" \
  -e "s|from '../hooks/useGame'|from '../../shared/hooks/useGame'|g" \
  -e "s|from '../hooks/usePredictions'|from '../../shared/hooks/usePredictions'|g" \
  -e "s|from '../components/CardBase'|from '../../shared/ui/CardBase'|g" \
  -e "s|from '../components/MobileLayout'|from '../../shared/ui/MobileLayout'|g" \
  -e "s|from '../components/NavigationShell'|from '../../shared/ui/NavigationShell'|g" \
  {} \;

# vi.mock paths for shared
echo "📝 Fixing shared vi.mock paths..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|vi.mock('../context/GameContext'|vi.mock('../../shared/context/GameContext'|g" \
  -e "s|vi.mock('../hooks/useGame'|vi.mock('../../shared/hooks/useGame'|g" \
  -e "s|vi.mock('../hooks/usePredictions'|vi.mock('../../shared/hooks/usePredictions'|g" \
  -e "s|vi.mock('../components/CardBase'|vi.mock('../../shared/ui/CardBase'|g" \
  -e "s|vi.mock('../components/MobileLayout'|vi.mock('../../shared/ui/MobileLayout'|g" \
  -e "s|vi.mock('../components/NavigationShell'|vi.mock('../../shared/ui/NavigationShell'|g" \
  {} \;

# Feature: Office
echo "📝 Fixing office feature imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from '../pages/ManagerOffice'|from '../../features/office/ManagerOffice'|g" \
  -e "s|vi.mock('../pages/ManagerOffice'|vi.mock('../../features/office/ManagerOffice'|g" \
  {} \;

# Feature: Match Day
echo "📝 Fixing match-day feature imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from '../pages/MatchHub'|from '../../features/match-day/MatchHub'|g" \
  -e "s|from '../pages/MatchDetail'|from '../../features/match-day/MatchDetail'|g" \
  -e "s|from '../components/TacticalBoardCarousel'|from '../../features/match-day/TacticalBoardCarousel'|g" \
  -e "s|vi.mock('../pages/MatchHub'|vi.mock('../../features/match-day/MatchHub'|g" \
  -e "s|vi.mock('../pages/MatchDetail'|vi.mock('../../features/match-day/MatchDetail'|g" \
  -e "s|vi.mock('../components/TacticalBoardCarousel'|vi.mock('../../features/match-day/TacticalBoardCarousel'|g" \
  {} \;

# Feature: Locker Room
echo "📝 Fixing locker-room feature imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from '../pages/LockerRoom'|from '../../features/locker-room/LockerRoom'|g" \
  -e "s|from '../components/locker/ViewPending'|from '../../features/locker-room/ViewPending'|g" \
  -e "s|from '../components/locker/ViewLive'|from '../../features/locker-room/ViewLive'|g" \
  -e "s|from '../components/locker/ViewLedger'|from '../../features/locker-room/ViewLedger'|g" \
  -e "s|from '../components/locker/ViewFridge'|from '../../features/locker-room/ViewFridge'|g" \
  -e "s|from '../components/locker/ViewDeck'|from '../../features/locker-room/ViewDeck'|g" \
  -e "s|vi.mock('../pages/LockerRoom'|vi.mock('../../features/locker-room/LockerRoom'|g" \
  -e "s|vi.mock('../components/locker/ViewPending'|vi.mock('../../features/locker-room/ViewPending'|g" \
  -e "s|vi.mock('../components/locker/ViewLive'|vi.mock('../../features/locker-room/ViewLive'|g" \
  -e "s|vi.mock('../components/locker/ViewLedger'|vi.mock('../../features/locker-room/ViewLedger'|g" \
  -e "s|vi.mock('../components/locker/ViewFridge'|vi.mock('../../features/locker-room/ViewFridge'|g" \
  -e "s|vi.mock('../components/locker/ViewDeck'|vi.mock('../../features/locker-room/ViewDeck'|g" \
  {} \;

# Root files (App, pages)
echo "📝 Fixing root file imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from './App'|from '../../App'|g" \
  -e "s|from './pages/Login'|from '../../pages/Login'|g" \
  -e "s|from './pages/Dashboard'|from '../../pages/Dashboard'|g" \
  -e "s|from './pages/Onboarding'|from '../../pages/Onboarding'|g" \
  -e "s|from './pages/Account'|from '../../pages/Account'|g" \
  -e "s|from './pages/ComingSoon'|from '../../pages/ComingSoon'|g" \
  -e "s|vi.mock('./App'|vi.mock('../../App'|g" \
  -e "s|vi.mock('./pages/Login'|vi.mock('../../pages/Login'|g" \
  -e "s|vi.mock('./pages/Dashboard'|vi.mock('../../pages/Dashboard'|g" \
  -e "s|vi.mock('./pages/Onboarding'|vi.mock('../../pages/Onboarding'|g" \
  -e "s|vi.mock('./pages/Account'|vi.mock('../../pages/Account'|g" \
  -e "s|vi.mock('./pages/ComingSoon'|vi.mock('../../pages/ComingSoon'|g" \
  {} \;

# Utils
echo "📝 Fixing utils imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from '../utils/cardConfig'|from '../../utils/cardConfig'|g" \
  -e "s|vi.mock('../utils/cardConfig'|vi.mock('../../utils/cardConfig'|g" \
  {} \;

echo "✅ All test import paths updated!"
