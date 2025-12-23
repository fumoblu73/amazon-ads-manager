# 🔐 Amazon OAuth Setup - Production

Guida per configurare Amazon OAuth redirect URI per produzione.

## 📋 Prerequisiti

- Account Amazon Developer Console
- Security Profile già creato (usato in sviluppo)
- URL Render del tuo servizio (es: `https://amazon-ads-manager.onrender.com`)

## 🔧 Step 1: Aggiorna Security Profile

### 1.1 Accedi ad Amazon Developer Console

Vai su: [Amazon Developer Console - Login with Amazon](https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html)

### 1.2 Seleziona il tuo Security Profile

1. Clicca sul nome del tuo Security Profile (quello usato per sviluppo)
2. Vedrai Client ID e Client Secret (già configurati in Render env vars)

### 1.3 Aggiungi Production Redirect URI

1. Scorri fino a **"Web Settings"**
2. Clicca **"Edit"**
3. Nella sezione **"Allowed Return URLs"**, aggiungi:
   ```
   https://amazon-ads-manager.onrender.com/api/auth/callback
   ```
4. **IMPORTANTE**: Non rimuovere l'URL localhost esistente (utile per sviluppo):
   ```
   http://localhost:3000/api/auth/callback
   ```
5. Clicca **"Save"**

### Esempio finale:

**Allowed Return URLs** dovrebbe contenere:
```
http://localhost:3000/api/auth/callback
https://amazon-ads-manager.onrender.com/api/auth/callback
```

---

## ✅ Step 2: Verifica Render Environment Variables

Assicurati che Render abbia queste variabili configurate:

```bash
AMAZON_ADS_CLIENT_ID=amzn1.application-oa2-client.xxxxxxxxxxxx
AMAZON_ADS_CLIENT_SECRET=amzn1.oa2-cs.v1.xxxxxxxxxxxx
AMAZON_ADS_REDIRECT_URI_PROD=https://amazon-ads-manager.onrender.com/api/auth/callback
FRONTEND_URL=https://amazon-ads-manager.onrender.com
```

---

## 🧪 Step 3: Test OAuth Flow

### 3.1 Health Check

Prima verifica che il server sia online:

```bash
curl https://amazon-ads-manager.onrender.com/api/health
```

**Expected Response**:
```json
{
  "status": "OK",
  "message": "Amazon Ads Manager is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3.2 Test OAuth Login

1. Apri browser e vai su: `https://amazon-ads-manager.onrender.com`
2. Clicca **"Login with Amazon"**
3. Dovresti essere rediretto alla pagina di autorizzazione Amazon
4. Autorizza l'applicazione
5. Dovresti essere rediretto alla homepage loggato

### 3.3 Verifica JWT Token

Dopo login, verifica che il JWT token sia salvato:
- Apri DevTools → Application → Cookies
- Cerca cookie `token` con il JWT

### 3.4 Test API con Autenticazione

```bash
# Sostituisci <JWT_TOKEN> con il token ottenuto dal login
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  https://amazon-ads-manager.onrender.com/api/auth/me
```

**Expected Response**:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "amazonUserId": "...",
    "isActive": true
  }
}
```

---

## 🐛 Troubleshooting

### Errore: "redirect_uri_mismatch"

**Causa**: Redirect URI non configurato in Amazon Developer Console

**Fix**:
1. Verifica che `https://amazon-ads-manager.onrender.com/api/auth/callback` sia in "Allowed Return URLs"
2. Controlla che non ci siano spazi o caratteri extra
3. Attendi 5 minuti (cache Amazon)

### Errore: "invalid_client"

**Causa**: Client ID o Secret errati

**Fix**:
1. Vai su Amazon Developer Console
2. Copia di nuovo Client ID e Client Secret
3. Aggiorna Render env vars
4. Redeploy

### Errore: "CORS policy blocked"

**Causa**: CORS non configurato correttamente

**Fix**: Verifica in `src/index.ts` che FRONTEND_URL sia corretto:
```typescript
res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
```

### Login funziona ma redirect fallisce

**Causa**: FRONTEND_URL non configurato

**Fix**: Aggiungi in Render env vars:
```bash
FRONTEND_URL=https://amazon-ads-manager.onrender.com
```

---

## 📱 Step 4: Browser Extension Setup

### 4.1 Verifica URL in popup.js

Il file `browser-extension/popup.js` dovrebbe già avere:

