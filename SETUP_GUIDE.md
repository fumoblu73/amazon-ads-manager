# 🚀 Guida Setup Amazon Ads Manager (Per Principianti)

Questa guida ti accompagnerà passo dopo passo per configurare e testare il sistema di sincronizzazione KDP.

## 📋 Prerequisiti

Prima di iniziare, assicurati di avere:
- ✅ Node.js installato (versione 16 o superiore)
- ✅ PostgreSQL installato e in esecuzione
- ✅ Google Chrome installato (per l'estensione)
- ✅ Un account Amazon KDP attivo

---

## 📦 Passo 1: Setup Iniziale

### 1.1 Installare le Dipendenze

Apri il terminale nella cartella del progetto ed esegui:

```bash
# Backend
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 1.2 Configurare il Database

Crea un file `.env` nella root del progetto:

```bash
# Copia il file di esempio
cp .env.example .env
```

Modifica `.env` con le tue credenziali PostgreSQL:

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=tuaPassword
DATABASE_NAME=amazon_ads_manager

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=tuoSegretoDiMinimo32Caratteri123456

# Encryption (per cookie KDP)
ENCRYPTION_KEY=unAltroSegretoDi32CaratteriPer0000

# Mock data (per testing senza KDP reale)
USE_MOCK_DATA=false
```

### 1.3 Creare il Database

Apri PostgreSQL e crea il database:

```sql
CREATE DATABASE amazon_ads_manager;
```

Le tabelle verranno create automaticamente all'avvio del server (grazie a TypeORM `synchronize: true`).

---

## 🎯 Passo 2: Avviare l'Applicazione

### 2.1 Avviare il Backend

In un terminale:

```bash
npm run dev
```

Dovresti vedere:

```
✅ Database connected
🔧 Running migrations...
🚀 Server running on port 3000
✅ KDP sync scheduler started (runs every 6 hours)
```

### 2.2 Avviare il Frontend

In un **nuovo** terminale:

```bash
cd frontend
npm run dev
```

Dovresti vedere:

```
VITE v7.x.x ready in XXX ms
➜  Local:   http://localhost:5173/
```

### 2.3 Aprire l'Applicazione

Apri il browser e vai su: **http://localhost:5173**

---

## 👤 Passo 3: Creare un Account Utente

### 3.1 Registrazione

1. Clicca su **"Sign Up"** (oppure vai su http://localhost:5173/signup)
2. Compila il form:
   - **Email**: tuo.email@example.com
   - **Password**: Password123! (minimo 8 caratteri)
   - **Nome**: Il tuo nome
3. Clicca **"Create Account"**

### 3.2 Login

1. Vai su http://localhost:5173/login
2. Inserisci email e password
3. Clicca **"Sign In"**

Verrai reindirizzato alla dashboard principale.

---

## 🍪 Passo 4: Installare e Configurare l'Estensione Chrome

### 4.1 Caricare l'Estensione

1. Apri Chrome e vai su: **chrome://extensions/**
2. Attiva **"Modalità sviluppatore"** (toggle in alto a destra)
3. Clicca **"Carica estensione non pacchettizzata"**
4. Seleziona la cartella: `C:\Temp\amazon-ads-manager\browser-extension`
5. L'estensione dovrebbe apparire nella lista

### 4.2 Configurare l'URL dell'API

Prima di usare l'estensione, controlla che l'URL dell'API sia corretto:

1. Apri il file: `browser-extension/popup.js`
2. Cerca questa riga:

```javascript
const API_URL = 'http://localhost:3000';
```

3. Se stai usando il server locale, lascia `http://localhost:3000`
4. Se il backend è su un server remoto, cambia con l'URL corretto (es: `https://mio-server.com`)

### 4.3 Aggiungere Icone (Opzionale)

Per un'esperienza migliore, aggiungi le icone:

1. Crea le immagini:
   - `browser-extension/images/icon16.png` (16x16 pixel)
   - `browser-extension/images/icon48.png` (48x48 pixel)
   - `browser-extension/images/icon128.png` (128x128 pixel)

2. Puoi usare qualsiasi logo (es: logo Amazon KDP, o creare uno personalizzato)

---

## 🔗 Passo 5: Sincronizzare Cookie KDP

Questo è il passo **più importante** per far funzionare tutto!

### 5.1 Accedere a Amazon KDP

1. Apri una nuova tab Chrome
2. Vai su: **https://kdp.amazon.com**
3. Fai il **login** con il tuo account KDP
4. Assicurati di essere sulla pagina della Bookshelf

### 5.2 Sincronizzare Cookie con l'Estensione

1. Clicca sull'icona dell'estensione nella barra di Chrome (in alto a destra)
2. Nel popup, vedrai:
   - Titolo: "Amazon Ads Manager - KDP Sync"
   - Pulsante: **"🔄 Sincronizza con KDP"**
3. Clicca su **"🔄 Sincronizza con KDP"**
4. Aspetta qualche secondo
5. Dovresti vedere un messaggio di successo: **"✅ Cookie sincronizzati"**

**Cosa succede dietro le quinte:**
- L'estensione legge i cookie di autenticazione Amazon dalla tua sessione
- Li invia al backend via API (POST /api/kdp-sync/cookies)
- Il backend li cripta e salva nel database
- Abilita automaticamente `kdpSyncEnabled = true` per il tuo utente

### 5.3 Verificare lo Stato

1. Nel popup dell'estensione, clicca su **"📊 Verifica Stato"**
2. Dovresti vedere:

```
✅ Sync abilitato
🍪 Cookie aggiornati: 0 giorni fa
📅 Ultima sync: Mai (se è la prima volta)
🌎 Marketplace: US
⏰ Giorni alla scadenza: 7
```

---

## 🔄 Passo 6: Prima Sincronizzazione Manuale

Ora che i cookie sono configurati, possiamo sincronizzare i dati KDP!

### 6.1 Sincronizzazione via Dashboard (Frontend)

1. Vai su: **http://localhost:5173/bookshelf**
2. Clicca sul pulsante **"🔄 Sync KDP Data"** (in alto)
3. Aspetta che la sincronizzazione completi (può richiedere 1-2 minuti)
4. Vedrai un messaggio di successo con il numero di libri sincronizzati

### 6.2 Sincronizzazione via API (Backend)

In alternativa, puoi usare l'API direttamente:

```bash
# Prima, ottieni il tuo token JWT (dalla dashboard frontend, inspeziona Network tab)
# Oppure fai login via API:

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tuo.email@example.com",
    "password": "Password123!"
  }'

# Copia il token dalla risposta, poi:

curl -X POST http://localhost:3000/api/kdp/books/sync \
  -H "Authorization: Bearer IL_TUO_TOKEN_QUI"
```

### 6.3 Cosa Viene Sincronizzato

Durante la prima sync, il sistema:

1. **Bookshelf Sync** (Step 1/2):
   - Accede a `https://kdp.amazon.com/bookshelf`
   - Estrae tutti i libri Paperback
   - Salva in tabella `kdp_books`: titolo, ASIN, autore, copertina, prezzo, etc.

2. **Sales & Royalties Sync** (Step 2/2):
   - Accede a `https://kdpreports.amazon.com`
   - Scraping Sales Dashboard (ultimi 90 giorni)
   - Scraping Payments & Royalties
   - Salva in tabella `kdp_daily_stats`: vendite, royalties, spese per ASIN/data

**Tempo stimato:**
- 25 libri → ~1 minuto
- 100 libri → ~3 minuti
- Dipende dal numero di libri e dalla velocità di Amazon

---

## 📊 Passo 7: Visualizzare i Dati

### 7.1 Bookshelf (Lista Libri)

1. Vai su: **http://localhost:5173/bookshelf**
2. Vedrai tutti i libri sincronizzati con:
   - Copertina
   - Titolo
   - ASIN
   - Prezzo
   - Data pubblicazione

### 7.2 Analytics Dashboard

1. Vai su: **http://localhost:5173/kdp-dashboard**
2. Vedrai grafici e statistiche:
   - Vendite totali
   - Royalties
   - ROI (Return on Investment)
   - Grafici temporali

### 7.3 Reports Dettagliati

Altre pagine disponibili:
- **Historical Stats**: Trend storici
- **Book Stats**: Confronto tra libri
- **Country Stats**: Vendite per paese
- **Month Comparison**: Confronto mensile

---

## 📅 Passo 8: Importare Dati Storici (Opzionale)

Per importare mesi precedenti (oltre gli ultimi 90 giorni):

### 8.1 Via Frontend

1. Vai su: **http://localhost:5173/settings**
2. Sezione "KDP Sync"
3. Clicca **"📥 Import Historical Data"**
4. Aspetta (può richiedere 5-10 minuti per 12 mesi)
5. Vedrai il numero di mesi importati

### 8.2 Via API

```bash
curl -X POST http://localhost:3000/api/kdp/books/sync-historical \
  -H "Authorization: Bearer IL_TUO_TOKEN_QUI"
```

**Cosa fa:**
- Scarica tutti i CSV "Prior Month's Royalties" disponibili da KDP Reports
- Parse e import in database
- Popola `kdp_daily_stats` con dati storici

---

## ⏰ Passo 9: Sync Automatico

### 9.1 Come Funziona

Una volta configurato, il sistema sincronizza automaticamente **ogni 6 ore**:

```
00:00 → Sync automatico
06:00 → Sync automatico
12:00 → Sync automatico
18:00 → Sync automatico
```

### 9.2 Verificare Scheduler

Controlla i log del backend:

```bash
# Nel terminale dove hai avviato npm run dev, vedrai:

✅ KDP sync scheduler started (runs every 6 hours)
🔄 Starting scheduled KDP sync for all users
📋 Found 1 users with KDP sync enabled
🔄 Syncing user tuo.email@example.com (US)
📚 Step 1/2: Syncing bookshelf...
✅ Bookshelf: 25 books
💰 Step 2/2: Syncing sales & royalties...
✅ Sales: 90 sales, 90 royalties
✅ User tuo.email@example.com fully synced
```

### 9.3 Disabilitare Sync Automatico

Se vuoi fare solo sync manuali:

1. Vai su: **http://localhost:5173/settings**
2. Sezione "KDP Sync"
3. Toggle **"Disable Auto Sync"**

Oppure via estensione:
1. Apri estensione Chrome
2. Clicca **"🗑️ Disabilita Sync"**

---

## 🔧 Troubleshooting (Risoluzione Problemi)

### ❌ "Authentication failed - redirected to login"

**Problema:** I cookie KDP sono scaduti o invalidi

**Soluzione:**
1. Vai su https://kdp.amazon.com
2. Fai logout e login di nuovo
3. Apri l'estensione Chrome
4. Clicca **"🔄 Sincronizza con KDP"** di nuovo

### ❌ "Cookie scaduti" (dopo 7 giorni)

**Problema:** Amazon fa scadere i cookie dopo ~7 giorni

**Soluzione:**
- Riceverai una notifica automatica dopo 5 giorni
- Ripeti la sincronizzazione cookie (vedi Passo 5.2)

### ❌ "Book not found for ASIN"

**Problema:** Sales data per un libro non in bookshelf

**Soluzione:**
1. Esegui prima sync bookshelf: `POST /api/kdp/books/sync`
2. Poi sync sales data

### ❌ Backend non si avvia

**Problema:** Errore database o dipendenze mancanti

**Soluzione:**
```bash
# 1. Verifica PostgreSQL sia in esecuzione
# 2. Verifica credenziali in .env
# 3. Reinstalla dipendenze
rm -rf node_modules
npm install
npm run dev
```

### ❌ "No API data intercepted"

**Problema:** KDP Reports ha cambiato API o network troppo lento

**Soluzione:**
- Il sistema userà automaticamente HTML scraping come fallback
- Funziona comunque, solo un po' più lento

---

## 🎓 FAQ (Domande Frequenti)

### Q: Ogni quanto devo sincronizzare i cookie?

**A:** Ogni ~7 giorni. Riceverai una notifica automatica dopo 5 giorni.

### Q: Posso usare più marketplace (US, UK, IT, etc.)?

**A:** Attualmente supporta un marketplace per utente. Per multi-marketplace serve estendere il sistema.

### Q: I miei dati KDP sono sicuri?

**A:** Sì! I cookie vengono criptati con AES-256 prima di essere salvati. Solo il tuo backend può decriptarli.

### Q: Posso disabilitare sync automatico?

**A:** Sì, dalla dashboard Settings o via estensione Chrome.

### Q: Quanto tempo richiede la prima sync?

**A:** 1-3 minuti per 25-100 libri. Import storico: 5-10 minuti per 12 mesi.

### Q: Cosa succede se Amazon cambia il sito?

**A:** Il sistema usa approccio ibrido (API + HTML scraping), quindi è più robusto. Potrebbe servire aggiornare i selettori CSS.

---

## 📝 Checklist Finale

Prima di usare in produzione, verifica:

- [ ] ✅ Backend avviato e connesso al database
- [ ] ✅ Frontend avviato e accessibile
- [ ] ✅ Account utente creato
- [ ] ✅ Estensione Chrome installata e configurata
- [ ] ✅ Cookie KDP sincronizzati (< 7 giorni fa)
- [ ] ✅ Prima sync completata con successo
- [ ] ✅ Libri visibili in /bookshelf
- [ ] ✅ Statistiche visibili in /kdp-dashboard
- [ ] ✅ Sync automatico schedulato (ogni 6 ore)

---

## 🚀 Prossimi Passi

Ora che tutto funziona:

1. **Esplora i dashboard**: Vai su tutte le pagine analytics
2. **Import storico**: Se vuoi dati oltre 90 giorni
3. **Personalizza**: Modifica grafici e visualizzazioni
4. **Deploy**: Quando pronto, deploy su server di produzione (Render, Heroku, AWS, etc.)

---

## 💡 Supporto

Se hai problemi:
1. Controlla i log del backend (terminale `npm run dev`)
2. Controlla la console browser (F12 → Console)
3. Leggi [docs/KDP_SYNC_GUIDE.md](docs/KDP_SYNC_GUIDE.md) per dettagli tecnici
4. Apri un issue su GitHub

---

**Buon lavoro! 🎉**
