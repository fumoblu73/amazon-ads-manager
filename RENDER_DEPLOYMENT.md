# 🚀 Render Deployment Guide - Amazon Ads Manager

Guida completa per deployare Amazon Ads Manager con KDP Sync su Render.

## 📋 Pre-requisiti

- Account Render.com
- Repository GitHub con il progetto
- Database PostgreSQL (Render fornisce database gratuiti)

## 🗄️ Step 1: Setup Database PostgreSQL

1. Vai su [Render Dashboard](https://dashboard.render.com/)
2. Clicca **"New +"** → **"PostgreSQL"**
3. Configurazione:
   - **Name**: `amazon-ads-manager-db`
   - **Database**: `amazon_ads_manager`
   - **User**: (auto-generato)
   - **Region**: Scegli la più vicina (es. Frankfurt per EU)
   - **Plan**: Free (o Starter per produzione)
4. Clicca **"Create Database"**
5. **SALVA** la stringa `Internal Database URL` (formato: `postgresql://user:pass@host/db`)

## 🌐 Step 2: Deploy Web Service

### 2.1 Crea Web Service

1. Clicca **"New +"** → **"Web Service"**
2. Connetti il repository GitHub
3. Configurazione base:
   - **Name**: `amazon-ads-manager`
   - **Region**: Stessa del database
   - **Branch**: `main`
   - **Root Directory**: (vuoto)
   - **Runtime**: `Node`
   - **Build Command**: Vedi sotto ⬇️
   - **Start Command**: `npm start`

### 2.2 Build Command (IMPORTANTE)

```bash
# Install Chromium and dependencies for Puppeteer
apt-get update && apt-get install -y \
  chromium \
  chromium-sandbox \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libwayland-client0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils && \
npm install && \
npm run build
```

### 2.3 Environment Variables

Vai su **"Environment"** e aggiungi:

```bash
# Node Environment
NODE_ENV=production

# Server Port (Render auto-assign)
PORT=10000

# Database (usa l'URL del database creato prima)
DATABASE_URL=postgresql://user:pass@host/database

# Cookie Encryption (OBBLIGATORIO - genera con comando sotto)
ENCRYPTION_KEY=your_64_character_hex_key

# Frontend URL (usa l'URL auto-generato da Render)
FRONTEND_URL=https://amazon-ads-manager.onrender.com

# Amazon OAuth Credentials
AMAZON_CLIENT_ID=your_client_id
AMAZON_CLIENT_SECRET=your_client_secret
AMAZON_REDIRECT_URI=https://amazon-ads-manager.onrender.com/api/auth/callback

# JWT Secret (genera random string)
JWT_SECRET=your_jwt_secret_min_32_chars

# Migration Secret (per endpoint /api/migrate)
MIGRATION_SECRET=your_migration_secret
```

#### Genera ENCRYPTION_KEY

Localmente esegui:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Oppure usa l'esempio da `.env.example`:
```
a33e863b996026f4aed3997006bc628326d3451307034a78102bffba88bb3e47
```

### 2.4 Impostazioni Aggiuntive

- **Plan**: Free (o Starter per produzione)
- **Health Check Path**: `/api/health`
- **Auto-Deploy**: ✅ Abilitato (deploy automatico su push a `main`)

### 2.5 Deploy

Clicca **"Create Web Service"** e attendi il primo deploy (~5-10 minuti).

## ✅ Step 3: Verifica Deploy

### 3.1 Check Health Endpoint

Apri: `https://your-app.onrender.com/api/health`

Dovresti vedere:
```json
{
  "status": "OK",
  "message": "Amazon Ads Manager is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3.2 Check Logs

Nel dashboard Render, vai su **"Logs"** e verifica:

```
=================================================
🚀 Server avviato sulla porta 10000
=================================================
✅ OAuth and KDP Analytics active
✅ KDP Sync scheduler active (runs every 6 hours)
⚠️  Automation temporarily disabled - will be fixed soon
```

### 3.3 Test OAuth Flow

1. Vai su `https://your-app.onrender.com`
2. Clicca "Login with Amazon"
3. Autorizza l'applicazione
4. Verifica redirect e home page

## 🔧 Step 4: Configurazione Amazon OAuth

### 4.1 Aggiorna Security Profile

Vai su [Amazon Developer Console](https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html):

1. Apri il tuo Security Profile
2. **Web Settings** → **Allowed Return URLs**
3. Aggiungi: `https://your-app.onrender.com/api/auth/callback`
4. Salva

### 4.2 Test Login

Prova il flusso OAuth completo dalla tua app.

## 🌐 Step 5: Configurazione Browser Extension

### 5.1 Aggiorna API_URL

Nel file `browser-extension/popup.js`:

```javascript
const PRODUCTION_URL = 'https://your-app.onrender.com';
const API_URL = PRODUCTION_URL || 'http://localhost:3000';
```

**Sostituisci** `your-app` con il tuo nome Render.

### 5.2 Ricarica Extension

1. Vai su `chrome://extensions/`
2. Clicca "Ricarica" sull'estensione
3. Oppure rimuovi e ricarica la cartella

## 📊 Step 6: Test KDP Sync Completo

1. **Login nella tua app** con Amazon OAuth
2. **Vai su** `https://kdp.amazon.com` e fai login
3. **Apri l'estensione** Chrome
4. **Clicca** "🔄 Sincronizza con KDP"
5. **Verifica** nel database che i cookie siano salvati criptati
6. **Attendi** il prossimo sync automatico (ogni 6 ore)

### Check Database

Connettiti al database PostgreSQL da Render Dashboard:

```sql
SELECT
  id,
  email,
  kdp_sync_enabled,
  kdp_marketplace,
  kdp_cookies_updated_at,
  kdp_last_sync_at
FROM users;
```

Dovresti vedere:
- `kdp_sync_enabled` = true
- `kdp_marketplace` = "US" (o altro)
- `kdp_cookies_updated_at` = data recente
- `kdp_cookies_encrypted` = stringa criptata (non leggibile)

## 🐛 Troubleshooting

### Errore: "Chromium not found"

**Causa**: Build command non ha installato Chromium

**Fix**: Copia esattamente il build command da Step 2.2

### Errore: "Database connection failed"

**Causa**: DATABASE_URL errato

**Fix**:
1. Vai al database PostgreSQL su Render
2. Copia **"Internal Database URL"** (non External)
3. Aggiornalo in Environment Variables

### Errore: "ENCRYPTION_KEY must be 64 hex characters"

**Causa**: ENCRYPTION_KEY non valido

**Fix**: Genera nuovo key con:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Extension non si connette

**Causa**: CORS o URL sbagliato

**Fix**:
1. Verifica `FRONTEND_URL` in Render Environment
2. Controlla che `popup.js` abbia l'URL corretto
3. Verifica CORS in `src/index.ts` (già configurato)

### Scheduler non parte

**Causa**: Codice non aggiornato o errore startup

**Fix**:
1. Verifica commit recente sia su GitHub
2. Trigger manual deploy su Render
3. Check logs per errori

## 🔒 Security Checklist

- ✅ HTTPS abilitato (automatico su Render)
- ✅ ENCRYPTION_KEY sicuro (64 hex chars)
- ✅ JWT_SECRET random e lungo (>32 chars)
- ✅ DATABASE_URL **Internal** (non External)
- ✅ Cookie criptati con AES-256-GCM
- ✅ OAuth redirect URI corretto
- ✅ MIGRATION_SECRET diverso da JWT_SECRET

## 📈 Monitoraggio

### Logs Utili

```bash
# Render Dashboard → Logs
✅ KDP cookies saved for user {userId}
🔄 Starting KDP sync for user {userId}
✅ Found {n} books in bookshelf
✅ Sync completed for user {userId}
```

### Metriche da Monitorare

- **CPU Usage**: Puppeteer può essere pesante
- **Memory**: ~512MB minimo per Chromium
- **Database Size**: Crescita dipende da numero utenti
- **Request Rate**: Limiti Amazon API

## 🚀 Deploy Automatico

Render auto-deploya su push a `main`:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Render:
1. Rileva push
2. Esegue build command
3. Avvia server
4. Aggiorna health check

## 💰 Costi Stima

### Free Tier
- **Web Service**: Free (750h/mese)
- **PostgreSQL**: Free (1GB storage)
- **Bandwidth**: Free (100GB/mese)

### Limitazioni Free
- Sleeping dopo 15min inattività
- 512MB RAM
- 0.1 CPU

### Starter Plan (~$7/mese)
- Always on
- 512MB RAM
- 0.5 CPU
- Migliore per produzione

## 🔄 Update Deploy

Per aggiornare:

```bash
# Local
git pull origin main
# Make changes
git add .
git commit -m "Update"
git push origin main

# Render auto-deploya
```

## 📞 Support

- **Render Status**: https://status.render.com
- **Render Docs**: https://render.com/docs
- **Puppeteer Render**: https://render.com/docs/puppeteer

## ✅ Post-Deploy Checklist

- [ ] Health endpoint risponde
- [ ] OAuth login funziona
- [ ] Database connesso
- [ ] Scheduler attivo (check logs)
- [ ] Browser extension connessa
- [ ] KDP sync test completato
- [ ] Logs monitorati
- [ ] Backup database configurato (optional)

---

**Deployment completato!** 🎉

Ora la tua applicazione è live e il KDP Sync scheduler gira automaticamente ogni 6 ore.
