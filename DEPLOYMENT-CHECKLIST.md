# ✅ Deployment Checklist - Amazon Ads Manager

Usa questa checklist per assicurarti di completare tutti gli step necessari per il deploy.

---

## 📝 Pre-Deploy

### Credenziali Amazon

- [ ] Ho ottenuto `AMAZON_CLIENT_ID`
- [ ] Ho ottenuto `AMAZON_CLIENT_SECRET`
- [ ] Ho generato `AMAZON_REFRESH_TOKEN` (usando `get-refresh-token.js`)
- [ ] Ho ottenuto `AMAZON_PROFILE_ID` (usando `get-profile-id.js`)
- [ ] Ho verificato la regione corretta (`EU`, `NA`, o `FE`)

### Security Tokens

- [ ] Ho generato `AUTOMATION_SECRET` sicuro (32+ caratteri)
  ```bash
  openssl rand -hex 32
  ```
- [ ] Ho generato `ADMIN_TOKEN` sicuro (32+ caratteri)
  ```bash
  openssl rand -hex 32
  ```
- [ ] Ho salvato i token in luogo sicuro (password manager)

### Database Setup

- [ ] Ho creato progetto Supabase (o PostgreSQL)
- [ ] Ho ottenuto `DATABASE_URL`
- [ ] Ho eseguito SQL migration per creare tabelle:
  - [ ] `books`
  - [ ] `campaigns`
  - [ ] `automation_config`
  - [ ] `automation_logs`
- [ ] Ho verificato che le tabelle esistano
- [ ] Ho testato connessione database

---

## 🔧 Configurazione Locale

### File .env

- [ ] Ho copiato `.env.example` in `.env`
- [ ] Ho compilato tutte le variabili obbligatorie
- [ ] Ho verificato che nessuna variabile contenga `your_xxx_here`
- [ ] Ho verificato che `.env` sia in `.gitignore` (non committare!)

### Dipendenze

- [ ] Ho eseguito `npm install`
- [ ] Tutte le dipendenze sono installate senza errori
- [ ] Ho verificato `package.json` e `package-lock.json`

### Test Locale

- [ ] Ho avviato il server con `npm run dev`
- [ ] Il server parte senza errori
- [ ] Endpoint `/health` risponde correttamente
- [ ] Endpoint `/api/automation/status` risponde correttamente

---

## 🚀 Deploy su Render.com

### Setup Render

- [ ] Ho creato account su Render.com
- [ ] Ho creato nuovo Web Service
- [ ] Ho connesso repository GitHub
- [ ] Ho configurato:
  - [ ] **Build Command:** `npm install && npm run build`
  - [ ] **Start Command:** `npm start`
  - [ ] **Instance Type:** Free
  - [ ] **Branch:** `main` (o il tuo branch principale)

### Environment Variables su Render

- [ ] `AMAZON_CLIENT_ID`
- [ ] `AMAZON_CLIENT_SECRET`
- [ ] `AMAZON_REFRESH_TOKEN`
- [ ] `AMAZON_PROFILE_ID`
- [ ] `AMAZON_REGION`
- [ ] `AUTOMATION_SECRET`
- [ ] `ADMIN_TOKEN`
- [ ] `DATABASE_URL`
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000` (opzionale, Render usa la sua porta)

### Verifica Deploy

- [ ] Il deploy è completato con successo
- [ ] Nessun errore nei log di build
- [ ] L'app è online e raggiungibile
- [ ] URL app: `https://your-app-name.onrender.com`

### Test Endpoint Produzione

```bash
# Salva l'URL della tua app
APP_URL=https://your-app.onrender.com

# Test Health
curl $APP_URL/health

# Test Status
curl $APP_URL/api/automation/status

# Test Trigger (con AUTOMATION_SECRET)
curl -X POST "$APP_URL/api/automation/trigger?secret=YOUR_SECRET"
```

- [ ] Health check funziona
- [ ] Status funziona
- [ ] Trigger risponde correttamente

---

## ⏰ Setup Cron-Job.org (Trigger Automazioni)

### Registrazione

