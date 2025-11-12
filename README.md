# 🚀 Amazon Ads Manager

Sistema completo di automazione per campagne pubblicitarie Amazon Advertising, con 5 funzioni di ottimizzazione basate sul metodo **FAST ACoS**.

## 🎯 Funzionalità Principali

### 📊 5 Funzioni di Automazione

**Funzione 1: Progressive Bidding Increase**
- Aumenta progressivamente il bid di keyword/prodotti con poche impressions
- Frequenza: Ogni 3 giorni
- Applicabile a: Campagne 1, 2, 3, 4

**Funzione 2: Placement Optimization**
- Ottimizza i placement bid (Top of Search, Rest, Product Pages) in base a FAST ACoS
- Frequenza: Ogni 7 giorni
- Applicabile a: Tutte le campagne (1-5)

**Funzione 3: Targeting Optimization**
- Ottimizza bid e pausa keyword/prodotti con performance pessime
- Timeframe dinamico basato su traffico
- Frequenza: Ogni 3 giorni (dopo Funzione 1)
- Applicabile a: Campagne 1, 2, 3, 4

**Funzione 4: Auto Ad Optimization**
- Ottimizza targeting groups e gestisce negative keywords/products
- Specifico per campagne automatiche
- Frequenza: Ogni 7 giorni
- Applicabile a: Solo Campagna 5 (Auto Ads)

**Funzione 5: Campaign Feeding**
- Alimenta automaticamente le campagne con search terms performanti
- Auto-feeding intelligente tra campagne
- Frequenza: Ogni 7 giorni
- Applicabile a: Tutte le campagne (1-5)

### 🎚️ Sistema FAST ACoS

- Calcolo automatico del breakeven (FAST ACoS = Royalty / Prezzo×1.22)
- 5 fasce di performance con adjustment specifici
- Ottimizzazione basata su profittabilità reale

### ⚙️ Background Worker

- Nessun timeout HTTP su hosting free (Render.com)
- Esecuzione asincrona in background
- Monitoring in tempo reale con endpoint `/status`
- Trigger via cron-job.org

### 🔄 Timeframe Dinamico

- Adattamento automatico basato su volume di traffico
- Ottimizzazione statistica dei dati
- 4 livelli: 15, 20, 25, 30 giorni

### 🛡️ Sicurezza

- Periodo di warmup (7 giorni) prima dell'attivazione
- Token sicuri per trigger automazioni
- Autenticazione admin per trigger manuali

## 📁 Struttura Progetto

```
amazon-ads-manager/
├── src/
│   ├── index.ts              # Punto di ingresso dell'applicazione
│   ├── config/               # File di configurazione
│   │   ├── database.ts       # Configurazione database PostgreSQL
│   │   └── amazon.ts         # Configurazione API Amazon
│   ├── services/             # Servizi per integrazioni esterne
│   │   └── amazonApi.ts      # Client per Amazon Advertising API
│   ├── automation/           # Sistema di automazioni
│   │   ├── scheduler.ts      # Scheduler per esecuzioni programmate
│   │   └── rules.ts          # Definizione regole di automazione
│   ├── controllers/          # Controller per gestire le richieste API
│   ├── routes/               # Definizione endpoint REST
│   ├── models/               # Modelli database (TypeORM entities)
│   └── utils/                # Funzioni di utilità
├── package.json              # Dipendenze e script npm
├── tsconfig.json             # Configurazione TypeScript
├── .env.example              # Esempio file variabili d'ambiente
└── README.md                 # Questo file
```

## 🚀 Setup Iniziale

### 1. Installa le dipendenze

```bash
npm install
```

### 2. Configura le variabili d'ambiente

Copia il file `.env.example` in `.env` e compila i valori:

```bash
cp .env.example .env
```

Modifica `.env` con le tue credenziali Amazon Advertising API:

```env
AMAZON_CLIENT_ID=your_client_id
AMAZON_CLIENT_SECRET=your_client_secret
AMAZON_REFRESH_TOKEN=your_refresh_token
AMAZON_PROFILE_ID=your_profile_id
```

### 3. Ottieni le credenziali Amazon Advertising API

