# 🤖 Automation Engine - Complete Guide

Sistema di automazione completo per Amazon Ads con 5 funzioni intelligenti.

## 📋 Panoramica

L'Automation Engine gestisce automaticamente le campagne pubblicitarie Amazon tramite:
- **Scheduler interno** basato su node-cron
- **5 funzioni di automazione** con logica Publisher Champ
- **Esecuzione programmata** con frequenze personalizzabili
- **Logging dettagliato** di tutte le operazioni

## 🔧 Funzioni di Automazione

### Funzione 1: Progressive Bidding Increase
**Applicabile a**: Campagne 1-4 (Keyword Targeting, Product Targeting, Keyword Super, Product Super)

**Frequenza**: Ogni 3 giorni (Lun/Mer/Ven 10:30 IT)

**Logica**:
1. Recupera metriche keyword/target ultimi N giorni
2. Per ogni keyword/target con:
   - `impressions > maxImpressions` (default: 20)
   - `clicks <= maxClicks` (default: 0)
   - Bid corrente < Campaign Default Bid
3. Aumenta bid di `bidIncrease` (default: +2%)
4. Log operazione in `automation_logs`

**Parametri configurabili**:
```typescript
{
  bidIncrease: 0.02,        // +2% incremento bid
  frequency: 3,             // Ogni 3 giorni
  maxImpressions: 20,       // Soglia impressioni
  maxClicks: 0              // Soglia click
}
```

---

### Funzione 2: Placement Optimization
**Applicabile a**: Tutte le campagne

**Frequenza**: Ogni 7 giorni (Lunedì 11:30 IT)

**Logica**:
1. Recupera metriche placement ultimi 4 settimane
2. Calcola FAST ACoS (Formula Amazon Superpowered Targeting):
   ```
   FAST ACoS = ((price × royalty%) - printing_cost) / price × 100
   ```
3. Per ogni placement (Top of Search, Rest of Search, Product Pages):
   - Se `ACoS < FAST ACoS × 0.65`: aumenta placement bid del +5%
   - Se `ACoS > FAST ACoS`: diminuisci placement bid del -5%
4. Applica modifiche tramite Amazon Ads API
5. Log operazioni

**Parametri configurabili**:
```typescript
{
  frequency: 7,                 // Ogni 7 giorni
  placementTimeframeWeeks: 4    // Analizza ultimi 4 settimane
}
```

---

### Funzione 3: Targeting Optimization
**Applicabile a**: Campagne 1-4 (NOT Campaign 5 - Auto)

**Frequenza**: Ogni 3 giorni (Lun/Mer/Ven 10:30 IT) - STESSA di Funzione 1

**Logica**:
Calcola timeframe dinamico in base a impressioni totali ultimi 30 giorni:
- `< 2000 impressions`: Timeframe A (es. 65 giorni)
- `2000-3000`: Timeframe B (es. 45 giorni)
- `3000-5000`: Timeframe C (es. 30 giorni)
- `> 5000`: Timeframe D (20 giorni)

Per ogni keyword/target:
1. **Pause targets con zero ordini**:
   - Se `clicks >= clicksPause` (default: 10) E `orders = 0`
   - Pausa il target
2. **Converti a Negative Exact**:
   - Se ultimi 65 giorni: `clicks >= clicks65days` (default: 30) E `orders = 0`
   - Aggiungi keyword come Negative Exact nel campaign
   - Pausa il target

**Parametri configurabili**:
```typescript
{
  frequency: 3,           // Ogni 3 giorni
  timeframeA: 2000,       // Soglia impressioni per timeframe A
  timeframeB: 3000,       // Soglia per timeframe B
  timeframeC: 5000,       // Soglia per timeframe C
  clicksPause: 10,        // Click prima di pausare
  clicks65days: 30        // Click ultimi 65gg per negative
}
```

---

### Funzione 4: Auto Ad Optimization
**Applicabile a**: SOLO Campagna 5 (AD Automatica)

**Frequenza**: Ogni 7 giorni (Lunedì 11:30 IT)

**Logica**:
Stesso calcolo timeframe dinamico di Funzione 3.

Per ogni auto target:
1. **Converti a Negative con clicks**:
   - Se `clicks >= clicksNegative` (default: 10) E `orders = 0`
   - Aggiungi ASIN come Negative Exact in Campagna 1 (Keyword Targeting)
   - Pausa auto target in Campagna 5
