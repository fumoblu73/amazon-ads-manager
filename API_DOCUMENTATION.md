# API Documentation - Amazon Ads Manager

Documentazione completa delle API per lo sviluppo del frontend.

## Base URL

**Produzione**: `https://amazon-ads-manager.onrender.com`
**Locale**: `http://localhost:3000`

---

## Autenticazione

La maggior parte degli endpoint richiede autenticazione tramite **Bearer Token**.

### Headers richiesti:
```
Authorization: Bearer YOUR_ADMIN_TOKEN
```

Il token è configurato nella variabile d'ambiente `ADMIN_TOKEN`.

---

## Endpoints

### 1. Health Check

Verifica lo stato del server (utilizzato per keep-alive).

**Endpoint**: `GET /health`
**Auth**: Non richiesta

#### Response:
```json
{
  "status": "OK",
  "message": "Amazon Ads Manager is running",
  "timestamp": "2025-11-13T10:30:00.000Z"
}
```

---

### 2. Automation Status

Visualizza lo stato dello scheduler e dell'ultima esecuzione.

**Endpoint**: `GET /api/automation/status`
**Auth**: Non richiesta

#### Response:
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
      "func1": "2025-11-13T09:30:00.000Z",
      "func3": "2025-11-13T09:30:00.000Z"
    },
    "nextScheduledRuns": {
      "func1and3": "30 9 * * 1,3,5 (Lun/Mer/Ven 10:30 IT)",
      "func2and4and5": "30 10 * * 1 (Lunedì 11:30 IT)"
    }
  },
  "lastExecution": {
    "startedAt": "2025-11-13T09:30:00.000Z",
    "completedAt": "2025-11-13T09:35:30.000Z",
    "status": "completed",
    "error": null,
    "isRunning": false,
    "duration": "5.50 minutes"
  },
  "currentTime": "2025-11-13T10:00:00.000Z"
}
```

#### Status Values:
- `idle`: Nessuna esecuzione ancora avviata
- `running`: Esecuzione in corso
- `completed`: Ultima esecuzione completata con successo
- `failed`: Ultima esecuzione fallita

---

### 3. Get Scheduler Configuration

Ottiene la configurazione corrente dello scheduler.

**Endpoint**: `GET /api/automation/config`
**Auth**: Richiesta (Bearer Token)

#### Response:
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

### 4. Update Scheduler Configuration

Aggiorna la configurazione dello scheduler (orari, abilitazione).

**Endpoint**: `POST /api/automation/config`
**Auth**: Richiesta (Bearer Token)

#### Request Body:
```json
{
  "func1and3_schedule": "30 9 * * 1,3,5",
  "func1and3_enabled": true,
  "func2and4and5_schedule": "30 10 * * 1",
  "func2and4and5_enabled": false
}
```

Tutti i campi sono **opzionali**. Invia solo quelli che vuoi modificare.

#### Cron Expression Format:
```
┌───────────── minuto (0 - 59)
│ ┌───────────── ora (0 - 23)
│ │ ┌───────────── giorno del mese (1 - 31)
│ │ │ ┌───────────── mese (1 - 12)
│ │ │ │ ┌───────────── giorno della settimana (0 - 6) (0 = Domenica)
│ │ │ │ │
* * * * *
```

**Esempi**:
- `30 9 * * 1,3,5` = Lunedì, Mercoledì, Venerdì alle 09:30 UTC
- `30 10 * * 1` = Lunedì alle 10:30 UTC
- `0 */2 * * *` = Ogni 2 ore
- `15 14 1 * *` = Il primo giorno di ogni mese alle 14:15

#### Response Success:
```json
{
  "success": true,
  "message": "Scheduler configuration updated successfully",
  "config": {
    "func1and3_schedule": "30 9 * * 1,3,5",
    "func1and3_enabled": true,
    "func2and4and5_schedule": "30 10 * * 1",
    "func2and4and5_enabled": false
  }
}
```

#### Response Error (400):
```json
{
  "error": "Invalid cron expression for func1and3_schedule",
  "hint": "Format: minute hour day month day-of-week (e.g., \"30 9 * * 1,3,5\")"
}
```

---

### 5. Restart Scheduler

Ferma e riavvia lo scheduler (utile dopo modifiche alla configurazione).

**Endpoint**: `POST /api/automation/scheduler/restart`
**Auth**: Richiesta (Bearer Token)

#### Response:
```json
{
  "success": true,
  "message": "Scheduler restarted successfully",
  "status": {
    "isRunning": true,
    "activeTasks": 2,
    "triggerMethod": "internal"
  }
}
```

---

### 6. Manual Trigger

Esegue manualmente tutte le automazioni (per testing).

**Endpoint**: `POST /api/automation/trigger-manual`
**Auth**: Richiesta (Bearer Token)

#### Response Success:
```json
{
  "success": true,
  "message": "Manual execution started in background",
  "timestamp": "2025-11-13T10:30:00.000Z"
}
```

#### Response Error (409 - Already Running):
```json
{
  "error": "Automations already running",
  "status": {
    "startedAt": "2025-11-13T10:25:00.000Z",
    "completedAt": null,
    "status": "running",
    "error": null
  }
}
```

---

### 7. External Trigger (Cron-Job.org)

Endpoint utilizzato da Cron-Job.org per tenere sveglio il server.

**Endpoint**: `POST /api/automation/trigger?secret=YOUR_SECRET`
**Auth**: Query parameter `secret` o body `{ "secret": "YOUR_SECRET" }`

#### Response:
```json
{
  "success": true,
  "message": "Automations queued successfully",
  "timestamp": "2025-11-13T10:30:00.000Z",
  "note": "Execution started in background. Check /api/automation/status for progress."
}
```

---

## Error Handling

Tutti gli endpoint restituiscono codici HTTP standard:

- **200 OK**: Richiesta completata con successo
- **400 Bad Request**: Dati non validi
- **401 Unauthorized**: Token mancante o non valido
- **409 Conflict**: Operazione non permessa (es: automazione già in corso)
- **500 Internal Server Error**: Errore del server

### Formato errore standard:
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

---

## Webhook & Real-Time Updates

Al momento il sistema **non supporta WebSocket** per aggiornamenti in tempo reale.

### Polling consigliato:
Per monitorare lo stato delle automazioni in corso, effettua polling dell'endpoint `/api/automation/status` ogni **5-10 secondi**.

---

## Rate Limiting

Non ci sono limiti di rate configurati, ma si consiglia di:
- Non fare più di **1 richiesta/secondo** per endpoint
- Usare polling intelligente (es: aumentare intervallo se status = idle)

---

## Timezone

Tutti i timestamp sono in formato **ISO 8601 UTC**.

**Conversione italiana**:
- UTC 09:30 = 10:30 ora italiana (CET/CEST)
- UTC 10:30 = 11:30 ora italiana (CET/CEST)

---

## Esempi di Integrazione Frontend

### React + Axios

```javascript
import axios from 'axios';