1. Vai su [https://advertising.amazon.com](https://advertising.amazon.com)
2. Accedi con il tuo account Seller/Vendor
3. Vai su "API" → "Registra Applicazione"
4. Ottieni Client ID e Client Secret
5. Completa il flusso OAuth per ottenere il Refresh Token

📚 [Guida completa Amazon Advertising API](https://advertising.amazon.com/API/docs/en-us/get-started)

## 🏃 Esecuzione

### Modalità Sviluppo (locale)

```bash
npm run dev
```

Il server partirà su `http://localhost:3000`

### Modalità Produzione (dopo build)

```bash
npm run build
npm start
```

## 📡 API Endpoints

### Public Endpoints

```bash
# Health Check
GET /health

# Info API
GET /

# Status Automazioni
GET /api/automation/status
```

### Protected Endpoints

```bash
# Trigger Automazioni (da Cron-Job.org)
POST /api/automation/trigger?secret=YOUR_AUTOMATION_SECRET

# Trigger Manuale (Admin)
POST /api/automation/trigger-manual
Headers: Authorization: Bearer YOUR_ADMIN_TOKEN
```

## 🤖 Sistema di Automazione

### Architettura

1. **Cron-Job.org** → Chiama endpoint `/trigger` ogni giorno
2. **Background Worker** → Esegue automazioni in modo asincrono
3. **Scheduler** → Coordina esecuzione delle 5 funzioni
4. **Rules Engine** → Applica logiche di ottimizzazione
5. **Amazon API** → Modifica campagne in tempo reale

### Calendario Esecuzioni (Default)

| Giorno | Funzioni Eseguite |
|--------|-------------------|
| 0 | Campagna creata |
| 1-6 | Periodo warmup (nessuna automazione) |
| 7 | Funz.1→3 + Funz.2 + Funz.4 + Funz.5 |
| 10 | Funz.1→3 |
| 13 | Funz.1→3 |
| 14 | Funz.2 + Funz.4 + Funz.5 |
| 16 | Funz.1→3 |
| ... | Continua... |

### Ordine Esecuzione Critico

**IMPORTANTE:** Funzione 1 e 3 devono essere eseguite in sequenza:
1. Prima: Funzione 1 (aumenta bid per low-impressions)
2. Poi: Funzione 3 (ottimizza/pausa in base performance)

Questo perché la Funz.1 dà visibilità, e la Funz.3 ottimizza i risultati.

## 🗄️ Database

L'applicazione usa PostgreSQL per salvare:
- Storico modifiche bid
- Log delle automazioni
- Configurazione regole personalizzate
- Cache dati Amazon API

In locale puoi usare PostgreSQL installato, in cloud userai il database fornito dal servizio di hosting.

## ☁️ Deploy in Cloud

### Railway (Consigliato)

1. Crea account su [Railway.app](https://railway.app)
2. Collega il repository GitHub
3. Railway rileva automaticamente Node.js
4. Aggiungi PostgreSQL dal marketplace
5. Configura le variabili d'ambiente
6. Deploy automatico!

### Render

1. Crea account su [Render.com](https://render.com)
2. "New" → "Web Service"
3. Connetti repository GitHub
4. Configura:
   - Build: `npm install && npm run build`
   - Start: `npm start`
5. Aggiungi PostgreSQL
6. Configura variabili d'ambiente

## 📝 Prossimi Sviluppi

- [ ] API REST per gestire campagne
- [ ] API REST per gestire keyword
- [ ] Dashboard frontend (React)
- [ ] Sistema di notifiche (email/Telegram)
- [ ] Report personalizzati
- [ ] Configurazione regole da interfaccia
- [ ] Supporto per più profili Amazon
- [ ] Integrazione con Google Sheets per report

## 🛠️ Tecnologie Utilizzate

- **Node.js** + **TypeScript** - Backend
- **Express** - Web framework
- **TypeORM** - ORM per database
- **PostgreSQL** - Database
- **node-cron** - Scheduler per automazioni
- **axios** - Client HTTP per API Amazon

## 📄 Licenza

ISC

## 🤝 Supporto

Per problemi o domande sull'API Amazon:
- [Documentazione ufficiale](https://advertising.amazon.com/API/docs)
- [Forum sviluppatori](https://advertising.amazon.com/API/docs/en-us/community)
