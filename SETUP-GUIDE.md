# 🚀 Guida Setup Amazon Ads Manager

Questa guida ti aiuterà a configurare Amazon Ads Manager passo dopo passo.

---

## 📋 Prerequisiti

- Node.js v18 o superiore
- Account Amazon Advertising con API attivata
- Database PostgreSQL (Supabase consigliato per free tier)
- Account su Render.com (free tier)
- Account su Cron-Job.org (opzionale, per trigger automatici)

---

## 1️⃣ Configurazione Credenziali Amazon

### Passo 1: Ottieni Client ID e Client Secret

1. Vai su [Amazon Advertising API](https://advertising.amazon.com/API/docs)
2. Registra la tua applicazione
3. Ottieni `Client ID` e `Client Secret`

### Passo 2: Genera Refresh Token

Usa lo script fornito:

```bash
node get-refresh-token.js
```

Segui le istruzioni a schermo per completare l'autorizzazione OAuth.

### Passo 3: Ottieni Profile ID

Usa lo script fornito:

```bash
node get-profile-id.js
```

Questo ti mostrerà tutti i profili pubblicitari disponibili.

---

## 2️⃣ Configurazione File .env

### Passo 1: Copia il file di esempio

```bash
cp .env.example .env
```

### Passo 2: Compila le variabili

Apri il file `.env` e inserisci i tuoi valori:

```env
# Amazon API
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=xxxxx
AMAZON_REFRESH_TOKEN=Atzr|xxxxx
AMAZON_PROFILE_ID=1234567890
AMAZON_REGION=EU

# Security
AUTOMATION_SECRET=genera-con-openssl-rand-hex-32
ADMIN_TOKEN=genera-con-openssl-rand-hex-32

# Database (Supabase)
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres
```

### Passo 3: Genera token sicuri

**Linux/Mac:**
```bash
openssl rand -hex 32
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Online:**
Visita https://www.uuidgenerator.net/ e genera UUID v4

---

## 3️⃣ Setup Database (Supabase)

### Passo 1: Crea progetto Supabase

1. Vai su [Supabase](https://supabase.com)
2. Crea un nuovo progetto (free tier)
3. Annota il `DATABASE_URL` dalle impostazioni

### Passo 2: Esegui le migration SQL

Crea le seguenti tabelle nel SQL Editor di Supabase:

```sql
-- Tabella Books
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asin VARCHAR(10) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  printing_cost DECIMAL(10, 2) NOT NULL,
  royalty_percentage DECIMAL(5, 2) DEFAULT 60,
  fast_acos DECIMAL(5, 2),
  marketplace VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella Campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amazon_campaign_id VARCHAR(255) NOT NULL UNIQUE,
  book_id UUID REFERENCES books(id),
  name TEXT NOT NULL,
  type INTEGER NOT NULL CHECK (type >= 1 AND type <= 5),
  state VARCHAR(50) NOT NULL,
  daily_budget DECIMAL(10, 2),
  campaign_type VARCHAR(100),
  marketplace VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella Automation Config
CREATE TABLE automation_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) UNIQUE,
  book_id UUID REFERENCES books(id),

  -- Funzione 1
  func1_enabled BOOLEAN DEFAULT TRUE,
  func1_bid_increase DECIMAL(10, 2) DEFAULT 0.02,
  func1_frequency INTEGER DEFAULT 3,
  func1_impressions INTEGER DEFAULT 20,
  func1_clicks INTEGER DEFAULT 0,

  -- Funzione 2
  func2_enabled BOOLEAN DEFAULT TRUE,
  func2_frequency INTEGER DEFAULT 7,
  func2_timeframe_weeks INTEGER DEFAULT 4,

  -- Funzione 3
  func3_enabled BOOLEAN DEFAULT TRUE,
  func3_frequency INTEGER DEFAULT 3,
  func3_timeframe_a INTEGER DEFAULT 2000,
  func3_timeframe_b INTEGER DEFAULT 3000,
  func3_timeframe_c INTEGER DEFAULT 5000,
  func3_clicks_pause INTEGER DEFAULT 10,
  func3_clicks_65days INTEGER DEFAULT 30,

  -- Funzione 4
  func4_enabled BOOLEAN DEFAULT TRUE,
  func4_frequency INTEGER DEFAULT 7,
  func4_timeframe_a INTEGER DEFAULT 1000,
  func4_timeframe_b INTEGER DEFAULT 3000,
  func4_timeframe_c INTEGER DEFAULT 5000,
  func4_clicks_negative INTEGER DEFAULT 10,
  func4_spend_negative DECIMAL(10, 2) DEFAULT 10,

  -- Funzione 5
  func5_enabled BOOLEAN DEFAULT TRUE,
  func5_frequency INTEGER DEFAULT 7,
  func5_min_orders INTEGER DEFAULT 1,
  func5_bid_broad DECIMAL(10, 2) DEFAULT 0.30,
  func5_bid_exact DECIMAL(10, 2) DEFAULT 0.50,
  func5_bid_phrase DECIMAL(10, 2) DEFAULT 0.40,
  func5_bid_expanded DECIMAL(10, 2) DEFAULT 0.30,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella Automation Logs
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id),
  function_name VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_id VARCHAR(255),
  target_name TEXT,
  old_value DECIMAL(10, 2),
  new_value DECIMAL(10, 2),
  reason TEXT,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_campaigns_book_id ON campaigns(book_id);