```javascript
const PRODUCTION_URL = 'https://amazon-ads-manager.onrender.com';
const API_URL = PRODUCTION_URL || 'http://localhost:3000';
```

✅ Questo è già configurato correttamente!

### 4.2 Ricarica Extension in Chrome

1. Apri Chrome e vai su `chrome://extensions/`
2. Trova "Amazon Ads Manager - KDP Sync"
3. Clicca **icona reload** (reload this extension)

Oppure:
1. Clicca **"Remove"**
2. Clicca **"Load unpacked"**
3. Seleziona cartella `browser-extension`

### 4.3 Test Extension

1. Vai su `https://kdp.amazon.com` e fai login
2. Clicca sull'icona dell'extension nella barra Chrome
3. Clicca **"🔄 Sincronizza con KDP"**

**Expected**:
```
✅ Trovati X cookie. Invio al server...
✅ Sincronizzazione completata! X cookie salvati.
```

### 4.4 Verifica Status

Nella extension, clicca **"📊 Verifica Stato"**

**Expected**:
```
✅ Sync attivo
📅 Ultimo aggiornamento: 15/01/2024, 10:30:00
🌍 Marketplace: US
```

### 4.5 Verifica Database

I cookie dovrebbero essere salvati criptati nel database Supabase:

```sql
SELECT
  id,
  email,
  kdp_sync_enabled,
  kdp_marketplace,
  kdp_cookies_updated_at,
  LENGTH(kdp_cookies_encrypted) as encrypted_length
FROM users
WHERE kdp_sync_enabled = true;
```

**Expected**:
- `kdp_sync_enabled` = `true`
- `kdp_marketplace` = `"US"` (o altro)
- `encrypted_length` > 0 (cookie criptati presenti)

---

## 🚀 Step 5: Test Automation Trigger

### 5.1 Manual Trigger (Global)

```bash
# Sostituisci <AUTOMATION_SECRET> con il valore generato
curl -X POST "https://amazon-ads-manager.onrender.com/api/automation/trigger?secret=<AUTOMATION_SECRET>"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Automations queued successfully",
  "dbStatus": "active",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "note": "Execution started in background. Check /api/automation/status for progress."
}
```

### 5.2 Check Status

```bash
curl https://amazon-ads-manager.onrender.com/api/automation/status
```

**Expected Response**:
```json
{
  "scheduler": {
    "isRunning": true,
    "activeTasks": 2,
    "triggerMethod": "internal"
  },
  "lastExecution": {
    "startedAt": "2024-01-15T10:30:00.000Z",
    "completedAt": "2024-01-15T10:35:00.000Z",
    "status": "completed",
    "error": null,
    "duration": "5.23 minutes"
  }
}
```

### 5.3 Per-User Trigger

```bash
# Sostituisci <JWT_TOKEN> con il token dall'OAuth login
curl -X POST \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  https://amazon-ads-manager.onrender.com/api/automation/trigger-user
```

---

## ✅ Final Checklist

- [ ] Amazon OAuth redirect URI aggiunto in Developer Console
- [ ] OAuth login funziona su Render
- [ ] JWT token salvato nei cookies
- [ ] Health endpoint risponde
- [ ] Browser extension ricaricata
- [ ] Extension si connette a production API
- [ ] KDP sync test completato
- [ ] Cookie salvati criptati in database
- [ ] Automation trigger test completato
- [ ] Scheduler logs visibili in Render

---

## 🎉 Deploy Completato!

Se tutti i test sopra passano, il deploy è completo e funzionante!

### Sistema Attivo:

✅ **OAuth Multi-User** - Login with Amazon
✅ **KDP Sync** - Auto-sync ogni 6 ore
✅ **Automation Engine** - 5 funzioni attive
✅ **Browser Extension** - Cookie sync funzionante

### Prossimi Step:

1. **Monitora Logs**: Controlla Render logs per primi sync automatici
2. **Add Users**: Invita altri utenti a fare login
3. **Configure Automations**: Personalizza parametri per ogni campagna
4. **Monitor Performance**: Controlla metriche e ottimizza

---

## 📞 Support

- **Render Logs**: Dashboard → Service → Logs
- **Supabase Database**: Dashboard → SQL Editor
- **Amazon Developer Console**: Monitoring → Events

Enjoy your automated Amazon Ads Manager! 🚀