2. **Converti a Negative con spend**:
   - Se `spend >= spendNegative` (default: $10) E `orders = 0`
   - Aggiungi ASIN come Negative Exact in Campagna 1
   - Pausa auto target in Campagna 5

**Parametri configurabili**:
```typescript
{
  frequency: 7,           // Ogni 7 giorni
  timeframeA: 1000,       // Soglia impressioni
  timeframeB: 3000,
  timeframeC: 5000,
  clicksNegative: 10,     // Click per negative
  spendNegative: 10       // Spesa ($) per negative
}
```

---

### Funzione 5: Campaign Feeding
**Applicabile a**: Campagna 5 (AD Automatica) → Feed altre campagne

**Frequenza**: Ogni 7 giorni (Lunedì 11:30 IT)

**Logica**:
Analizza auto targets con ordini per "alimentare" campagne manuali:

1. **Recupera auto targets con ordini**:
   - Filtra targets Campagna 5 con `orders >= minOrders` (default: 1)
2. **Estrai ASIN e Search Term**:
   - ASIN dal target automatico
   - Search Term da query report
3. **Feed Campagne Manuali**:
   - **Campagna 1** (Keyword Targeting - Broad): Aggiungi Search Term come keyword Broad, bid = `bidBroad` (default: $0.30)
   - **Campagna 2** (Product Targeting): Aggiungi ASIN come product target, bid = `bidExpanded` (default: $0.30)
   - **Campagna 3** (Keyword Super - Exact): Aggiungi Search Term come Exact, bid = `bidExact` (default: $0.50)
   - **Campagna 4** (Product Super - Phrase): Aggiungi Search Term come Phrase, bid = `bidPhrase` (default: $0.40)

**Parametri configurabili**:
```typescript
{
  frequency: 7,           // Ogni 7 giorni
  minOrders: 1,           // Ordini minimi per considerare target
  bidBroad: 0.30,         // Bid per Broad keyword (Campaign 1)
  bidExact: 0.50,         // Bid per Exact keyword (Campaign 3)
  bidPhrase: 0.40,        // Bid per Phrase keyword (Campaign 4)
  bidExpanded: 0.30       // Bid per Product targeting (Campaign 2)
}
```

---

## 📅 Schedule di Esecuzione

### Scheduler Interno (Node-cron)

```typescript
// Funzioni 1 + 3: Lunedì/Mercoledì/Venerdì alle 10:30 ora italiana (09:30 UTC)
func1and3_schedule: '30 9 * * 1,3,5'
func1and3_enabled: true

// Funzioni 2 + 4 + 5: Lunedì alle 11:30 ora italiana (10:30 UTC)
func2and4and5_schedule: '30 10 * * 1'
func2and4and5_enabled: true
```

### Ordine di Esecuzione

```
Lunedì 10:30 IT:
  1. Funzione 1 (Progressive Bidding)
  2. Funzione 3 (Targeting Optimization)

Lunedì 11:30 IT:
  1. Funzione 2 (Placement Optimization)
  2. Funzione 4 (Auto Ad Optimization)
  3. Funzione 5 (Campaign Feeding)

Mercoledì 10:30 IT:
  1. Funzione 1 (Progressive Bidding)
  2. Funzione 3 (Targeting Optimization)

Venerdì 10:30 IT:
  1. Funzione 1 (Progressive Bidding)
  2. Funzione 3 (Targeting Optimization)
```

---

## 🌐 API Endpoints

### POST /api/automation/trigger

**Descrizione**: Trigger manuale globale (tutti gli users)

**Auth**: Query param `secret` deve matchare `AUTOMATION_SECRET` env var

**Esempio**:
```bash
curl -X POST "https://your-app.onrender.com/api/automation/trigger?secret=your-secret"
```

**Response**:
```json
{
  "success": true,
  "message": "Automations queued successfully",
  "dbStatus": "active",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "note": "Execution started in background. Check /api/automation/status for progress."
}
```

**Note**:
- Esegue in background (non aspetta completamento)
- Pre-warm del database per evitare cold start
- Retry automatico se database paused

---

### POST /api/automation/trigger-user

