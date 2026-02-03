#!/bin/bash

# Script to update import paths in all test files after refactoring

echo "🔧 Updating test file import paths..."

# Navigate to integration tests directory
cd "$(dirname "$0")/../src/tests/integration" || exit 1

# Update imports for feature files
echo "📝 Updating feature imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from '../pages/ManagerOffice'|from '../../features/office/ManagerOffice'|g" \
  -e "s|from '../pages/MatchHub'|from '../../features/match-day/MatchHub'|g" \
  -e "s|from '../pages/MatchDetail'|from '../../features/match-day/MatchDetail'|g" \
  -e "s|from '../pages/LockerRoom'|from '../../features/locker-room/LockerRoom'|g" \
  -e "s|from '../components/TacticalBoardCarousel'|from '../../features/match-day/TacticalBoardCarousel'|g" \
  {} \;

# Update imports for shared components
echo "📝 Updating shared component imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from '../components/CardBase'|from '../../shared/ui/CardBase'|g" \
  -e "s|from '../components/MobileLayout'|from '../../shared/ui/MobileLayout'|g" \
  -e "s|from '../components/NavigationShell'|from '../../shared/ui/NavigationShell'|g" \
  {} \;

# Update imports for shared context
echo "📝 Updating context imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from '../context/GameContext'|from '../../shared/context/GameContext'|g" \
  {} \;

# Update App.jsx imports
echo "📝 Updating App imports..."
find . -name "*.test.jsx" -type f -exec sed -i '' \
  -e "s|from '../App'|from '../../App'|g" \
  {} \;

echo "✅ Test import paths updated successfully!"
