# 🚀 Render Deployment - Quick Guide

## ✅ STEP 1: Verifica Deployment su Render

### Via Dashboard (Consigliato)

1. **Apri Render Dashboard**
   ```
   https://dashboard.render.com
   ```

2. **Trova il tuo servizio**
   - Nome: `amazon-ads-manager` (o simile)
   - Tipo: Web Service
   - Region: EU o US (dove l'hai creato)

3. **Controlla lo stato**
   - **🟢 Live** = Deployment completato con successo
   - **🟡 Building** = Build in corso (aspetta)
   - **🔴 Failed** = Errore nel build (controlla i logs)

4. **Verifica i log**
   - Clicca su "Logs" tab
   - Cerca "Build successful"
   - Verifica che non ci siano errori

---

## ✅ STEP 2: Esegui le Migrazioni del Database

### Via Render Shell

1. **Apri la Shell**
   - Nel servizio su Render Dashboard
   - Clicca su "Shell" tab
   - Attendi che la shell si connetta

2. **Esegui il comando di migrazione**
   ```bash
   npm run migrate
   ```

3. **Verifica l'output**
   Dovresti vedere:
   ```
   ✅ Connected to database
   📁 Found 7 migration files

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

4. **Se vedi "already applied"**
   - È normale! Significa che le migrazioni sono già state eseguite
   - Lo script salta automaticamente le migrazioni duplicate

---

## ✅ STEP 3: Verifica Environment Variables

Nel Dashboard di Render, vai su "Environment" tab e verifica:

### Variabili Richieste:

```bash
# Database
DATABASE_URL=postgresql://... ✅ (già presente)

# Amazon Ads API
AMAZON_ADS_CLIENT_ID=amzn1.application-oa2-client.xxx
AMAZON_ADS_CLIENT_SECRET=xxx

# OAuth Redirect
AMAZON_OAUTH_REDIRECT_URI=https://your-app.onrender.com/api/auth/amazon/callback

# JWT
JWT_SECRET=your-secret-key

# Frontend
FRONTEND_URL=https://your-frontend-domain.com

# Node Environment
NODE_ENV=production
PORT=10000
```

### ⚠️ Importante:
- `AMAZON_OAUTH_REDIRECT_URI` deve corrispondere **esattamente** a quello registrato su Amazon Developer Console
- Dopo aver modificato le variabili, Render farà un redeploy automatico

---

## ✅ STEP 4: Testa OAuth Flow in Produzione

1. **Apri la tua app**
   ```
   https://your-app.onrender.com
   ```

2. **Prova il login**
   - Clicca su "Connect with Amazon" o "Login"
   - Dovresti essere reindirizzato ad Amazon
   - Login con le tue credenziali Amazon Seller
   - Dovresti tornare alla tua app loggato

3. **Verifica nel database**
   Via Render Shell o Supabase Dashboard:
   ```sql
   SELECT
     email,
     amazon_user_id,
     profile_id,
     country_code,
     is_active
   FROM users
   WHERE amazon_user_id IS NOT NULL;
   ```

4. **Testa la sincronizzazione campagne**
   - Vai alla pagina Campagne
   - Clicca "Sync from Amazon"
   - Verifica che le campagne vengano importate
   - Controlla che abbiano il `user_id` corretto

---

## ✅ STEP 5: Testa le Automazioni Per-User

### Via API (Postman/curl)

1. **Login e ottieni il token JWT**
   ```bash
   curl -X POST https://your-app.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"your@email.com","password":"yourpassword"}'
   ```

2. **Trigger automazioni per il tuo user**
   ```bash
   curl -X POST https://your-app.onrender.com/api/automation/trigger-user \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. **Controlla i log su Render**
   Dovresti vedere:
   ```
   🤖 Running automations for user abc-123...
   📊 Found 5 active campaigns for user abc-123
   ✅ Completed automations for user abc-123
   ```

### Via Dashboard (se disponibile)
- Vai alla pagina Automations
- Clicca "Run Now" (se hai un bottone)
- Verifica che le tue campagne vengano elaborate

---

## 🔍 Troubleshooting

### Problema: Deployment Failed

**Soluzione:**
1. Controlla i logs su Render
2. Cerca errori di compilazione TypeScript
3. Verifica che tutte le dipendenze siano in package.json
4. Assicurati che `npm run build` funzioni localmente

### Problema: Migration Fails

**Errore: "relation already exists"**
✅ **Safe to ignore** - Le migrazioni usano `IF NOT EXISTS`

**Errore: "Cannot connect to database"**
1. Verifica `DATABASE_URL` in environment variables
2. Controlla che Supabase sia raggiungibile
3. Verifica credenziali database

### Problema: OAuth Redirect Fails

**Errore: "redirect_uri mismatch"**
1. Verifica che `AMAZON_OAUTH_REDIRECT_URI` sia identico a quello in Amazon Developer Console
2. Formato corretto: `https://your-app.onrender.com/api/auth/amazon/callback`
3. Include `https://` e NO trailing slash

### Problema: Token Refresh Fails

**Soluzione:**
1. Verifica `AMAZON_ADS_CLIENT_SECRET` sia corretto
2. Controlla che il refresh token in database sia valido
3. Verifica che le credenziali Amazon non siano scadute

---

## 📊 Checklist Finale

- [ ] Deployment su Render completato (status: Live)
- [ ] Migrazioni database eseguite con successo
- [ ] Environment variables configurate correttamente
- [ ] OAuth flow funziona (login con Amazon)
- [ ] Campagne sincronizzate e associate a user
- [ ] Automazioni per-user funzionano
- [ ] Token auto-refresh testato (dopo 1 ora)
- [ ] Log di Render non mostrano errori critici

---

## 🎉 Deployment Completato!

Se tutti i punti della checklist sono verdi, il deployment è completo!

### Cosa hai ottenuto:
- ✅ Sistema multi-user con OAuth
- ✅ Ogni user ha i propri token Amazon
- ✅ Campagne isolate per user
- ✅ Automazioni eseguite per-user
- ✅ Token refresh automatico

### Prossimi passi:
1. Invita altri utenti a testare
2. Monitora i log per 24-48 ore
3. Verifica che le automazioni cron funzionino
4. Ottimizza performance se necessario

---

## 📞 Support

- **Checklist completa:** `DEPLOYMENT_CHECKLIST.md`
- **Summary progetto:** `OAUTH_INTEGRATION_SUMMARY.md`
- **GitHub:** https://github.com/fumoblu73/amazon-ads-manager

---

## 🔗 Quick Links

- **Render Dashboard:** https://dashboard.render.com
- **GitHub Repo:** https://github.com/fumoblu73/amazon-ads-manager
- **Supabase Dashboard:** https://supabase.com/dashboard

---

**Ultimo aggiornamento:** 2025-12-19
**Status:** ✅ Pronto per produzione