**Descrizione**: Trigger automazioni per user specifico

**Auth**: JWT token (authMiddleware) + Amazon OAuth required

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Your automations have been queued",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Note**:
- Esegue SOLO le campagne dell'utente loggato
- Usa i token OAuth dell'utente per chiamate Amazon API
- Esecuzione in background

---

### GET /api/automation/status

**Descrizione**: Controlla stato ultima esecuzione

**Auth**: None (public)

**Response**:
```json
{
  "scheduler": {
    "isRunning": true,
    "activeTasks": 2,
    "triggerMethod": "internal",
    "config": {
      "func1and3_schedule": "30 9 * * 1,3,5",
      "func1and3_enabled": true,
      "func2and4and5_schedule": "30 10 * * 1",
      "func2and4and5_enabled": true
    },
    "lastExecutionTimes": {
      "func1": "2024-01-15T09:30:00.000Z",
      "func3": "2024-01-15T09:32:00.000Z"
    },
    "nextScheduledRuns": {
      "func1and3": "30 9 * * 1,3,5 (Lun/Mer/Ven 10:30 IT)",
      "func2and4and5": "30 10 * * 1 (Lunedì 11:30 IT)"
    }
  },
  "lastExecution": {
    "startedAt": "2024-01-15T09:30:00.000Z",
    "completedAt": "2024-01-15T09:45:00.000Z",
    "status": "completed",
    "error": null,
    "isRunning": false,
    "duration": "15.23 minutes"
  },
  "currentTime": "2024-01-15T10:00:00.000Z"
}
```

---

### GET /api/automation/config

**Descrizione**: Restituisce configurazione scheduler

**Auth**: Bearer token `ADMIN_TOKEN`

**Headers**:
```
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "success": true,
  "config": {
    "func1and3_schedule": "30 9 * * 1,3,5",
    "func1and3_enabled": true,
    "func2and4and5_schedule": "30 10 * * 1",
    "func2and4and5_enabled": true,
    "scheduleExplanation": {
      "func1and3": "Lunedì/Mercoledì/Venerdì alle 10:30 ora italiana (09:30 UTC)",
      "func2and4and5": "Lunedì alle 11:30 ora italiana (10:30 UTC)"
    }
  }
}
```

---

### POST /api/automation/config

**Descrizione**: Aggiorna configurazione scheduler

**Auth**: Bearer token `ADMIN_TOKEN`

**Headers**:
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body**:
```json
{
  "func1and3_schedule": "30 9 * * 1,3,5",
  "func1and3_enabled": true,
  "func2and4and5_schedule": "30 10 * * 1",
  "func2and4and5_enabled": false
}
```

**Validazione Cron**:
```
Format: minute hour day month day-of-week
Example: "30 9 * * 1,3,5" = 09:30 UTC su Lun/Mer/Ven
```

**Response**:
```json
{
  "success": true,
  "message": "Scheduler configuration updated successfully",
  "config": { /* new config */ }
}
```

**Note**:
- Lo scheduler viene automaticamente riavviato dopo update
- Validazione regex per cron expressions

---

### POST /api/automation/scheduler/restart

**Descrizione**: Riavvia lo scheduler (stop + start)

**Auth**: Bearer token `ADMIN_TOKEN`

**Response**:
```json
{
  "success": true,
  "message": "Scheduler restarted successfully",
  "status": { /* scheduler status */ }
}
```

---

## 🗄️ Database Schema

### automation_logs Table

```sql
CREATE TABLE automation_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  campaign_id VARCHAR(255),
  campaign_name VARCHAR(255),
  function_name VARCHAR(50),         -- 'func1', 'func2', 'func3', 'func4', 'func5'
  action VARCHAR(100),               -- 'bid_increase', 'placement_adjustment', 'pause_target', 'add_negative', etc.
  details JSONB,                     -- Dettagli operazione (bid vecchio/nuovo, ASIN, keyword, etc.)
  result VARCHAR(50),                -- 'success', 'error', 'skipped'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX idx_automation_logs_user ON automation_logs(user_id);
CREATE INDEX idx_automation_logs_campaign ON automation_logs(campaign_id);
CREATE INDEX idx_automation_logs_function ON automation_logs(function_name);
CREATE INDEX idx_automation_logs_created_at ON automation_logs(created_at);
```

