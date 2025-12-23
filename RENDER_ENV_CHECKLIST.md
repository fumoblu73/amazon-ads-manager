# ✅ Render Environment Variables - Checklist

Verifica che tutte queste variabili siano configurate correttamente nel tuo Render Web Service.

## 📍 Come accedere

1. Vai su [Render Dashboard](https://dashboard.render.com/)
2. Seleziona il tuo web service "amazon-ads-manager"
3. Vai su **Environment** nel menu laterale

## 🔑 Variabili Obbligatorie

Copia e incolla queste variabili, sostituendo i valori segnaposto:

### Core Configuration

```bash
NODE_ENV=production
PORT=10000
```

### Database (Supabase)

```bash
# Usa la connection string di Supabase (già configurata)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@[host].supabase.co:6543/postgres
```

### Amazon OAuth

```bash
# Client ID e Secret dal tuo Amazon Developer Console
AMAZON_ADS_CLIENT_ID=amzn1.application-oa2-client.xxxxxxxxxx
AMAZON_ADS_CLIENT_SECRET=amzn1.oa2-cs.v1.xxxxxxxxxx

# Redirect URI - IMPORTANTE: deve essere l'URL Render
AMAZON_ADS_REDIRECT_URI_PROD=https://amazon-ads-manager.onrender.com/api/auth/callback

# Scopes
AMAZON_ADS_SCOPES=profile
```

### Security Secrets

```bash
# JWT Secret - genera con: openssl rand -base64 32
JWT_SECRET=<genera_random_32_chars>

# Session Secret - genera con: openssl rand -base64 32
SESSION_SECRET=<genera_random_32_chars>

# KDP Cookie Encryption - già generato
ENCRYPTION_KEY=a33e863b996026f4aed3997006bc628326d3451307034a78102bffba88bb3e47

# Automation Trigger Secret - genera con: openssl rand -base64 32
AUTOMATION_SECRET=<genera_random_32_chars>

# Admin Token - genera con: openssl rand -base64 32
ADMIN_TOKEN=<genera_random_32_chars>

# Migration Secret - genera con: openssl rand -base64 32
MIGRATION_SECRET=<genera_random_32_chars>
```

### Frontend URL

```bash
# URL del tuo Render service
FRONTEND_URL=https://amazon-ads-manager.onrender.com
```

### Optional (se usi mock data per testing)

```bash
USE_MOCK_DATA=false
```

---

## 🔐 Genera Secrets Automaticamente

Puoi generare tutti i secrets necessari con questi comandi:

```bash
# Genera JWT_SECRET
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"

# Genera SESSION_SECRET
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"

# Genera AUTOMATION_SECRET
node -e "console.log('AUTOMATION_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"

# Genera ADMIN_TOKEN
node -e "console.log('ADMIN_TOKEN=' + require('crypto').randomBytes(32).toString('base64'))"

# Genera MIGRATION_SECRET
node -e "console.log('MIGRATION_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
```

Oppure tutti insieme:

```bash
node -e "
const crypto = require('crypto');
console.log('JWT_SECRET=' + crypto.randomBytes(32).toString('base64'));
console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('base64'));
console.log('AUTOMATION_SECRET=' + crypto.randomBytes(32).toString('base64'));
console.log('ADMIN_TOKEN=' + crypto.randomBytes(32).toString('base64'));
console.log('MIGRATION_SECRET=' + crypto.randomBytes(32).toString('base64'));
"
```

---

## ✅ Checklist Verifica

Dopo aver configurato tutte le variabili:

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` (Supabase connection string)
- [ ] `AMAZON_ADS_CLIENT_ID` e `AMAZON_ADS_CLIENT_SECRET`
- [ ] `AMAZON_ADS_REDIRECT_URI_PROD` con URL Render corretto
- [ ] `JWT_SECRET` (32+ chars random)
- [ ] `SESSION_SECRET` (32+ chars random)
- [ ] `ENCRYPTION_KEY` (già configurato)
- [ ] `AUTOMATION_SECRET` (32+ chars random)
- [ ] `ADMIN_TOKEN` (32+ chars random)
- [ ] `MIGRATION_SECRET` (32+ chars random)
- [ ] `FRONTEND_URL` con URL Render

---

## 🚀 Trigger Manual Deploy

Dopo aver configurato le variabili:

1. Vai su **Manual Deploy** nella dashboard Render
2. Clicca **"Clear build cache & deploy"**
3. Attendi il deploy (~10 minuti per primo deploy con Chromium)

---

## 📊 Verifica Deploy Logs

Durante il deploy, cerca questi messaggi nei logs:

```
✅ Building...
✅ Installing Chromium dependencies...
✅ npm install
✅ npm run build
✅ Starting server...
🚀 Server avviato sulla porta 10000
✅ OAuth and KDP Analytics active
✅ KDP Sync scheduler active (runs every 6 hours)
✅ Automation engine active (Func 1+3: Lun/Mer/Ven 10:30 IT, Func 2+4+5: Lun 11:30 IT)
```

Se vedi questi messaggi, il deploy è riuscito! ✅

---

## ⚠️ Troubleshooting

### Errore: "Chromium not found"

**Fix**: Verifica che il **Build Command** includa l'installazione di Chromium:

```bash
apt-get update && apt-get install -y chromium chromium-sandbox fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libwayland-client0 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils && npm install && npm run build
```

### Errore: "Database connection failed"

**Fix**: Verifica `DATABASE_URL` - deve essere la connection string **Supabase** con porta `6543` (non `5432`)

### Errore: "ENCRYPTION_KEY must be 64 hex characters"

**Fix**: Usa esattamente questo valore:
```
ENCRYPTION_KEY=a33e863b996026f4aed3997006bc628326d3451307034a78102bffba88bb3e47
```

---

## 🎯 Prossimo Step

Dopo che il deploy è completato con successo, procedi con:

**Punto 4**: Update Amazon OAuth redirect URI e test browser extension
