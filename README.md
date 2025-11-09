# Amazon Ads Manager

Applicazione per gestire e automatizzare le campagne pubblicitarie Amazon Ads.

## 🎯 Funzionalità

- **Gestione Campagne**: Visualizza e gestisci le tue campagne Amazon Ads
- **Gestione Keywords**: Modifica bid, pausa/attiva keyword
- **Automazioni**: Regole automatiche per ottimizzare le performance
  - Riduzione bid per keyword con ACoS alto
  - Pausa keyword con basse performance
  - Aumento bid per keyword performanti

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

### Health Check

```
GET /health
```

Verifica che il server sia attivo.

### Home

```
GET /
```

Informazioni sull'API e lista endpoints disponibili.

## 🤖 Automazioni

Le automazioni sono disabilitate di default. Per attivarle:

1. Imposta nel file `.env`:
   ```
   ENABLE_AUTOMATIONS=true
   ```

2. Configura l'intervallo di esecuzione (in minuti):
   ```
   AUTOMATION_INTERVAL_MINUTES=60
   ```

### Regole Disponibili

1. **Riduci bid ACoS alto**
   - Riduce del 10% il bid delle keyword con ACoS > 40%

2. **Pausa keyword scarse**
   - Mette in pausa keyword con CTR < 0.3% e almeno 100 impressions

3. **Aumenta bid top keywords**
   - Aumenta del 15% il bid delle keyword con ACoS < 20% e almeno 5 conversioni

Le regole possono essere personalizzate in `src/automation/rules.ts`

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
