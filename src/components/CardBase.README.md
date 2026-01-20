# CardBase Component - Quick Reference

## 🎯 What Was Built

A **state-driven betting card component** with:
- ✅ **Configuration System** (`cardConfig.js`) - Single source of truth
- ✅ **Living Component** (`CardBase.jsx`) - DOM-stable, smooth transitions
- ✅ **Test Suite** (`CardBase.test.jsx`) - 19 tests, all passing
- ✅ **Interactive Demo** (`CardBaseDemo.jsx`) - Full showcase
- ✅ **Simple Example** (`SimpleCardExample.jsx`) - Betting flow demo

---

## 📦 File Structure

```
src/
├── utils/
│   └── cardConfig.js          # Configuration (CARD_TYPES, CARD_STATES, VISUAL_CONFIG)
├── components/
│   ├── CardBase.jsx           # Main component
│   └── CardBase.test.jsx      # Test suite (19 tests)
└── pages/
    ├── CardBaseDemo.jsx       # Interactive showcase
    └── SimpleCardExample.jsx  # Simple betting flow example
```

---

## 🚀 Quick Start

### 1. Import the Component

```jsx
import CardBase from './components/CardBase';
import { CARD_TYPES, CARD_STATES } from './utils/cardConfig';
```

### 2. Use in Your Component

```jsx
<CardBase
  type={CARD_TYPES.MATCH_RESULT}
  state={CARD_STATES.DEFAULT}
  backgroundImage="/path/to/image.jpg"
  label="Match Result"
  subLabel="Home Win"
  onClick={handleClick}
/>
```

### 3. Manage State Transitions

```jsx
const [cardState, setCardState] = useState(CARD_STATES.DEFAULT);

// User clicks card
const handleClick = () => setCardState(CARD_STATES.SELECTED);

// User places bet
const placeBet = () => setCardState(CARD_STATES.PENDING);

// Match settles
const handleResult = (won) => {
  setCardState(won ? CARD_STATES.WON : CARD_STATES.LOST);
};
```

---

## 🎨 Available States

| State | Visual | Use Case |
|-------|--------|----------|
| `DEFAULT` | Gray border, no glow | Initial state, not selected |
| `SELECTED` | Blue ring, blue glow | User has selected this card |
| `PENDING` | Yellow pulse, yellow glow | Bet placed, waiting for result |
| `WON` | Green ring, bright green glow | Bet won! |
| `LOST` | Red border, red glow | Bet lost |

---

## 🎯 Available Card Types

| Type | Icon | Use Case |
|------|------|----------|
| `MATCH_RESULT` | Target 🎯 | Predict match outcome |
| `TOTAL_GOALS` | Trophy 🏆 | Predict total goals |
| `PLAYER_SCORE` | User 👤 | Predict player performance |
| `SUPERSUB` | Zap ⚡ | Special supersub card |

---

## 🧪 Test Coverage

```bash
npm test -- CardBase.test.jsx
```

**Results: 19/19 tests passing ✅**

- ✅ Rendering (3 tests)
- ✅ Icon Logic (4 tests)
- ✅ State Visual Changes (7 tests)
- ✅ User Interaction (3 tests)
- ✅ DOM Stability (2 tests)

---

## 🎬 View the Demo

```bash
npm run dev
```

Then visit:
- **Full Demo**: http://localhost:5173/card-base-demo
- **Simple Example**: http://localhost:5173/simple-card-example

---

## 🏗️ Architecture Principles

### 1. DOM Stability
**No conditional rendering** - all elements always present, only classes change.

```jsx
// ❌ BAD - Breaks transitions
{state === 'WON' && <div>Won!</div>}

// ✅ GOOD - Always present
<div className={visualConfig.wrapper}>...</div>
```

### 2. Config-Driven
**All styling from VISUAL_CONFIG** - no hardcoded classes in component.

```javascript
// cardConfig.js
VISUAL_CONFIG = {
  WON: {
    wrapper: 'border-green-500 ring-4',
    icon: 'text-green-400 drop-shadow-[...]'
  }
}
```

### 3. Smooth Transitions
**CSS-only animations** - `transition-all duration-300` on all elements.

---

## 📝 Props API

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `CARD_TYPES` | ✅ | Determines which icon to show |
| `state` | `CARD_STATES` | ✅ | Determines visual styling |
| `backgroundImage` | `string` | ✅ | URL for card background |
| `label` | `string` | ✅ | Primary text (e.g., "Match Result") |
| `subLabel` | `string` | ❌ | Secondary text (e.g., "Home Win") |
| `onClick` | `function` | ✅ | Click handler for betting logic |

---

## 🔧 Customization

### Adding a New State

1. Add to `CARD_STATES` in `cardConfig.js`:
```javascript
export const CARD_STATES = {
  // ... existing states
  LOCKED: 'LOCKED'
};
```

2. Add visual config:
```javascript
export const VISUAL_CONFIG = {
  // ... existing configs
  [CARD_STATES.LOCKED]: {
    wrapper: 'border-2 border-gray-800 ring-0',
    icon: 'text-gray-600',
    overlay: 'bg-black/70'
  }
};
```

3. Use it:
```jsx
<CardBase state={CARD_STATES.LOCKED} {...otherProps} />
```

### Adding a New Card Type

1. Add to `CARD_TYPES`:
```javascript
export const CARD_TYPES = {
  // ... existing types
  CORNER_KICK: 'CORNER_KICK'
};
```

2. Import icon and add to `TYPE_ICONS`:
```javascript
import { Flag } from 'lucide-react';

export const TYPE_ICONS = {
  // ... existing icons
  [CARD_TYPES.CORNER_KICK]: Flag
};
```

---

## ✅ Requirements Checklist

- ✅ Single Source of Truth (`cardConfig.js`)
- ✅ CARD_TYPES constant
- ✅ CARD_STATES constant
- ✅ TYPE_ICONS mapping
- ✅ VISUAL_CONFIG mapping
- ✅ DOM stability (no conditional rendering)
- ✅ Config-driven styling
- ✅ Smooth CSS transitions
- ✅ Comprehensive tests (19 tests)
- ✅ onClick handler support
- ✅ Accessibility (ARIA labels)

---

## 🎉 Summary

**All requirements met!** The CardBase component is:
- **Production-ready** with full test coverage
- **Performant** with CSS-only animations
- **Maintainable** with config-driven architecture
- **Accessible** with proper ARIA labels
- **Extensible** - easy to add new states/types

**Next Steps**: Integrate into your betting flow by replacing existing card components and wiring up the state management to your betting context.