CREATE INDEX idx_automation_config_campaign_id ON automation_config(campaign_id);
CREATE INDEX idx_automation_logs_campaign_id ON automation_logs(campaign_id);
CREATE INDEX idx_automation_logs_created_at ON automation_logs(created_at);
```

---

## 4️⃣ Installazione Dipendenze

```bash
npm install
```

Verifica che tutte le dipendenze siano installate:

```bash
npm list
```

---

## 5️⃣ Test in Locale

### Avvia il server

```bash
npm run dev
```

### Testa gli endpoint

**1. Health Check:**
```bash
curl http://localhost:3000/health
```

**2. Status Automazioni:**
```bash
curl http://localhost:3000/api/automation/status
```

**3. Trigger Manuale (con ADMIN_TOKEN):**
```bash
curl -X POST http://localhost:3000/api/automation/trigger-manual \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 6️⃣ Deploy su Render.com

### Passo 1: Crea Web Service

1. Vai su [Render.com](https://render.com)
2. Crea nuovo Web Service
3. Connetti il tuo repository GitHub
4. Configura:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

### Passo 2: Configura Environment Variables

Aggiungi tutte le variabili dal tuo `.env`:

- `AMAZON_CLIENT_ID`
- `AMAZON_CLIENT_SECRET`
- `AMAZON_REFRESH_TOKEN`
- `AMAZON_PROFILE_ID`
- `AMAZON_REGION`
- `AUTOMATION_SECRET`
- `ADMIN_TOKEN`
- `DATABASE_URL`
- `NODE_ENV=production`

### Passo 3: Deploy

Render farà automaticamente il deploy. Attendi 2-3 minuti.

---

## 7️⃣ Configurazione Cron-Job.org (Opzionale)

### Passo 1: Crea Account

Vai su [Cron-Job.org](https://cron-job.org) e registrati.

### Passo 2: Crea Cron Job

1. Clicca "Create Cronjob"
2. Configura:
   - **Title:** Amazon Ads Automation
   - **URL:** `https://your-app.onrender.com/api/automation/trigger?secret=YOUR_AUTOMATION_SECRET`
   - **Schedule:** Ogni giorno alle 09:00 (personalizza)
   - **Request Method:** POST

### Passo 3: Testa

Clicca "Execute now" per testare il trigger.

---

## 8️⃣ Monitoraggio

### Log su Render

Vai su Render Dashboard → Logs per vedere l'output in tempo reale.

### Check Status

```bash
curl https://your-app.onrender.com/api/automation/status
```

Dovresti vedere:
```json
{
  "scheduler": {
    "isRunning": true,
    "triggerMethod": "external"
  },
  "lastExecution": {
    "startedAt": "2025-11-12T09:00:00.000Z",
    "completedAt": "2025-11-12T09:03:45.000Z",
    "status": "completed",
    "duration": "3.75 minutes"
  }
}
```

---

## 🔧 Troubleshooting

### Problema: "Invalid secret"

- Verifica che `AUTOMATION_SECRET` su Render corrisponda al secret nel URL di cron-job

### Problema: "Cannot connect to database"

- Verifica che `DATABASE_URL` sia corretto
- Controlla che Supabase sia attivo

### Problema: "Timeout on Render"

- Normale! Il background worker gestisce le automazioni che possono durare 10+ minuti
- Controlla i log per vedere il progresso

### Problema: "Amazon API error"

- Verifica credenziali Amazon
- Controlla che il Refresh Token non sia scaduto
- Rigenera il token con `get-refresh-token.js`

---

## 📚 Risorse Utili

- [Amazon Advertising API Docs](https://advertising.amazon.com/API/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Render Documentation](https://render.com/docs)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 🆘 Supporto

Se hai problemi:

1. Controlla i log su Render
2. Verifica le variabili d'ambiente
3. Testa gli endpoint manualmente
4. Apri una issue su GitHub

---

**Fatto! 🎉 Il tuo Amazon Ads Manager è pronto!**