### automation_config Table

```sql
CREATE TABLE automation_config (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  campaign_id VARCHAR(255) NOT NULL,

  -- Funzione 1
  func1_enabled BOOLEAN DEFAULT true,
  func1_bid_increase DECIMAL(5,2) DEFAULT 0.02,
  func1_frequency INTEGER DEFAULT 3,
  func1_impressions INTEGER DEFAULT 20,
  func1_clicks INTEGER DEFAULT 0,

  -- Funzione 2
  func2_enabled BOOLEAN DEFAULT true,
  func2_frequency INTEGER DEFAULT 7,
  func2_timeframe_weeks INTEGER DEFAULT 4,

  -- Funzione 3
  func3_enabled BOOLEAN DEFAULT true,
  func3_frequency INTEGER DEFAULT 3,
  func3_timeframe_a INTEGER DEFAULT 2000,
  func3_timeframe_b INTEGER DEFAULT 3000,
  func3_timeframe_c INTEGER DEFAULT 5000,
  func3_clicks_pause INTEGER DEFAULT 10,
  func3_clicks_65days INTEGER DEFAULT 30,

  -- Funzione 4
  func4_enabled BOOLEAN DEFAULT true,
  func4_frequency INTEGER DEFAULT 7,
  func4_timeframe_a INTEGER DEFAULT 1000,
  func4_timeframe_b INTEGER DEFAULT 3000,
  func4_timeframe_c INTEGER DEFAULT 5000,
  func4_clicks_negative INTEGER DEFAULT 10,
  func4_spend_negative INTEGER DEFAULT 10,

  -- Funzione 5
  func5_enabled BOOLEAN DEFAULT true,
  func5_frequency INTEGER DEFAULT 7,
  func5_min_orders INTEGER DEFAULT 1,
  func5_bid_broad DECIMAL(5,2) DEFAULT 0.30,
  func5_bid_exact DECIMAL(5,2) DEFAULT 0.50,
  func5_bid_phrase DECIMAL(5,2) DEFAULT 0.40,
  func5_bid_expanded DECIMAL(5,2) DEFAULT 0.30,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, campaign_id)
);
```

---

## ⚙️ Environment Variables

```bash
# Automation Trigger Secret (per external cron job)
AUTOMATION_SECRET=your_automation_secret_min_32_chars

# Admin Token (per config endpoints)
ADMIN_TOKEN=your_admin_token_min_32_chars

# Amazon OAuth (già configurati)
AMAZON_CLIENT_ID=your_client_id
AMAZON_CLIENT_SECRET=your_client_secret
AMAZON_REDIRECT_URI=https://your-app.onrender.com/api/auth/callback
```

---

## 🚀 Setup Produzione

### 1. Verifica Environment Variables

Nel dashboard Render, aggiungi:
```bash
AUTOMATION_SECRET=<generate random 32+ chars>
ADMIN_TOKEN=<generate random 32+ chars>
```

### 2. Deploy

Il sistema è già attivato in produzione. Al deploy:
- Scheduler interno parte automaticamente
- Funzioni eseguite agli orari configurati
- Log visibili in Render Dashboard → Logs

### 3. Verifica Attivazione

Dopo deploy, controlla logs:
```
🤖 Avvio scheduler automazioni interno...
📅 Configurazione orari:
   - Funzioni 1+3: 30 9 * * 1,3,5 (Lun/Mer/Ven 10:30 IT)
   - Funzioni 2+4+5: 30 10 * * 1 (Lunedì 11:30 IT)
✅ Cron job Funzioni 1+3 attivato
✅ Cron job Funzioni 2+4+5 attivato
✅ Scheduler interno avviato con successo
```

### 4. Test Manuale

Testa con trigger manuale:
```bash
curl -X POST "https://your-app.onrender.com/api/automation/trigger?secret=your-secret"
```

Verifica status:
```bash
curl "https://your-app.onrender.com/api/automation/status"
```

---

## 📊 Monitoraggio

### Logs Utili

