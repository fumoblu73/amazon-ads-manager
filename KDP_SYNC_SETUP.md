# 🔄 KDP Sync Setup Guide

Guida completa per configurare la sincronizzazione automatica Amazon KDP.

## 📋 Panoramica

Il sistema KDP Sync replica il funzionamento di Publisher Champ:
1. **Estensione browser** cattura i cookie di autenticazione KDP
2. **Backend** utilizza i cookie per fare scraping dei dati
3. **Scheduler** sincronizza automaticamente ogni 6 ore

## ⚙️ Configurazione Backend

### 1. Variabili Ambiente

Aggiungi al tuo `.env`:

```bash
# Cookie Encryption (OBBLIGATORIO)
# Genera con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_character_hex_encryption_key

# Altre variabili già configurate
NODE_ENV=production
DATABASE_URL=your_postgresql_url
```

### 2. Database Migration

Le nuove colonne verranno create automaticamente al prossimo deploy (se `synchronize=true` in development).

In produzione, verifica che queste colonne esistano nella tabella `users`:
- `kdp_cookies_encrypted` (text)
- `kdp_marketplace` (varchar 50)
- `kdp_cookies_updated_at` (timestamp)
- `kdp_last_sync_at` (timestamp)
- `kdp_sync_enabled` (boolean)

### 3. Installazione Dipendenze

```bash
npm install puppeteer
```

**IMPORTANTE per Render/Heroku**: Puppeteer richiede dipendenze di sistema.

Aggiungi al `render.yaml` o Dockerfile:

```yaml
# render.yaml
services:
  - type: web
    name: amazon-ads-manager
    env: node
    buildCommand: |
      # Install Chromium dependencies
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
        xdg-utils
      npm install
      npm run build
```

### 4. Avvia lo Scheduler

Modifica `src/index.ts`:

```typescript
import { kdpSyncScheduler } from './services/kdp-sync-scheduler';

// Nel startServer()
kdpSyncScheduler.start();
```

## 🌐 Setup Estensione Chrome

### 1. Configurazione

Modifica `browser-extension/popup.js`:

```javascript
// Cambia l'URL con il tuo backend in produzione
const API_URL = 'https://your-app.onrender.com';
```

### 2. Crea Icone

Crea le icone nella cartella `browser-extension/images/`:
- `icon16.png` (16x16px)
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

Puoi usare il logo della tua app o scaricare icone gratuite da [Icons8](https://icons8.com).

### 3. Carica in Chrome

1. Apri `chrome://extensions/`
2. Attiva "Modalità sviluppatore"
3. Clicca "Carica estensione non pacchettizzata"
4. Seleziona la cartella `browser-extension`

### 4. Distribuzione (Opzionale)

Per distribuire pubblicamente:
1. Crea un account [Chrome Web Store Developer](https://chrome.google.com/webstore/devconsole/)
2. Paga la registrazione ($5 una tantum)
3. Carica l'estensione compressa (zip della cartella `browser-extension`)
4. Compila il form di pubblicazione

## 👤 Utilizzo Utente

### Primo Setup

1. L'utente fa login nella tua app (OAuth Amazon Ads)
2. Installa l'estensione Chrome
3. Va su `https://kdp.amazon.com` e fa login
4. Apre l'estensione e clicca "🔄 Sincronizza con KDP"
5. I cookie vengono inviati al backend e criptati

### Sincronizzazione Automatica

Una volta configurato:
- Lo scheduler sincronizza automaticamente ogni 6 ore
- L'utente può forzare sync manuale dall'estensione
- I cookie vengono aggiornati automaticamente

### Refresh Cookie

I cookie scadono dopo ~7 giorni. Quando scadono:
1. L'utente riceve notifica nell'app
2. Deve riaprire kdp.amazon.com
3. Cliccare nuovamente "Sincronizza con KDP" nell'estensione

## 🔒 Sicurezza

### Criptazione Cookie

I cookie vengono criptati con AES-256-GCM prima di essere salvati:

```typescript
import { encryptCookies, decryptCookies } from './utils/encryption';

const encrypted = encryptCookies(JSON.stringify(cookies));
// Salva nel database

const decrypted = decryptCookies(encrypted);
// Usa per scraping
```

### Best Practices

- ✅ Usa HTTPS in produzione
- ✅ Implementa rate limiting sugli endpoint
- ✅ Log delle operazioni di sync
- ✅ Notifiche se sync fallisce
- ⚠️ Avvisa utenti dei rischi (ToS Amazon)

## 📊 API Endpoints

### POST /api/kdp-sync/cookies
Riceve cookie dall'estensione

**Body**:
```json
{
  "cookies": [...],
  "marketplace": "US"
}
```

### GET /api/kdp-sync/status
Controlla stato sincronizzazione

**Response**:
```json
{
  "success": true,
  "data": {
    "syncEnabled": true,
    "cookiesUpdatedAt": "2024-01-15T10:30:00Z",
    "lastSyncAt": "2024-01-15T14:00:00Z",
    "marketplace": "US",
    "needsRefresh": false
  }
}
```

### DELETE /api/kdp-sync/cookies
Disabilita sync e rimuove cookie

## 🐛 Troubleshooting

### Errore: "Chromium not found"

Installa dipendenze di sistema:
```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser

# macOS
brew install chromium
```

### Errore: "Cookie scaduti"

Chiedi all'utente di:
1. Andare su kdp.amazon.com
2. Fare logout e re-login
3. Risincronizzare con l'estensione

### Scraping fallisce

Verifica:
- Cookie validi e non scaduti
- Pagina KDP non ha cambiato struttura HTML
- Timeout adeguati in Puppeteer

## 📈 Monitoraggio

Controlla i log per:
```
✅ KDP cookies saved for user {userId}
🔄 Starting KDP sync for user {userId}
✅ Found {n} books in bookshelf
❌ Scraping error: ...
```

## ⚖️ Note Legali

⚠️ **IMPORTANTE**: Web scraping di Amazon KDP può violare i Terms of Service.

- Informa gli utenti dei rischi
- Aggiungi disclaimer nell'app
- Considera di usare solo per uso personale
- Amazon potrebbe bloccare account che violano i ToS

## 🔄 Alternative Future

Se Amazon rilascia API KDP ufficiali:
1. Rimuovi il sistema di scraping
2. Implementa chiamate API ufficiali
3. Mantieni la stessa interfaccia per gli utenti