- [ ] Ho creato account su [Cron-Job.org](https://cron-job.org)
- [ ] Ho verificato email

### Creazione Cron Job

- [ ] Ho creato nuovo Cronjob
- [ ] **Title:** `Amazon Ads Automation`
- [ ] **URL:** `https://your-app.onrender.com/api/automation/trigger?secret=YOUR_AUTOMATION_SECRET`
- [ ] **Schedule:** Personalizzato (es: ogni giorno alle 09:00)
- [ ] **Request Method:** POST
- [ ] **Timezone:** Corretto per la tua località

### Configurazione Avanzata

- [ ] **Timeout:** 30 secondi (l'app risponde subito)
- [ ] **Retry on failure:** Attivato
- [ ] **Email notifications:** Attivato (opzionale)

### Test Manuale

- [ ] Ho cliccato "Execute now"
- [ ] La richiesta ha successo (status 200)
- [ ] Ho verificato su Render logs che l'esecuzione sia partita
- [ ] Ho controllato `/status` per vedere progresso

---

## 📊 Popolamento Iniziale Database

### Inserisci Books

```sql
INSERT INTO books (asin, title, price, printing_cost, marketplace)
VALUES
  ('B08XXXX001', 'Il Mio Primo Libro', 15.99, 3.50, 'IT'),
  ('B08XXXX002', 'Il Secondo Libro', 12.99, 2.80, 'IT');
```

- [ ] Ho inserito almeno 1 libro di test
- [ ] Ho calcolato il FAST ACoS atteso

### Configura Campagne

```sql
INSERT INTO campaigns (amazon_campaign_id, book_id, name, type, state, marketplace)
VALUES
  ('12345678', 'book-uuid-qui', 'Keyword Targeting - Book 1', 1, 'enabled', 'IT');
```

- [ ] Ho inserito le mie campagne reali (o di test)
- [ ] Ho associato ogni campagna al libro corretto
- [ ] Ho impostato il `type` corretto (1-5)

### Configura Automation

```sql
INSERT INTO automation_config (campaign_id, book_id)
VALUES ('campaign-uuid', 'book-uuid');
-- Usa i default (già impostati)
```

- [ ] Ho creato configurazione per ogni campagna
- [ ] Ho verificato i parametri default
- [ ] Ho personalizzato parametri se necessario

---

## 🧪 Test Completo End-to-End

### Test Manuale Trigger

```bash
# Trigger manuale (con ADMIN_TOKEN)
curl -X POST https://your-app.onrender.com/api/automation/trigger-manual \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

- [ ] Trigger parte correttamente
- [ ] Risposta è immediata (< 1 secondo)
- [ ] Stato è "running"

### Monitor Esecuzione

```bash
# Controlla status ogni 30 secondi
watch -n 30 'curl https://your-app.onrender.com/api/automation/status'
```

- [ ] Status mostra `"status": "running"`
- [ ] Dopo alcuni minuti, status diventa `"status": "completed"`
- [ ] `duration` mostra tempo di esecuzione

### Verifica Log

**Render Dashboard → Logs:**

- [ ] Vedo log dettagliati dell'esecuzione
- [ ] Nessun errore fatale
- [ ] Vedo output delle 5 funzioni
- [ ] Vedo riepilogo finale con statistiche

### Verifica Database

```sql
SELECT * FROM automation_logs
ORDER BY created_at DESC
LIMIT 10;
```

- [ ] Ci sono log delle esecuzioni
- [ ] I log mostrano azioni corrette
- [ ] Status è "success" (se tutto ok)

---

## 🔍 Monitoring Continuo

### Setup Monitoraggio

- [ ] Ho configurato email notifications su Cron-Job.org
- [ ] Ho aggiunto Render app ai preferiti
- [ ] Ho salvato URL status dashboard
- [ ] Ho configurato Sentry (opzionale)

### Check Giornalieri

- [ ] Controllo log ogni giorno dopo esecuzione
- [ ] Verifico che non ci siano errori
- [ ] Monitoro numero di bid modificati
- [ ] Monitoro numero di keyword pausate

### Check Settimanali

- [ ] Verifico performance campagne su Amazon
- [ ] Confronto ACoS prima/dopo automazioni
- [ ] Verifico che i bid siano nei range corretti
- [ ] Controllo database per anomalie

---

## 🚨 Troubleshooting Preparato

### Ho preparato recovery plan per:

- [ ] Render va down → ho backup dei dati importanti
- [ ] Amazon API non risponde → so come disabilitare temporaneamente
- [ ] Database connection fail → ho credenziali salvate
- [ ] Cron-Job.org non trigger → so fare trigger manuale

### Backup

- [ ] Ho backup di `.env` (in luogo sicuro)
- [ ] Ho backup del codice (su GitHub)
- [ ] Ho backup configurazione Render
- [ ] Ho export database Supabase

---

## 📚 Documentazione

### Ho letto e compreso:

- [ ] [README.md](README.md) - Overview generale
- [ ] [SPECIFICATIONS.md](SPECIFICATIONS.md) - Specifiche 5 funzioni
- [ ] [SETUP-GUIDE.md](SETUP-GUIDE.md) - Guida setup completa
- [ ] [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md) - Riepilogo implementazione

### Ho salvato link utili:

- [ ] Render Dashboard: `https://dashboard.render.com`
- [ ] Supabase Dashboard: `https://app.supabase.com`
- [ ] Cron-Job Dashboard: `https://console.cron-job.org`
- [ ] Amazon Advertising: `https://advertising.amazon.com`
- [ ] GitHub Repo: `https://github.com/username/amazon-ads-manager`

---

## 🎉 Go Live!

### Final Checks

- [ ] Tutti i check precedenti sono ✅
- [ ] Ho testato almeno 1 esecuzione completa
- [ ] Le automazioni funzionano correttamente
- [ ] Nessun errore nei log
- [ ] Status è "completed"

### Attivazione

- [ ] Cron-Job.org è attivo e schedulato
- [ ] Render app è "Running"
- [ ] Database è connesso
- [ ] Notifiche sono configurate

---

## 🎊 SUCCESS!

**Congratulazioni! Amazon Ads Manager è LIVE! 🚀**

Le automazioni inizieranno a ottimizzare le tue campagne automaticamente.

Ricorda:
- Le automazioni partono dopo 7 giorni dalla creazione della campagna (warmup)
- Controlla i log regolarmente per i primi giorni
- Monitora le performance su Amazon
- Contatta il supporto se hai problemi

---

**Data Go-Live:** _______________

**Note:**
_______________________________________
_______________________________________
_______________________________________

---

*Documento creato il: 12 Novembre 2025*
*Versione: 1.0.0*
