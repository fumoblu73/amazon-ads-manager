# 🚀 Guida Deploy su Render.com

## ✅ Completato in Locale

- ✅ Migrazione database creata
- ✅ Codice backend aggiornato
- ✅ Codice frontend aggiornato
- ✅ Push su GitHub completato

---

## 📋 Checklist Deploy

### 1. Esegui Migration SQL su Supabase

1. Vai su https://supabase.com
2. Apri il progetto `amazon-ads-manager`
3. Clicca su **SQL Editor** (menu sinistra)
4. Clicca su **"New Query"**
5. Copia il contenuto del file `migrations/005_create_automation_config_table.sql`
6. Incollalo nell'editor e clicca **"Run"**
7. Verifica il messaggio **"Success. No rows returned"**

### 2. Deploy Backend su Render

#### Opzione A: Deploy Automatico (se configurato)

Render.com dovrebbe rilevare automaticamente il push su GitHub e fare il redeploy del backend.

1. Vai su https://dashboard.render.com
2. Trova il tuo servizio backend
3. Controlla la sezione **"Events"** - dovresti vedere un nuovo deploy in corso
4. Attendi che lo stato diventi **"Live"**

#### Opzione B: Deploy Manuale

Se il deploy automatico non è configurato:

1. Vai su https://dashboard.render.com
2. Trova il tuo servizio backend
3. Clicca su **"Manual Deploy"** → **"Deploy latest commit"**
4. Attendi che il deploy completi

### 3. Verifica Backend

Dopo il deploy:

1. Vai su **Logs** del servizio backend
2. Cerca il messaggio: `✅ Database connesso con successo!`
3. Cerca: `🚀 Server in ascolto su porta 10000` (o la porta configurata)
4. Verifica che NON ci siano errori relativi alla tabella `automation_config`

### 4. Deploy Frontend su Render

#### Se hai un servizio Static Site per il frontend:

1. Vai al servizio frontend su Render
2. Clicca **"Manual Deploy"** → **"Clear build cache & deploy"**
3. Attendi il completamento

#### Se il frontend è servito dal backend (opzione 1):

Aggiorna l'URL API nel frontend:

1. Apri `frontend/src/services/api.ts`
2. Verifica che `baseURL` punti al tuo backend Render:
   ```typescript
   const apiClient = axios.create({
     baseURL: 'https://tuo-backend.onrender.com',
     // ...
   });
   ```
3. Ricompila il frontend: `npm run build`
4. Redeploy

### 5. Test Funzionalità

1. Vai all'URL del frontend (es: https://tuo-frontend.onrender.com)
2. Clicca su **"Campaigns"**
3. Clicca su **"Sync Singolo"** o **"Sync Tutti"**
4. Inserisci l'`ADMIN_TOKEN` quando richiesto
5. Verifica che le campagne vengano caricate
6. Clicca su **"Impostazioni"** su una campagna
7. Verifica che il modal si apra e mostri le 5 funzioni
8. Modifica alcuni parametri e clicca **"Salva Configurazione"**
9. Verifica che gli indicatori (F1, F2, F3, F4, F5) si aggiornino

---

## 🔧 Variabili d'Ambiente Render

Assicurati che il backend su Render abbia queste variabili:

```env
# Database
DATABASE_URL=postgresql://postgres.dyagpkecnrasowyvbupb:o5NQuY%40jJHWfF%26@aws-1-eu-west-3.pooler.supabase.com:5432/postgres

# Amazon API - Multi-Region Support
# IMPORTANTE: Devi configurare le credenziali per OGNI regione dove hai campagne

# EU Region (Europa: UK, IT, DE, FR, ES, etc.)
AMAZON_EU_CLIENT_ID=your_eu_client_id
AMAZON_EU_CLIENT_SECRET=your_eu_client_secret
AMAZON_EU_REFRESH_TOKEN=your_eu_refresh_token

# NA Region (Nord America: US, CA, MX, BR) - OBBLIGATORIO se hai campagne US
AMAZON_NA_CLIENT_ID=your_na_client_id
AMAZON_NA_CLIENT_SECRET=your_na_client_secret
AMAZON_NA_REFRESH_TOKEN=your_na_refresh_token

# FE Region (Far East: AU, JP, SG, IN) - OBBLIGATORIO se hai campagne AU
AMAZON_FE_CLIENT_ID=your_fe_client_id
AMAZON_FE_CLIENT_SECRET=your_fe_client_secret
AMAZON_FE_REFRESH_TOKEN=your_fe_refresh_token

# Security
ADMIN_TOKEN=mio_token_segreto_admin_123
AUTOMATION_SECRET=mio_token_automation_456

# App
NODE_ENV=production
PORT=10000
LOG_LEVEL=info
```

### 📋 Come Ottenere i Token Multi-Region

Per ogni regione (EU, NA, FE):

1. Vai su https://advertising.amazon.com
2. Accedi con il tuo account Amazon Advertising
3. Vai su **Settings** → **API** → **Developer Console**
4. **PER OGNI REGIONE**:
   - Crea una nuova applicazione (o usa quella esistente)
   - Autorizza l'applicazione per la regione specifica
   - Ottieni: Client ID, Client Secret, Refresh Token

5. Inserisci i token nelle variabili d'ambiente corrispondenti su Render

**NOTA IMPORTANTE**: Le tue campagne US richiedono token NA, non EU!

---

## 🐛 Troubleshooting

### Il backend non si avvia dopo il deploy

1. Vai su **Logs** del servizio backend
2. Cerca errori di connessione database
3. Verifica che `DATABASE_URL` sia corretta
4. Verifica che la migration SQL sia stata eseguita su Supabase

### Il frontend non si connette al backend

1. Controlla `frontend/src/services/api.ts`
2. Verifica che `baseURL` punti all'URL corretto del backend Render
3. Verifica che il backend sia **Live** e risponda su `/health`

### Errore "relation automation_config does not exist"

1. La migration SQL NON è stata eseguita su Supabase
2. Esegui lo script SQL come indicato nel punto 1

### Il modal di configurazione non salva

1. Verifica di aver inserito l'`ADMIN_TOKEN` corretto
2. Verifica che il backend sia raggiungibile
3. Controlla i logs del backend per errori

---

## 📊 Verifica Tabella su Supabase

Per verificare che la tabella sia stata creata:

1. Vai su Supabase → **Table Editor**
2. Dovresti vedere la tabella `automation_config`
3. Verifica che abbia tutte le colonne:
   - `id`, `campaign_id`, `book_id`
   - `func1_enabled`, `func1_bid_increase`, `func1_frequency`, etc.
   - `created_at`, `updated_at`

---

## ✅ Completamento

Una volta completati tutti i passaggi:

1. Il backend sarà accessibile da `https://tuo-backend.onrender.com`
2. Il frontend sarà accessibile da `https://tuo-frontend.onrender.com`
3. Potrai gestire le campagne multi-marketplace da qualsiasi dispositivo
4. Le configurazioni delle ottimizzazioni saranno salvate nel database cloud

---

**Buon Deploy! 🚀**

*Ultimo aggiornamento: 19 Novembre 2025*