const API_BASE = 'https://amazon-ads-manager.onrender.com/api/automation';
const ADMIN_TOKEN = 'your-admin-token';

// Headers comuni
const headers = {
  'Authorization': `Bearer ${ADMIN_TOKEN}`,
  'Content-Type': 'application/json'
};

// 1. Ottieni status
async function getStatus() {
  const response = await axios.get(`${API_BASE}/status`);
  return response.data;
}

// 2. Ottieni configurazione
async function getConfig() {
  const response = await axios.get(`${API_BASE}/config`, { headers });
  return response.data;
}

// 3. Aggiorna configurazione
async function updateConfig(config) {
  const response = await axios.post(`${API_BASE}/config`, config, { headers });
  return response.data;
}

// 4. Trigger manuale
async function triggerManual() {
  const response = await axios.post(`${API_BASE}/trigger-manual`, {}, { headers });
  return response.data;
}

// 5. Polling status
function startStatusPolling(callback, interval = 10000) {
  return setInterval(async () => {
    try {
      const status = await getStatus();
      callback(status);
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, interval);
}
```

### Vue.js Example

```javascript
export default {
  data() {
    return {
      status: null,
      config: null,
      pollingInterval: null
    }
  },

  async mounted() {
    await this.fetchStatus();
    await this.fetchConfig();
    this.startPolling();
  },

  beforeUnmount() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  },

  methods: {
    async fetchStatus() {
      const response = await fetch('https://amazon-ads-manager.onrender.com/api/automation/status');
      this.status = await response.json();
    },

    async fetchConfig() {
      const response = await fetch('https://amazon-ads-manager.onrender.com/api/automation/config', {
        headers: { 'Authorization': `Bearer ${this.adminToken}` }
      });
      this.config = await response.json();
    },

    async updateSchedule(newSchedule) {
      const response = await fetch('https://amazon-ads-manager.onrender.com/api/automation/config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSchedule)
      });

      if (response.ok) {
        await this.fetchConfig();
        this.$notify({ type: 'success', message: 'Configurazione aggiornata' });
      }
    },

    startPolling() {
      this.pollingInterval = setInterval(() => {
        this.fetchStatus();
      }, 10000); // Ogni 10 secondi
    }
  }
}
```

---

## Database Schema (Per Riferimento)

### Tabella: `automation_logs`
Contiene lo storico delle esecuzioni.

```sql
CREATE TABLE automation_logs (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(255),
  function_name VARCHAR(50),
  execution_time TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20),
  changes_made TEXT,
  error_message TEXT
);
```

### Tabella: `books`
Contiene i libri con FAST ACoS.

```sql
CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(10) UNIQUE NOT NULL,
  title VARCHAR(500),
  price DECIMAL(10,2),
  printing_cost DECIMAL(10,2),
  royalty_percentage DECIMAL(5,2) DEFAULT 60,
  fast_acos DECIMAL(5,2),
  marketplace VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabella: `campaigns`
