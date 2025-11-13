# Amazon Ads Manager - Quick Start Guide

## 🚀 Setup Iniziale

```bash
# Clona repository
git clone https://github.com/fumoblu73/amazon-ads-manager.git
cd amazon-ads-manager

# Installa dipendenze
npm install

# Configura .env
cp .env.example .env
# Modifica .env con le tue credenziali
```

## 🏃 Comandi Disponibili

### Sviluppo
```bash
npm run dev          # Avvia server in modalità sviluppo (auto-reload)
```

### Build & Deploy
```bash
npm run build        # Compila TypeScript → JavaScript
npm start            # Avvia server in produzione
```

### Testing
```bash
# Testare le automazioni tramite trigger manuale API
curl -X POST https://amazon-ads-manager.onrender.com/api/automation/trigger-manual \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Verificare stato esecuzione
curl https://amazon-ads-manager.onrender.com/api/automation/status

# Consultare logs
curl https://amazon-ads-manager.onrender.com/api/logs/recent?limit=20
```

## 📡 API Endpoints

### Base URL
- **Produzione**: `https://amazon-ads-manager.onrender.com`
- **Locale**: `http://localhost:3000`

### Pubblici (No Auth)
```bash
GET  /                           # Info API
GET  /health                     # Health check
GET  /api/automation/status      # Stato automazioni
GET  /api/books                  # Lista libri
GET  /api/campaigns              # Lista campagne
GET  /api/logs/recent            # Ultimi log
```

### Protetti (Bearer Token)
```bash
# Books
POST   /api/books                # Crea libro
PUT    /api/books/:id            # Aggiorna libro
DELETE /api/books/:id            # Elimina libro

# Campaigns
POST   /api/campaigns            # Crea campagna
PUT    /api/campaigns/:id        # Aggiorna campagna
DELETE /api/campaigns/:id        # Elimina campagna

# Automazioni
POST /api/automation/trigger-manual     # Trigger tutte le funzioni (func1-5)
GET  /api/automation/config             # Configurazione scheduler
POST /api/automation/config             # Aggiorna scheduler
POST /api/automation/scheduler/restart  # Restart scheduler
```

## 🔑 Autenticazione

### Bearer Token
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://amazon-ads-manager.onrender.com/api/books
```

### Secret (per cron job)
```bash
curl -X POST "https://amazon-ads-manager.onrender.com/api/automation/trigger?secret=YOUR_SECRET"
```

## 📊 Esempi Pratici

### 1. Creare un libro
```bash
curl -X POST https://amazon-ads-manager.onrender.com/api/books \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "asin": "B08XYZ1234",
    "title": "Il mio libro fantastico",
    "price": 12.99,
    "printingCost": 4.20,
    "royaltyPercentage": 60,
    "marketplace": "IT"
  }'
```

### 2. Lista campagne filtrate
```bash
# Campagne attive
curl "https://amazon-ads-manager.onrender.com/api/campaigns?state=enabled"

# Statistiche campagne
curl https://amazon-ads-manager.onrender.com/api/campaigns/stats/summary
```

### 3. Consultare logs con filtri
```bash
# Solo errori
curl https://amazon-ads-manager.onrender.com/api/logs/errors

# Logs di func1
curl "https://amazon-ads-manager.onrender.com/api/logs?ruleName=func1&limit=50"

# Logs ultima settimana
curl "https://amazon-ads-manager.onrender.com/api/logs?dateFrom=2025-11-06&dateTo=2025-11-13"

# Statistiche
curl "https://amazon-ads-manager.onrender.com/api/logs/stats/summary?dateFrom=2025-11-01"
```

### 4. Trigger manuale automazione
```bash
# Esegui tutte le automazioni (func1-5)
curl -X POST https://amazon-ads-manager.onrender.com/api/automation/trigger-manual \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Verifica stato esecuzione
curl https://amazon-ads-manager.onrender.com/api/automation/status
```

### 5. Modificare scheduler
```bash
curl -X POST https://amazon-ads-manager.onrender.com/api/automation/config \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "func1and3_schedule": "0 10 * * 1,3,5",
    "func1and3_enabled": true,
    "func2and4and5_schedule": "0 11 * * 1",
    "func2and4and5_enabled": true
  }'
```

## 🔧 Troubleshooting

### Server non risponde
```bash
# Verifica health
curl https://amazon-ads-manager.onrender.com/health

# Verifica status automazioni
curl https://amazon-ads-manager.onrender.com/api/automation/status
```

### Test locali
```bash
# Vedi log dettagliati
LOG_LEVEL=debug npm run dev

# Consulta logs via API
curl https://amazon-ads-manager.onrender.com/api/logs/recent?limit=50
```

### Logs
```bash
# I log sono in logs/
ls -la logs/

# combined.log = tutti i log
# error.log = solo errori
# automation.log = log automazioni
```

## 📚 Documentazione Completa

- `API_DOCUMENTATION.md` - Documentazione completa API
- `DEVELOPMENT_SUMMARY.md` - Riepilogo sviluppo sessione
- `README.md` - Overview progetto

## 🆘 Supporto

- **GitHub Issues**: https://github.com/fumoblu73/amazon-ads-manager/issues
- **Email**: [tua email]

---

**Made with ❤️ by Claude Code**