```bash
# Render Dashboard → Logs, cerca:

# Avvio scheduler
🤖 Avvio scheduler automazioni interno...
✅ Scheduler interno avviato con successo

# Trigger automatico
⏰ Trigger automatico: Funzioni 1+3
🚀 Esecuzione funzioni: 1, 3

# Per-user execution
🤖 Running automations for user abc123...
📊 Found 5 active campaigns for user abc123

# Function execution
📢 Campagna: My Test Campaign
   Tipo: 1 | ID: camp-123 | Marketplace: US
✅ Funzione 1 eseguita per campagna My Test Campaign

# Summary
📊 AUTOMATION SUMMARY FOR USER abc123
   Campaigns processed: 5
   Functions executed:
     - Function 1 (Progressive Bidding): 3
     - Function 3 (Targeting Optimization): 2
   Errors: 0
```

### Metriche da Monitorare

- **Execution Time**: Tempo totale per tutte le automazioni
- **Success Rate**: % campagne processate senza errori
- **API Calls**: Rate limiting Amazon API
- **Database Queries**: Performance query complesse
- **Memory Usage**: Spike durante execution

---

## 🔧 Troubleshooting

### Scheduler non parte

**Causa**: Codice non aggiornato o errore startup

**Fix**:
```bash
git pull origin main
npm install
npm run build
# Redeploy su Render
```

### "No active users with Amazon auth"

**Causa**: Nessun utente ha completato OAuth Amazon

**Fix**: Almeno un utente deve fare login con Amazon OAuth prima che automazioni possano girare

### Amazon API Rate Limit

**Causa**: Troppe richieste in poco tempo

**Fix**:
- Implementa rate limiting nel codice
- Aggiungi delay tra chiamate API (già implementato: 5s tra users)
- Riduci frequenza automazioni se necessario

### Errore "Cannot find module 'node-cron'"

**Fix**:
```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

### Timeframe calculation errors

**Causa**: Dati metriche mancanti o malformattati

**Fix**: Verifica che Amazon API restituisca metriche complete. Aggiungi logging dettagliato in funzioni.

---

## 🔒 Security Best Practices

### Secrets Management

- ✅ `AUTOMATION_SECRET`: Min 32 chars random
- ✅ `ADMIN_TOKEN`: Diverso da AUTOMATION_SECRET
- ✅ Usa HTTPS in produzione (Render auto-enabled)
- ✅ Non hardcodare secrets nel codice

### Rate Limiting

- Delay 5s tra users (già implementato)
- Considera Redis per distributed rate limiting
- Monitor Amazon API quotas

### Error Handling

- Catch errors per-campaign (continua con altri anche se uno fallisce)
- Log dettagliati in automation_logs
- Retry logic per transient errors

---

## 📈 Performance Optimization

### Database Queries

- Usa indici su user_id, campaign_id, created_at
- Batch updates dove possibile
- Connection pooling (TypeORM default)

### API Calls

- Batch Amazon API requests (fino a 100 per call)
- Cache dati non cambiano frequentemente (book data, FAST ACoS)
- Parallel requests dove possibile

### Memory Management

- Processa users sequenzialmente (evita parallel spike)
- Clear cache dopo ogni user
- Monitor Render metrics

---

## 🔄 Future Enhancements

1. **UI Dashboard**: Visualizzazione real-time esecuzioni e logs
2. **Email Notifications**: Alert quando automazioni falliscono
3. **A/B Testing**: Test diverse configurazioni parametri
4. **Machine Learning**: Ottimizzazione automatica parametri basata su performance
5. **Multi-Marketplace**: Support per tutti i marketplace Amazon (UK, DE, FR, etc.)
6. **Webhook Integration**: Trigger da eventi esterni (es. drop ACoS)

---

## ✅ Checklist Post-Deploy

- [ ] Scheduler logs visibili con "✅ Scheduler interno avviato"
- [ ] AUTOMATION_SECRET e ADMIN_TOKEN configurati
- [ ] Almeno un user con Amazon OAuth completato
- [ ] Test trigger manuale con /api/automation/trigger
- [ ] Verifica /api/automation/status risponde
- [ ] Check automation_logs table popolata
- [ ] Monitor logs durante prima esecuzione schedulata
- [ ] Verifica chiamate Amazon API funzionano
- [ ] Test per-user trigger con /api/automation/trigger-user

---

**Automation Engine is LIVE!** 🎉

Il sistema è attivo e pronto per gestire automaticamente le tue campagne Amazon Ads 24/7.
