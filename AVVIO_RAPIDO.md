# ✅ Setup Completato - Guida Rapido Avvio

## 🎉 Congratulazioni!

Il progetto è stato configurato con successo! Tutti i file sono stati compilati e sono pronti all'uso.

---

## 📋 Cosa è Stato Fatto

### ✅ Backend
- Installate tutte le dipendenze npm
- Compilato il codice TypeScript
- Aggiunta la nuova entity `AutomationConfigEntity` al database
- Create le API per gestire le configurazioni delle ottimizzazioni

### ✅ Frontend
- Installate tutte le dipendenze npm
- Compilato il progetto React/Vite
- Creato il modal di configurazione campagne
- Aggiornata la pagina Campaigns con filtri multi-marketplace

### ✅ Database
- La nuova tabella `automation_config` verrà creata automaticamente al primo avvio
  - In locale: `synchronize: true` → crea tabelle automaticamente
  - In produzione: dovrai eseguire la migration SQL manualmente

---

## 🚀 Come Avviare il Progetto

### Opzione 1: Development (Locale)

#### 1. Avvia il Backend
Apri un terminale e esegui:
```bash
cd C:\Temp\amazon-ads-manager
npm run dev
```

Il server partirà su **http://localhost:3000**

#### 2. Avvia il Frontend (nuovo terminale)
Apri un SECONDO terminale e esegui:
```bash
cd C:\Temp\amazon-ads-manager\frontend
npm run dev
```

Il frontend partirà su **http://localhost:5173**

#### 3. Apri il Browser
Vai su **http://localhost:5173** e vedrai la dashboard!

---

### Opzione 2: Production Build

#### Backend
```bash
cd C:\Temp\amazon-ads-manager
npm start
```

#### Frontend
Il frontend è già compilato in `frontend/dist/`.
Puoi servirlo con:
```bash
cd C:\Temp\amazon-ads-manager\frontend
npx serve -s dist -p 5173
```

Oppure configurare un web server (Nginx, Apache) per servire i file da `frontend/dist/`

---

## 🔧 Configurazione Database

### Se Usi Database Locale (PostgreSQL)

Assicurati di avere PostgreSQL installato e in esecuzione.

Crea un file `.env` nella root del progetto:
```env
# Database Locale
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tua_password
DB_DATABASE=amazon_ads_manager

# Amazon API
AMAZON_CLIENT_ID=tuo_client_id
AMAZON_CLIENT_SECRET=tuo_secret
AMAZON_REFRESH_TOKEN=tuo_refresh_token
AMAZON_PROFILE_ID=tuo_profile_id
AMAZON_REGION=EU

# Security
ADMIN_TOKEN=un_token_segreto_a_tua_scelta
AUTOMATION_SECRET=altro_token_segreto

# App
NODE_ENV=development
PORT=3000
```

**Nota:** Con `synchronize: true` (default in locale), TypeORM creerà automaticamente tutte le tabelle al primo avvio!

---

### Se Usi Supabase/Render (Produzione)

Configura la variabile `DATABASE_URL` nel file `.env`:
```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# Altri parametri come sopra...
```

**IMPORTANTE:** In produzione devi eseguire MANUALMENTE la migration:

```bash
# Connettiti al database e esegui:
psql $DATABASE_URL -f migrations/005_create_automation_config_table.sql
```

---

## 📱 Come Usare le Nuove Funzionalità

### 1. Sincronizza le Campagne
1. Vai su **http://localhost:5173**
2. Clicca su "Campaigns" nella sidebar
3. Clicca "Sync Singolo" o "Sync Tutti"
4. Inserisci l'`ADMIN_TOKEN` quando richiesto
5. Le campagne verranno importate da Amazon

### 2. Filtra per Marketplace
- Clicca sui pulsanti in alto: **US (15)**, **IT (8)**, **UK (5)**, etc.
- Oppure clicca "Tutti i Market" per vedere tutte

### 3. Filtra per Stato
- **Tutte**: Mostra tutte le campagne
- **Attive**: Solo campagne abilitate
- **Pause**: Solo campagne in pausa

### 4. Configura le Ottimizzazioni
1. Trova la campagna che vuoi configurare
2. Clicca il pulsante **"Impostazioni"**
3. Si aprirà un modal con 5 tab (Funzione 1-5)
4. Per ogni funzione:
   - Attiva/disattiva con il toggle
   - Modifica i parametri nei campi
5. Clicca **"Salva Configurazione"**
6. Gli indicatori (F1, F2, F3, F4, F5) si aggiorneranno automaticamente

---

## 🎨 Struttura del Progetto

```
amazon-ads-manager/
├── src/                          # Backend TypeScript
│   ├── routes/
│   │   ├── automationConfig.ts   # ✨ NUOVO: API configurazioni
│   │   ├── campaigns.ts          # ✨ MIGLIORATO: Filtri multi-marketplace
│   │   └── ...
│   ├── models/
│   │   ├── AutomationConfigEntity.ts  # ✨ NUOVO: Entity configurazioni
│   │   ├── Campaign.ts           # ✨ MIGLIORATO: Relazione con config
│   │   └── ...
│   └── config/
│       └── database.ts           # ✨ AGGIORNATO: Include AutomationConfigEntity
├── migrations/
│   └── 005_create_automation_config_table.sql  # ✨ NUOVO
├── frontend/src/
│   ├── components/
│   │   └── CampaignSettingsModal.tsx  # ✨ NUOVO: Modal configurazioni
│   ├── pages/
│   │   └── Campaigns.tsx         # ✨ MIGLIORATO: Filtri + indicatori
│   └── services/
│       └── api.ts                # ✨ AGGIORNATO: Nuovi endpoints
├── NUOVE_FUNZIONALITA.md         # 📖 Documentazione completa
└── AVVIO_RAPIDO.md               # 📖 Questa guida
```

---

## 🐛 Risoluzione Problemi

### Il backend non parte
- Verifica che PostgreSQL sia in esecuzione
- Controlla le credenziali nel file `.env`
- Verifica i log in `logs/combined.log`

### Il frontend non si connette al backend
- Verifica che il backend sia in esecuzione su porta 3000
- Controlla l'URL API in `frontend/src/services/api.ts`
- Default: `https://amazon-ads-manager.onrender.com` (produzione)
- Per locale, cambia in: `http://localhost:3000`

### Le campagne non vengono sincronizzate
- Verifica che i token Amazon siano corretti nel `.env`
- Controlla che l'`ADMIN_TOKEN` inserito sia corretto
- Guarda i log del backend per errori

### Il modal di configurazione non salva
- Verifica di aver inserito l'`ADMIN_TOKEN` corretto
- Controlla la console del browser (F12) per errori
- Verifica che il backend sia raggiungibile

---

## 📞 Supporto

Per maggiori dettagli consulta:
- **Documentazione completa**: [NUOVE_FUNZIONALITA.md](NUOVE_FUNZIONALITA.md)
- **Specifiche progetto**: [SPECIFICATIONS.md](SPECIFICATIONS.md)
- **Guida setup**: [SETUP-GUIDE.md](SETUP-GUIDE.md)

---

## 🎯 Prossimi Passi

1. ✅ Avvia backend e frontend
2. ✅ Sincronizza le campagne
3. ✅ Testa i filtri multi-marketplace
4. ✅ Configura le ottimizzazioni per alcune campagne
5. ✅ Verifica che le automazioni rispettino le configurazioni

---

**Buon lavoro! 🚀**

*Creato: 19 Novembre 2025*
