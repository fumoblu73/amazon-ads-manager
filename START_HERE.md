# 🚀 START HERE - Deploy Completo Amazon Ads Manager

Segui questi step nell'ordine per completare il deploy.

---

## ✅ Cosa è già stato fatto

- ✅ Phase A (KDP Sync): Completata e testata
- ✅ Phase C (Automation Engine): Completata e attivata
- ✅ Codice pushato su GitHub (main branch)
- ✅ Secrets generati e pronti
- ✅ Browser extension configurata per produzione
- ✅ Documentazione completa creata

---

## 📋 Cosa devi fare TU adesso

### STEP 1: Configura Environment Variables su Render ⏱️ 5 minuti

1. Vai su [Render Dashboard](https://dashboard.render.com/)
2. Seleziona il tuo web service "amazon-ads-manager"
3. Clicca **"Environment"** nel menu laterale
4. Aggiungi queste variabili (copia-incolla):

```bash
# Core
NODE_ENV=production
PORT=10000

# Database (usa la tua connection string Supabase)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@[host].supabase.co:6543/postgres

# Amazon OAuth (usa i tuoi valori)
AMAZON_ADS_CLIENT_ID=amzn1.application-oa2-client.xxxxxxxxxxxx
AMAZON_ADS_CLIENT_SECRET=amzn1.oa2-cs.v1.xxxxxxxxxxxx
AMAZON_ADS_REDIRECT_URI_PROD=https://amazon-ads-manager.onrender.com/api/auth/callback
AMAZON_ADS_SCOPES=profile

# Security Secrets (COPIA QUESTI VALORI GENERATI)
JWT_SECRET=hDV85ZyqdtJgqzf9mrob2fBnhxOa9+C3B18AB1MZ1bQ=
SESSION_SECRET=nXTG2SOBsvlylTg7BzdRdsQvQazxNKc4eNwLGacJjOY=
ENCRYPTION_KEY=a33e863b996026f4aed3997006bc628326d3451307034a78102bffba88bb3e47
AUTOMATION_SECRET=K4RCyn83PQCjwctmLEZHRBdSl3tX/hlPEdhuTIM4PwA=
ADMIN_TOKEN=0PwQ8zn6NVy8J0mFcmh6obf6Do+PkAHbBpunMlauINQ=
MIGRATION_SECRET=t/qvIVLS3ePYMG97zAgd+PZbCM+Aa5u8ZmfVeVwP+Mw=

# Frontend
FRONTEND_URL=https://amazon-ads-manager.onrender.com
```

5. Clicca **"Save Changes"**
6. Render farà un **auto-deploy** (attendi ~10 minuti)

📝 **Nota**: Sostituisci `DATABASE_URL`, `AMAZON_ADS_CLIENT_ID` e `AMAZON_ADS_CLIENT_SECRET` con i tuoi valori reali.

---

### STEP 2: Verifica Build Command su Render ⏱️ 2 minuti

1. Sempre su Render, vai su **"Settings"**
2. Scorri fino a **"Build Command"**
3. Verifica che sia esattamente questo:

```bash
apt-get update && apt-get install -y chromium chromium-sandbox fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libwayland-client0 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils && npm install && npm run build
```

4. Se diverso, **aggiornalo** e clicca **"Save Changes"**

---

### STEP 3: Monitora il Deploy ⏱️ 10 minuti

1. Vai su **"Logs"** nel menu Render
2. Attendi che il deploy completi
3. Cerca questi messaggi di successo:

```
✅ Building...
✅ Installing Chromium dependencies...
✅ npm install
✅ npm run build
✅ Starting server...
🚀 Server avviato sulla porta 10000
=================================================
✅ OAuth and KDP Analytics active
✅ KDP Sync scheduler active (runs every 6 hours)
✅ Automation engine active (Func 1+3: Lun/Mer/Ven 10:30 IT, Func 2+4+5: Lun 11:30 IT)
```

✅ Se vedi questi messaggi, il deploy è **RIUSCITO**!

---

### STEP 4: Test Health Endpoint ⏱️ 1 minuto

Apri browser e vai su:
```
https://amazon-ads-manager.onrender.com/api/health
```

Dovresti vedere:
```json
{
  "status": "OK",
  "message": "Amazon Ads Manager is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

✅ Se funziona, il server è **ONLINE**!

---

### STEP 5: Aggiorna Amazon OAuth ⏱️ 3 minuti

1. Vai su [Amazon Developer Console](https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html)
2. Seleziona il tuo **Security Profile**
3. Vai su **"Web Settings"** → **"Edit"**
4. In **"Allowed Return URLs"**, aggiungi:
   ```
   https://amazon-ads-manager.onrender.com/api/auth/callback
   ```
5. **NON rimuovere** localhost (utile per sviluppo)
6. Clicca **"Save"**

Risultato finale:
```
http://localhost:3000/api/auth/callback
https://amazon-ads-manager.onrender.com/api/auth/callback
```

---

### STEP 6: Test OAuth Login ⏱️ 2 minuti

1. Apri browser e vai su:
   ```
   https://amazon-ads-manager.onrender.com
   ```
2. Clicca **"Login with Amazon"**
3. Autorizza l'applicazione
4. Dovresti essere rediretto alla **homepage loggato**

✅ Se funziona, OAuth è **CONFIGURATO CORRETTAMENTE**!

---

### STEP 7: Setup Browser Extension ⏱️ 3 minuti

1. Apri Chrome e vai su `chrome://extensions/`
2. Trova **"Amazon Ads Manager - KDP Sync"**
3. Clicca **icona reload** 🔄 (oppure rimuovi e ricarica la cartella `browser-extension`)
4. Vai su `https://kdp.amazon.com` e fai login
5. Clicca sull'**icona extension** nella barra Chrome
6. Clicca **"🔄 Sincronizza con KDP"**

Dovresti vedere:
```
✅ Trovati X cookie. Invio al server...
✅ Sincronizzazione completata! X cookie salvati.
```

---

### STEP 8: Verifica KDP Sync ⏱️ 2 minuti

1. Nella extension, clicca **"📊 Verifica Stato"**

Dovresti vedere:
```
✅ Sync attivo
📅 Ultimo aggiornamento: 15/01/2024, 10:30:00
🌍 Marketplace: US
```

2. Verifica database Supabase:
   - Vai su Supabase Dashboard → SQL Editor
   - Esegui:
     ```sql
     SELECT email, kdp_sync_enabled, kdp_marketplace, kdp_cookies_updated_at
     FROM users
     WHERE kdp_sync_enabled = true;
     ```

✅ Dovresti vedere il tuo user con `kdp_sync_enabled = true`!

---

### STEP 9: Test Automation ⏱️ 2 minuti

Apri terminale e esegui:

```bash
curl -X POST "https://amazon-ads-manager.onrender.com/api/automation/trigger?secret=K4RCyn83PQCjwctmLEZHRBdSl3tX/hlPEdhuTIM4PwA="
```

Dovresti vedere:
```json
{
  "success": true,
  "message": "Automations queued successfully",
  "dbStatus": "active"
}
```

Poi controlla status:
```bash
curl https://amazon-ads-manager.onrender.com/api/automation/status
```

✅ Se vedi `"isRunning": true` o `"status": "completed"`, automation funziona!

---

## 🎉 DEPLOY COMPLETATO!

Se tutti gli step sopra sono ✅, il sistema è **COMPLETAMENTE FUNZIONANTE**!

### 🚀 Sistema Attivo:

- ✅ **OAuth Multi-User** - Login with Amazon funzionante
- ✅ **KDP Sync Automatico** - Sync ogni 6 ore
- ✅ **Automation Engine** - 5 funzioni attive con scheduler
- ✅ **Browser Extension** - Cookie sync funzionante

---

## 📊 Prossimi Step (Opzionali)

### Monitoraggio
- [ ] Controlla Render logs regolarmente
- [ ] Monitora primi sync automatici (ogni 6 ore)
- [ ] Verifica automation logs nel database

### Utenti
- [ ] Invita altri utenti a fare login
- [ ] Testa per-user automation

### Ottimizzazione
- [ ] Configura parametri automation per ogni campagna
- [ ] Monitora performance Amazon Ads API
- [ ] Ottimizza database queries se necessario

---

## 📚 Documentazione di Riferimento

Se hai problemi o domande, consulta:

1. **QUICK_REFERENCE.md** - Comandi e URL utili
2. **RENDER_DEPLOYMENT.md** - Guida deploy completa
3. **AMAZON_OAUTH_SETUP.md** - Setup OAuth dettagliato
4. **AUTOMATION_ENGINE.md** - Documentazione automation
5. **KDP_SYNC_SETUP.md** - Sistema KDP sync

---

## 🆘 Problemi?

### Deploy fallito
→ Controlla **RENDER_DEPLOYMENT.md** sezione Troubleshooting

### OAuth non funziona
→ Controlla **AMAZON_OAUTH_SETUP.md** sezione Troubleshooting

### Extension non si connette
→ Verifica `FRONTEND_URL` in Render env vars e ricarica extension

### Automation non parte
→ Controlla Render logs e **AUTOMATION_ENGINE.md** Troubleshooting

---

## 🎯 Secrets Importanti (SALVA!)

Avrai bisogno di questi per chiamate API admin:

```bash
AUTOMATION_SECRET=K4RCyn83PQCjwctmLEZHRBdSl3tX/hlPEdhuTIM4PwA=
ADMIN_TOKEN=0PwQ8zn6NVy8J0mFcmh6obf6Do+PkAHbBpunMlauINQ=
```

---

**Buon lavoro! Il tuo Amazon Ads Manager è pronto per gestire automaticamente le tue campagne 24/7!** 🚀

In caso di problemi, tutti i comandi e URL utili sono in **QUICK_REFERENCE.md**.
