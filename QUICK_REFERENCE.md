# 🚀 Quick Reference - Amazon Ads Manager

Comandi e URL utili per deploy e testing.

## 🔗 URL Importanti

### Production
- **App URL**: https://amazon-ads-manager.onrender.com
- **Health Check**: https://amazon-ads-manager.onrender.com/api/health
- **OAuth Login**: https://amazon-ads-manager.onrender.com/api/auth/login
- **Automation Status**: https://amazon-ads-manager.onrender.com/api/automation/status

### Admin Dashboards
- **Render**: https://dashboard.render.com
- **Supabase**: https://supabase.com/dashboard
- **Amazon Developer**: https://developer.amazon.com/loginwithamazon/console

---

## 🔐 Secrets Generati

```bash
JWT_SECRET=hDV85ZyqdtJgqzf9mrob2fBnhxOa9+C3B18AB1MZ1bQ=
SESSION_SECRET=nXTG2SOBsvlylTg7BzdRdsQvQazxNKc4eNwLGacJjOY=
AUTOMATION_SECRET=K4RCyn83PQCjwctmLEZHRBdSl3tX/hlPEdhuTIM4PwA=
ADMIN_TOKEN=0PwQ8zn6NVy8J0mFcmh6obf6Do+PkAHbBpunMlauINQ=
MIGRATION_SECRET=t/qvIVLS3ePYMG97zAgd+PZbCM+Aa5u8ZmfVeVwP+Mw=
ENCRYPTION_KEY=a33e863b996026f4aed3997006bc628326d3451307034a78102bffba88bb3e47
```

⚠️ **SALVA QUESTI SECRETS IN MODO SICURO!** Ne avrai bisogno per chiamate API admin.

---

## 🧪 Test Commands

### Health Check
```bash
curl https://amazon-ads-manager.onrender.com/api/health
```

### Auth Status (requires JWT)
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  https://amazon-ads-manager.onrender.com/api/auth/me
```

### KDP Sync Status (requires JWT)
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  https://amazon-ads-manager.onrender.com/api/kdp-sync/status
```

### Automation Status (public)
```bash
curl https://amazon-ads-manager.onrender.com/api/automation/status
```

### Automation Trigger (requires secret)
```bash
curl -X POST "https://amazon-ads-manager.onrender.com/api/automation/trigger?secret=K4RCyn83PQCjwctmLEZHRBdSl3tX/hlPEdhuTIM4PwA="
```

### Per-User Automation (requires JWT)
```bash
curl -X POST \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  https://amazon-ads-manager.onrender.com/api/automation/trigger-user
```

### Automation Config (requires admin token)
```bash
curl -H "Authorization: Bearer 0PwQ8zn6NVy8J0mFcmh6obf6Do+PkAHbBpunMlauINQ=" \
  https://amazon-ads-manager.onrender.com/api/automation/config
```

---

## 📊 Database Queries

### Check Users with OAuth
```sql
SELECT id, email, amazon_user_id, is_active, created_at
FROM users
WHERE amazon_user_id IS NOT NULL
ORDER BY created_at DESC;
```

### Check KDP Sync Status
```sql
SELECT
  id,
  email,
  kdp_sync_enabled,
  kdp_marketplace,
  kdp_cookies_updated_at,
  kdp_last_sync_at,
  LENGTH(kdp_cookies_encrypted) as encrypted_length
FROM users
WHERE kdp_sync_enabled = true;
```

### Recent Automation Logs
```sql
SELECT
  user_id,
  campaign_name,
  function_name,
  action,
  result,
  created_at
FROM automation_logs
ORDER BY created_at DESC
LIMIT 20;
```

### Campaign Count per User
```sql
SELECT
  u.email,
  COUNT(c.id) as campaign_count
FROM users u
LEFT JOIN campaigns c ON u.id = c.user_id
GROUP BY u.id, u.email
ORDER BY campaign_count DESC;
```

---

## 🔧 Render Commands

### Trigger Manual Deploy
```bash
# Via Render Dashboard:
# 1. Go to your service
# 2. Click "Manual Deploy"
# 3. Select branch: main
# 4. Click "Deploy"
```

### View Logs
```bash
# Via Render Dashboard:
# 1. Go to your service
# 2. Click "Logs" in sidebar
# 3. Or use Render CLI:
render logs -s amazon-ads-manager --tail
```

### Update Environment Variable
```bash
# Via Render Dashboard:
# 1. Go to your service
# 2. Click "Environment" in sidebar
# 3. Add/Edit variable
# 4. Click "Save Changes"
# Note: This triggers automatic redeploy
```