Contiene le campagne Amazon.

```sql
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(500),
  type INTEGER,
  status VARCHAR(50),
  budget DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabella: `automation_config`
Configurazione personalizzata per ogni campagna.

```sql
CREATE TABLE automation_config (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(255) REFERENCES campaigns(campaign_id),
  book_id INTEGER REFERENCES books(id),

  -- Funzione 1
  func1_enabled BOOLEAN DEFAULT TRUE,
  func1_bid_increase DECIMAL(5,2) DEFAULT 0.02,
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
  func4_spend_negative INTEGER DEFAULT 10,

  -- Funzione 5
  func5_enabled BOOLEAN DEFAULT TRUE,
  func5_frequency INTEGER DEFAULT 7,
  func5_min_orders INTEGER DEFAULT 1,
  func5_bid_broad DECIMAL(5,2) DEFAULT 0.30,
  func5_bid_exact DECIMAL(5,2) DEFAULT 0.50,
  func5_bid_phrase DECIMAL(5,2) DEFAULT 0.40,
  func5_bid_expanded DECIMAL(5,2) DEFAULT 0.30,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Roadmap & Future Endpoints

Endpoint pianificati per il futuro:

- `GET /api/campaigns` - Lista tutte le campagne
- `GET /api/campaigns/:id` - Dettagli campagna singola
- `GET /api/campaigns/:id/config` - Configurazione automazione per campagna
- `POST /api/campaigns/:id/config` - Aggiorna configurazione per campagna
- `GET /api/logs` - Storico esecuzioni con filtri
- `GET /api/books` - Lista libri con FAST ACoS
- `POST /api/books` - Aggiungi nuovo libro
- `PUT /api/books/:id` - Aggiorna libro

---

## Support

Per problemi o domande:
- **GitHub Issues**: https://github.com/fumoblu73/amazon-ads-manager/issues
- **Email**: [Inserire email di supporto]

---

**Versione API**: 1.0.0
**Ultimo aggiornamento**: 13 Novembre 2025
