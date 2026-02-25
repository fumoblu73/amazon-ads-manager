# Amazon Ads Manager

Sistema di automazione per campagne Amazon Advertising, ottimizzato per editori KDP con il metodo **FAST ACoS**.

- **Backend**: Node.js + TypeScript + Express + TypeORM
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL (Supabase)
- **Hosting**: Render.com (auto-deploy da branch `main`)
- **Trigger automazioni**: cron-job.org

---

## Funzionalità principali

### 5 Funzioni di automazione

| # | Nome | Campagne | Frequenza |
|---|------|----------|-----------|
| F1 | Progressive Bidding | 1–4 | ogni 3gg |
| F2 | Placement Optimization | 1–5 | ogni 7gg |
| F3 | Targeting Optimization | 1–4 | ogni 3gg (dopo F1) |
| F4 | Auto Ad Optimization | solo 5 | ogni 7gg |
| F5 | Campaign Feeding | 1–5 | ogni 7gg |

La logica algoritmica completa (FAST ACoS, fasce, parametri) è documentata in [SPECIFICATIONS.md](SPECIFICATIONS.md).

### Dashboard KDP
- Bookshelf con dati sincronizzati da Amazon KDP
- Statistiche royalties giornaliere/mensili per marketplace
- Profitto netto per libro (royalties – spesa ADS)
- Sincronizzazione automatica via estensione Chrome

### Logs e monitoraggio
- Log per ogni esecuzione (per libro, per campagna, per funzione)
- Email di notifica via Resend al completamento di ogni ciclo
- Dashboard automazioni con calendario 14 giorni

---

## Architettura automazioni

```
cron-job.org (Lun/Mer/Ven 9:30 CET)
    └── POST /submit-reports?secret=...
            ├── pre-sync campagne (tutti i marketplace)
            └── richiede report ad Amazon → salva PendingReport in DB

cron-job.org (Lun/Mer/Ven 11:00–13:00, ogni 12 min)
    └── POST /process-reports?secret=...
            ├── controlla report pronti
            ├── esegue F1–F5 per ogni campagna
            └── invia email riepilogo via Resend
```

### Schedule cron-job.org (CET)

| Schedule | Endpoint | Note |
|----------|----------|------|
| `30 9 * * 1,3,5` | POST /submit-reports | Lun/Mer/Ven |
| `*/12 11-13 * * 1,3,5` | POST /process-reports | Lun/Mer/Ven ogni 12 min |
| `18 9 * * *` | POST /refresh-spend | Tutti i giorni |

---

## Struttura progetto

```
amazon-ads-manager/
├── src/
│   ├── index.ts                    # Entry point + route registration
│   ├── entities/                   # TypeORM entities (DB tables)
│   │   ├── User.ts
│   │   ├── Campaign.ts
│   │   ├── AutomationLog.ts
│   │   ├── KdpBook.ts
│   │   ├── KdpDailyStats.ts
│   │   ├── BookSpendCache.ts
│   │   └── ...
│   ├── services/
│   │   ├── amazon-ads.service.ts   # Amazon Advertising API client
│   │   ├── reportProcessor.ts      # Orchestrazione F1–F5
│   │   ├── emailService.ts         # Notifiche via Resend
│   │   └── UserAmazonApiService.ts
│   ├── automation/
│   │   └── functions/              # func1.ts – func5.ts
│   ├── routes/                     # Express routes
│   └── utils/
│       ├── fastAcos.ts             # Calcolo FAST ACoS e fasce
│       └── timeframe.ts
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx       # ADS dashboard + automazioni
│       │   ├── Logs.tsx            # Log esecuzioni
│       │   └── kdp/                # KDP dashboard, bookshelf, statistiche
│       └── services/api.ts
├── migrations/                     # SQL migrations per Supabase
│   └── README.md
├── browser-extension/              # Estensione Chrome per KDP sync
│   └── README.md
└── SPECIFICATIONS.md               # Specifica algoritmica F1–F5
```

---

## Variabili d'ambiente (Render)

```env
# Database
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=...
SESSION_SECRET=...

# Amazon Advertising API
AMAZON_CLIENT_ID=...
AMAZON_CLIENT_SECRET=...
AMAZON_REDIRECT_URI=https://amazon-ads-manager-qsio.onrender.com/api/auth/callback

# Automazioni
AUTOMATION_SECRET=...
ADMIN_TOKEN=...

# Email (Resend)
RESEND_API_KEY=...
EMAIL_FROM=Amazon Ads Manager <noreply@...>
EMAIL_TO=...

# App
FRONTEND_URL=https://amazon-ads-manager-qsio.onrender.com
NODE_ENV=production
```

---

## Deploy

Il deploy avviene automaticamente su Render a ogni push su `main`.

Build command: `npm install && npm run build && cd frontend && npm install && npm run build`
Start command: `npm start`

---

## Estensione Chrome (KDP Sync)

L'estensione è necessaria per sincronizzare royalties e vendite KDP (il backend non può accedere a `kdpreports.amazon.com` da IP diverso).

Vedere [browser-extension/README.md](browser-extension/README.md) per installazione.

---

## Database migrations

Le migrations SQL sono nella cartella `migrations/`. Vedere [migrations/README.md](migrations/README.md) per applicarle su Supabase.