---

## 🌐 Browser Extension

### Load Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `browser-extension` folder

### Reload Extension
1. Go to `chrome://extensions/`
2. Find "Amazon Ads Manager - KDP Sync"
3. Click reload icon 🔄

### Test Extension
1. Go to `https://kdp.amazon.com`
2. Login to your KDP account
3. Click extension icon
4. Click "🔄 Sincronizza con KDP"
5. Check status: "✅ Sincronizzazione completata!"

---

## 📅 Automation Schedule

### Current Schedule (UTC)
- **Func 1+3**: `30 9 * * 1,3,5` (Mon/Wed/Fri 09:30 UTC = 10:30 IT)
- **Func 2+4+5**: `30 10 * * 1` (Monday 10:30 UTC = 11:30 IT)

### Update Schedule (requires admin token)
```bash
curl -X POST \
  -H "Authorization: Bearer 0PwQ8zn6NVy8J0mFcmh6obf6Do+PkAHbBpunMlauINQ=" \
  -H "Content-Type: application/json" \
  -d '{
    "func1and3_schedule": "30 9 * * 1,3,5",
    "func1and3_enabled": true,
    "func2and4and5_schedule": "30 10 * * 1",
    "func2and4and5_enabled": true
  }' \
  https://amazon-ads-manager.onrender.com/api/automation/config
```

### Restart Scheduler (requires admin token)
```bash
curl -X POST \
  -H "Authorization: Bearer 0PwQ8zn6NVy8J0mFcmh6obf6Do+PkAHbBpunMlauINQ=" \
  https://amazon-ads-manager.onrender.com/api/automation/scheduler/restart
```

---

## 🐛 Common Issues & Fixes

### Issue: "Chromium not found"
**Fix**: Check Build Command includes Chromium install
```bash
apt-get update && apt-get install -y chromium ...
```

### Issue: "Database connection failed"
**Fix**: Check `DATABASE_URL` - should use Supabase connection pooler (port 6543)

### Issue: "OAuth redirect_uri_mismatch"
**Fix**: Add redirect URI to Amazon Developer Console Allowed Return URLs

### Issue: "Extension can't connect"
**Fix**:
1. Check `PRODUCTION_URL` in popup.js
2. Verify CORS in src/index.ts
3. Reload extension

### Issue: "Scheduler not starting"
**Fix**: Check Render logs for errors during startup

### Issue: "Cookies expired"
**Fix**: User must re-sync via extension (cookies last ~7 days)

---

## 📚 Documentation Files

- **DEPLOYMENT_STATUS.md** - Overall status and checklist
- **RENDER_DEPLOYMENT.md** - Complete Render setup guide
- **RENDER_ENV_CHECKLIST.md** - Environment variables checklist
- **AMAZON_OAUTH_SETUP.md** - OAuth and extension setup
- **AUTOMATION_ENGINE.md** - Complete automation docs
- **KDP_SYNC_SETUP.md** - KDP sync system guide
- **QUICK_REFERENCE.md** - This file

---

## 🎯 Next Actions

### Immediate (Setup)
1. [ ] Add all environment variables to Render
2. [ ] Update Amazon OAuth redirect URI
3. [ ] Test health endpoint
4. [ ] Test OAuth login
5. [ ] Reload browser extension
6. [ ] Test KDP sync

### Short-term (Validation)
1. [ ] Monitor first scheduled automation run
2. [ ] Check automation logs in database
3. [ ] Verify KDP sync working every 6 hours
4. [ ] Test per-user automation trigger

### Long-term (Optimization)
1. [ ] Monitor Render metrics (CPU, memory)
2. [ ] Optimize database queries
3. [ ] Add rate limiting
4. [ ] Implement email notifications
5. [ ] Create admin dashboard UI

---

## 🆘 Emergency Commands

### Stop Scheduler
```bash
curl -X POST \
  -H "Authorization: Bearer 0PwQ8zn6NVy8J0mFcmh6obf6Do+PkAHbBpunMlauINQ=" \
  -H "Content-Type: application/json" \
  -d '{"func1and3_enabled": false, "func2and4and5_enabled": false}' \
  https://amazon-ads-manager.onrender.com/api/automation/config
```

### Disable KDP Sync for User
```bash
curl -X DELETE \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  https://amazon-ads-manager.onrender.com/api/kdp-sync/cookies
```

### Force Database Reconnect
```bash
# Restart service via Render Dashboard:
# Settings → "Suspend Service" → "Resume Service"
```

---

**Everything you need at your fingertips!** 🚀
