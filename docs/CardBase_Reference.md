# CardBase Component - Quick Reference

## Import

```javascript
import CardBase from '../components/CardBase';
import { getCardConfig } from '../utils/cardConfig';
```

## Basic Usage

```javascript
// Get card configuration
const config = getCardConfig('c_match_result');

// Render card
<CardBase 
  rarity={config.rarity}    // 'common' | 'rare' | 'legendary'
  role={config.role}        // 'match_result' | 'total_goals' | 'player_score' | 'supersub'
  label={config.label}      // Display name
  className="w-20 h-28"     // Additional Tailwind classes
/>
```

## Card Configuration Map

```javascript
CARD_CONFIG = {
  c_match_result: {
    rarity: 'rare',
    role: 'match_result',
    label: 'Match Result'
  },
  c_total_goals: {
    rarity: 'common',
    role: 'total_goals',
    label: 'Total Goals'
  },
  c_player_score: {
    rarity: 'legendary',
    role: 'player_score',
    label: 'Player Score'
  },
  c_supersub: {
    rarity: 'legendary',
    role: 'supersub',
    label: 'Super Sub'
  }
}
```

## Migration Pattern

### Before (Static PNG):
```javascript
const cardTypes = [
  { id: 'c_match_result', label: 'Match Result', img: '/cards/card_match_result.webp' }
];

<img 
  src={card.img} 
  alt={card.label}
  className="w-full h-full object-contain"
/>
```

### After (Pure CSS/SVG):
```javascript
import CardBase from '../components/CardBase';
import { getCardConfig } from '../utils/cardConfig';

const config = getCardConfig(card.id);

<CardBase 
  rarity={config.rarity} 
  role={config.role} 
  label={config.label}
  className="w-full h-full"
/>
```

## Styling Utilities

```javascript
import { getCardStyles, getRoleIcon } from '../components/CardBase';

// Get Tailwind classes for a rarity tier
const styles = getCardStyles('legendary');
// Returns: { border, shadow, bg, gradient, iconBg, iconColor, ... }

// Get Lucide icon component for a role
const Icon = getRoleIcon('match_result');
// Returns: Target (Lucide component)
```

## Rarity Tiers

| Rarity | Color Theme | Use Case |
|--------|-------------|----------|
| `common` | Gray | Basic cards, high availability |
| `rare` | Blue | Medium-tier cards, moderate availability |
| `legendary` | Gold | Premium cards, low availability |

## Role Icons

| Role | Icon | Visual |
|------|------|--------|
| `match_result` | Target | 🎯 |
| `total_goals` | Flame | 🔥 |
| `player_score` | User | 👤 |
| `supersub` | Zap | ⚡ |

## Advanced Customization

```javascript
// Override default styles
<CardBase 
  rarity="legendary"
  role="supersub"
  label="Super Sub"
  className="w-32 h-40 hover:scale-110 transition-transform"
/>

// Conditional rarity based on game state
const rarity = userLevel > 10 ? 'legendary' : 'rare';
<CardBase rarity={rarity} role="match_result" label="Match Result" />
```

## Performance Notes

- ✅ **Zero HTTP requests** (no image downloads)
- ✅ **Instant rendering** (pure CSS)
- ✅ **Scalable** (SVG icons, no pixelation)
- ✅ **Themeable** (Tailwind tokens, easy to customize)
- ✅ **Accessible** (semantic HTML, proper labels)

## Common Patterns

### Card Grid Display
```javascript
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {cardTypes.map((card) => {
    const config = getCardConfig(card.id);
    return (
      <CardBase 
        key={card.id}
        rarity={config.rarity}
        role={config.role}
        label={config.label}
      />
    );
  })}
</div>
```

### Interactive Card Selection
```javascript
<button
  onClick={() => handleCardSelect(card.id)}
  className={`${isSelected ? 'ring-4 ring-yellow-400' : ''}`}
>
  <CardBase 
    rarity={config.rarity}
    role={config.role}
    label={config.label}
  />
</button>
```

### Conditional Styling (Inactive Cards)
```javascript
<div className={`${!isActive ? 'opacity-40 grayscale' : ''}`}>
  <CardBase 
    rarity={config.rarity}
    role={config.role}
    label={config.label}
  />
</div>
```

## Troubleshooting

**Issue**: Card not displaying
- ✅ Check that `rarity` and `role` are valid strings
- ✅ Verify `getCardConfig()` returns expected values
- ✅ Ensure parent container has defined dimensions

**Issue**: Icons not showing
- ✅ Verify Lucide-React is installed: `npm list lucide-react`
- ✅ Check that `role` matches icon map keys

**Issue**: Colors look wrong
- ✅ Ensure Tailwind CSS is processing the component
- ✅ Check that `rarity` is one of: 'common', 'rare', 'legendary'
