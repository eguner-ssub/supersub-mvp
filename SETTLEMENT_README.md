# Settlement Engine & Cron Job - Quick Reference

## 🎯 What Was Built

### 1. **Settlement Engine** (`src/utils/settlementEngine.js`)
Pure utility function for DRY bet calculation:
- ✅ `calculateBetResult()` - Calculate WON/LOST/VOID
- ✅ `calculateBatchResults()` - Process multiple bets
- ✅ `isMatchFinished()` - Check if match complete
- ✅ `shouldVoidMatch()` - Check if should void
- ✅ **46/46 tests passing**

### 2. **Cron Job** (`api/cron/resolve-zombies.js`)
Automated zombie bet resolver:
- ✅ Authorization via Bearer token
- ✅ Quota safety (MAX_FIXTURES_PER_RUN = 5)
- ✅ Comprehensive error handling
- ✅ Atomic balance updates

### 3. **GameContext Refactor**
- ✅ Removed inline `determineOutcome` function
- ✅ Now uses DRY `calculateBetResult` utility
- ✅ All existing tests still pass (6/6)

---

## 📦 Files Created

```
src/utils/
├── settlementEngine.js          # Pure bet calculation logic
└── settlementEngine.test.js     # 46 comprehensive tests

api/cron/
└── resolve-zombies.js           # Serverless cron job

Modified:
├── src/context/GameContext.jsx  # Refactored to use DRY utility
├── vercel.json                  # Added cron configuration
└── .env.local                   # Added CRON_SECRET
```

---

## 🚀 Quick Start

### Test Settlement Engine
```bash
npm test -- settlementEngine.test.js --run
# Result: 46/46 tests passing ✅
```

### Test Cron Job Locally
```bash
# Start vercel dev server
vercel dev

# Test endpoint (in new terminal)
curl -X POST http://localhost:3000/api/cron/resolve-zombies \
  -H "Authorization: Bearer GRinEnfkj8vPu1UniR3y5bJ2pLISGZffOnUdKVk/NtQ="
```

### Deploy to Production
```bash
# 1. Add CRON_SECRET to Vercel
vercel env add CRON_SECRET
# Paste: GRinEnfkj8vPu1UniR3y5bJ2pLISGZffOnUdKVk/NtQ=
# Select: Production

# 2. Deploy
vercel --prod
```

---

## 🔧 Configuration

### Cron Schedule
**Current**: Every 6 hours (`0 */6 * * *`)
**Location**: `vercel.json`

### Quota Limit
**Current**: 5 fixtures per run
**Location**: `api/cron/resolve-zombies.js` line 18

### Zombie Threshold
**Current**: 4 hours
**Location**: `api/cron/resolve-zombies.js` line 19

---

## 📊 API Response

```json
{
  "success": true,
  "processed_fixtures": 3,
  "settled_bets": 12,
  "skipped_fixtures": 2,
  "total_zombies_found": 15,
  "duration_ms": 1234,
  "timestamp": "2026-01-20T10:00:00.000Z"
}
```

---

## ✅ Production Checklist

Before deploying:
- [x] Settlement engine tests passing (46/46)
- [x] GameContext refactored
- [x] Cron job created with authorization
- [x] Quota safety implemented (MAX_FIXTURES_PER_RUN = 5)
- [x] Environment variable added locally
- [ ] **Add CRON_SECRET to Vercel production**
- [ ] Deploy to production
- [ ] Monitor cron job execution
- [ ] Verify zombie bets decreasing

---

## 📝 Next Steps

1. **Deploy**: `vercel --prod`
2. **Add Secret**: Add `CRON_SECRET` to Vercel dashboard
3. **Monitor**: Check Vercel logs for cron execution
4. **Extend**: Add PLAYER_SCORE and SUPERSUB bet types

---

## 🎉 Summary

**Implemented**:
- ✅ DRY settlement engine (46 tests)
- ✅ Serverless cron job with quota safety
- ✅ Authorization and error handling
- ✅ Atomic balance updates
- ✅ Comprehensive documentation

**Benefits**:
- 🎯 Single source of truth for settlement logic
- 🔒 Secure with Bearer token auth
- 🛡️ Safe with quota limits (5 fixtures/run)
- 🚀 Automated (runs every 6 hours)
- 📊 Monitored with comprehensive logging

**Ready for production!** 🚀
