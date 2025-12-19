# 🚀 OAuth Integration - Deployment Checklist

## ✅ Completed Steps (1-10)

- [x] Step 1-6: OAuth foundation (migrations, services, middleware)
- [x] Step 7: Automation orchestration (per-user execution)
- [x] Step 8: Campaign routes (per-user filtering)
- [x] Step 9: Automation routes (user-specific triggers)
- [x] Step 10: Testing & migration script

**Commits pushed:**
- `fa916a5` - OAuth integration foundation (Step 1-6/11)
- `dbeef78` - OAuth integration orchestration (Step 7-9/11)
- `1cdded5` - TypeScript compilation errors fixed
- `eb2845c` - Migration runner script added

---

## 📋 Step 11: Production Deployment

### 1. Verify Render Deployment

**Check:** https://dashboard.render.com/

1. Go to your Render dashboard
2. Find your `amazon-ads-manager` service
3. Verify the deployment is in progress or completed
4. Check build logs for any errors
5. Wait for "Live" status

**Expected:** Build should complete successfully with TypeScript compilation

---

### 2. Run Database Migrations

Once the deployment is live, connect to Render shell:

```bash
# Option A: Via Render Dashboard
# 1. Go to your service in Render dashboard
# 2. Click "Shell" tab
# 3. Run: npm run migrate

# Option B: Via Render CLI (if installed)
render shell <your-service-name>
npm run migrate
```

**Expected output:**
```
✅ Connected to database
📁 Found X migration files

⚙️  Running 006_add_oauth_to_users.sql...
   ✅ 006_add_oauth_to_users.sql completed

⚙️  Running 007_add_user_to_campaigns.sql...
   ✅ 007_add_user_to_campaigns.sql completed

🎉 All migrations completed successfully!

✅ OAuth columns verified:
   - amazon_user_id
   - access_token
   - refresh_token
   - profile_id
✅ campaigns.user_id column verified
```

---

### 3. Verify Environment Variables

Ensure these are set in Render environment variables:

**Required OAuth variables:**
- `AMAZON_ADS_CLIENT_ID` - Your Amazon Ads API Client ID
- `AMAZON_ADS_CLIENT_SECRET` - Your Amazon Ads API Client Secret
- `AMAZON_OAUTH_REDIRECT_URI` - Should be `https://your-domain.onrender.com/api/auth/amazon/callback`
- `JWT_SECRET` - Secret for JWT tokens
- `FRONTEND_URL` - Your frontend URL (for redirects)

**Existing variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV=production`
- `PORT` - Should be set to 3000 or 10000

---

### 4. Test OAuth Flow in Production

1. **Navigate to your app:** `https://your-domain.onrender.com`

2. **Test Login:**
   - Click "Connect with Amazon" button
   - Should redirect to Amazon OAuth page
   - Login with your Amazon Seller account
   - Should redirect back and save tokens

3. **Verify user in database:**
```sql
SELECT
  id,
  email,
  amazon_user_id,
  profile_id,
  country_code,
  is_active,
  token_expires_at
FROM users
WHERE amazon_user_id IS NOT NULL;
```

4. **Test campaign sync:**
   - Go to Campaigns page
   - Click "Sync from Amazon"
   - Verify campaigns are imported and associated with your user

---

### 5. Test Per-User Automation

1. **Manual trigger:**
```bash
# In Render shell or via API
curl -X POST https://your-domain.onrender.com/api/automation/trigger-user \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. **Check logs:**
```
🤖 Running automations for user <user-id>...
📊 Found X active campaigns for user <user-id>
✅ Completed automations for user <user-id>
```

3. **Verify global trigger still works:**
```bash
# Should run automations for ALL users
curl -X POST https://your-domain.onrender.com/api/automation/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected output:
```
👥 Found 2 active users with Amazon authentication
🤖 Running automations for user xxx...
🤖 Running automations for user yyy...
✅ GLOBAL AUTOMATION SUMMARY
   Total users: 2
   Success: 2
   Errors: 0
```

---

### 6. Monitor for Issues

**Check these in production:**

1. **Token refresh works:**
   - Wait 1 hour (access tokens expire)
   - Trigger automation or make API call
   - Should auto-refresh tokens
   - Check logs for "Refreshing access token..."

2. **User isolation works:**
   - Create a second test user
   - Import campaigns for both users
   - Verify each user only sees their own campaigns
   - Run automations - each user should only affect their campaigns

3. **Error handling:**
   - Test with expired/invalid tokens
   - Should mark user as inactive if refresh fails
   - Should return proper error to frontend

---

## 🔍 Troubleshooting

### Migration fails with "column already exists"
✅ **Safe to ignore** - migrations use `IF NOT EXISTS` clauses

### "Cannot find module 'pg'"
Run: `npm install` in Render shell

### OAuth redirect fails
Check `AMAZON_OAUTH_REDIRECT_URI` matches exactly what's registered in Amazon

### Token refresh fails
1. Check `AMAZON_ADS_CLIENT_SECRET` is correct
2. Verify refresh token in database is valid
3. Check Amazon API credentials haven't been rotated

### Campaigns not showing
1. Verify `user_id` is set in campaigns table
2. Check authMiddleware is properly setting `req.userId`
3. Check requireAmazonAuth middleware is applied

---

## ✅ Success Criteria

- [ ] Render deployment completes successfully
- [ ] Database migrations run without errors
- [ ] OAuth columns exist in `users` table
- [ ] `user_id` column exists in `campaigns` table
- [ ] Users can login via Amazon OAuth
- [ ] Campaigns are synced and associated with users
- [ ] Users only see their own campaigns
- [ ] Per-user automations work (`/api/automation/trigger-user`)
- [ ] Global automations work (`/api/automation/trigger`)
- [ ] Token auto-refresh works after 1 hour
- [ ] Multiple users can coexist without interference

---

## 📝 Next Steps After Deployment

1. **Test with real Amazon account:**
   - Connect your actual Amazon Seller account
   - Import real campaigns
   - Run test automation

2. **Monitor for 24 hours:**
   - Check scheduled automations run
   - Verify token refresh happens
   - Check for any errors in logs

3. **Add more users:**
   - Invite other users to test
   - Verify multi-user isolation

4. **Performance tuning:**
   - Monitor database query performance
   - Add indexes if needed
   - Optimize automation execution time

---

## 🎉 Deployment Complete!

OAuth integration is now live in production. Each user has their own:
- Amazon API credentials (OAuth tokens)
- Campaign list (filtered by user_id)
- Automation execution (isolated per user)

**Architecture:**
```
User 1 → OAuth Token 1 → Campaigns A, B, C → Automations run with Token 1
User 2 → OAuth Token 2 → Campaigns X, Y, Z → Automations run with Token 2
```

**Backward compatibility maintained:**
- Old `runAutomationRules()` still works with global `amazonApiService`
- New `runAutomationRulesForUser(userId)` uses per-user tokens
- Scheduler uses the new per-user approach for cron jobs
