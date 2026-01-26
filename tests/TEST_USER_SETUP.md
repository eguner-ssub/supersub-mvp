# Test User Setup Guide

## Required Test User

Before running Playwright E2E tests, you must create a test user in Supabase.

### Credentials
- **Email**: `test@supersub.com`
- **Password**: `TestPassword123!`

---

## Setup Instructions

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Users**
3. Click **Add User** → **Create new user**
4. Fill in:
   - Email: `test@supersub.com`
   - Password: `TestPassword123!`
   - Auto Confirm User: ✅ (check this box)
5. Click **Create user**

### Option 2: Via Signup Flow

1. Start the app: `npm run dev`
2. Navigate to `/signup`
3. Create account with:
   - Email: `test@supersub.com`
   - Password: `TestPassword123!`
4. Complete onboarding if required

### Option 3: Via Supabase SQL Editor

```sql
-- Insert test user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@supersub.com',
  crypt('TestPassword123!', gen_salt('bf')),
  now(),
  '',
  now(),
  now()
);
```

---

## Verification

### Test the Login
1. Navigate to `/login`
2. Enter credentials:
   - Email: `test@supersub.com`
   - Password: `TestPassword123!`
3. Verify successful login and redirect to dashboard/manager-office

### Run E2E Tests
```bash
npx playwright test
```

**Expected Result**: All tests should pass ✅

---

## Troubleshooting

### Issue: "User not found"
**Solution**: Create the user in Supabase (see Setup Instructions above)

### Issue: "Invalid password"
**Solution**: Verify password is exactly `TestPassword123!` (case-sensitive)

### Issue: "Email not confirmed"
**Solution**: In Supabase dashboard, check "Auto Confirm User" when creating

### Issue: Tests still fail after login
**Solution**: Check that user has completed onboarding (has `club_name` set)

---

## Test User Maintenance

### Reset Test Data
If the test user's data becomes corrupted:

1. Delete user from Supabase
2. Recreate using instructions above
3. Re-run onboarding if needed

### Update Credentials
If you need different credentials, update `tests/helpers/auth.ts`:

```typescript
const TEST_USER = {
  email: 'your-test-email@example.com',
  password: 'YourPassword123!',
};
```
