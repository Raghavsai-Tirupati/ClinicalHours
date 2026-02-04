# 🚀 Production Deployment Instructions

## Problem
The admin dashboard may show errors if the database migrations haven't been applied to production. This includes:
- "Failed to fetch guest session stats"
- Analytics tracking not working
- Missing user profile access for admins

## Solution - 3 Steps

### Step 1: Apply Database Migration

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/sysbtcikrbrrgafffody
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `DEPLOY_TO_PRODUCTION.sql`
5. Paste it into the SQL editor
6. Click **Run** (or press Ctrl+Enter)
7. You should see "Success. No rows returned"

### Step 2: Redeploy Edge Functions (if needed)

If you've made changes to edge functions, redeploy them:

```bash
# Option 1: Via Supabase CLI (if installed)
supabase functions deploy

# Option 2: Via GitHub (if you have CI/CD set up)
# Just push to main - it should auto-deploy

# Option 3: Manual deploy via dashboard
# Go to Edge Functions in Supabase dashboard and redeploy each function
```

### Step 3: Verify It's Working

1. Go to https://clinicalhours.org/admin
2. Click on the **Analytics** tab
3. You should now see:
   - Guest session counts (may be 0 if no guests have visited yet)
   - No error messages
   - Working charts

4. To test guest sessions:
   - Open an incognito window
   - Go to https://clinicalhours.org
   - Click "Continue as Guest"
   - Go back to admin dashboard and refresh
   - You should see the count increase

## What This Fixes

✅ Tracking events table for analytics (page views, user interactions)
✅ Guest session analytics will now work  
✅ Admin can view all user profiles  
✅ No more "Failed to fetch" errors  
✅ Users tab will populate correctly  

## Troubleshooting

**Still seeing errors?**
- Check the browser console (F12) for detailed error messages
- Verify you're logged in as an admin user
- Make sure the SQL ran successfully (no error messages)

**Guest count not increasing?**
- Test in incognito mode
- Check browser console for "Guest session logged successfully"
- Verify the guest_sessions table has data: `SELECT * FROM guest_sessions LIMIT 10;`

**Need help?**
- Check Supabase logs in the dashboard
- Run the verification queries at the bottom of `DEPLOY_TO_PRODUCTION.sql`
