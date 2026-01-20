# GodModePanel - Developer Tool Guide

## 🎯 What It Does

A floating action button (FAB) that allows you to manually trigger backend maintenance tasks from the UI during development.

## 🚀 Quick Start

1. **Open your app** in development mode (`npm run dev`)
2. **Look for the purple wrench icon** in the bottom-right corner
3. **Click it** to open the God Mode Panel
4. **Click "FORCE JANITOR RUN"**
5. **Enter your CRON_SECRET** when prompted (from `.env.local`)
6. **Watch the magic happen!** ✨

## 📍 Location

The panel is accessible on **every page** of your app during development.

## 🔐 CRON_SECRET

Your current secret (from `.env.local`):
```
GRinEnfkj8vPu1UniR3y5bJ2pLISGZffOnUdKVk/NtQ=
```

## ✅ Expected Response

**Success** (200 OK):
```
🎉 Janitor Run Complete!
✅ Processed: 3 fixtures
💰 Settled: 12 bets
⏭️  Skipped: 2 fixtures
🧟 Total zombies: 15
⏱️  Duration: 1234ms
```

**Unauthorized** (401):
```
🔒 Unauthorized
Check your CRON_SECRET in .env.local
```

**Server Error** (500):
```
💥 Server Error
[Error message from server]
```

## 🛡️ Safety Features

- ✅ **Development Only**: Automatically hidden in production
- ✅ **Authorization Required**: Must enter CRON_SECRET
- ✅ **Loading State**: Shows spinner while running
- ✅ **Comprehensive Feedback**: Toast notifications for all outcomes
- ✅ **Console Logging**: Detailed logs in browser console

## 🎨 Features

### Visual Design
- Purple gradient FAB with wrench icon
- Smooth animations and transitions
- Dark theme panel with backdrop blur
- Clear visual hierarchy

### User Experience
- Click FAB to open/close panel
- Prompt for authorization
- Loading spinner during execution
- Toast notifications for feedback
- Auto-closes after execution

### Developer Experience
- Console logs for debugging
- Detailed response information
- Error messages with context
- Quick access from any page

## 📝 Integration

**File**: `src/App.jsx`

```javascript
import GodModePanel from './components/GodModePanel';

function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <AppRoutes />
        {/* Developer Tools - Only visible in development */}
        <GodModePanel />
      </GameProvider>
    </BrowserRouter>
  );
}
```

## 🔧 Customization

### Change Position
```javascript
// In GodModePanel.jsx
<div className="fixed bottom-6 right-6 z-50">
// Change to: top-6 left-6 for top-left
```

### Change Icon
```javascript
// Import different icon
import { Shield, Settings, Zap } from 'lucide-react';

// Use in button
<Shield className="w-6 h-6 text-white" />
```

### Add More Actions
```javascript
// In the panel, add new buttons:
<button onClick={handleOtherAction}>
  🔄 OTHER ACTION
</button>
```

## 🚫 Production Safety

The panel is **automatically hidden** in production:

```javascript
if (import.meta.env.MODE !== 'development') {
  return null;
}
```

This ensures it will **never** appear in your deployed app.

## 🐛 Troubleshooting

### Panel Not Showing
- ✅ Check you're in development mode (`npm run dev`)
- ✅ Check browser console for errors
- ✅ Verify `GodModePanel` is imported in `App.jsx`

### Authorization Failing
- ✅ Check `CRON_SECRET` in `.env.local`
- ✅ Copy/paste the secret (no extra spaces)
- ✅ Restart dev server after changing `.env.local`

### No Response
- ✅ Check Vercel dev server is running (`vercel dev`)
- ✅ Check browser console for network errors
- ✅ Verify `/api/cron/resolve-zombies` endpoint exists

## 📊 Example Usage

1. **Navigate to Dashboard** (or any page)
2. **Click purple wrench** in bottom-right
3. **Click "FORCE JANITOR RUN"**
4. **Enter secret**: `GRinEnfkj8vPu1UniR3y5bJ2pLISGZffOnUdKVk/NtQ=`
5. **Wait for response** (usually 1-5 seconds)
6. **Check toast notification** for results

## 🎉 Benefits

- ✅ **No curl commands** needed
- ✅ **No Vercel Dashboard** navigation
- ✅ **Instant feedback** via toasts
- ✅ **Always accessible** during development
- ✅ **Safe** - hidden in production

---

**Enjoy your new superpower!** 🦸‍♂️
