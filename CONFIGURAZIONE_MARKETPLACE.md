# 🌍 Configurazione Marketplace Amazon

## Problema: Marketplace Disabilitati (US, CA, AU)

Quando alcuni marketplace appaiono **disabilitati** (grigi) nel selettore, significa che il backend non ha trovato i **profili Amazon Advertising** per quei marketplace.

---

## ✅ Soluzione: Configura i Profili Amazon

### Causa

Amazon Advertising richiede che tu abbia un **account attivo** e un **profilo** per ogni marketplace in cui vuoi fare pubblicità.

Se US, CA e AU sono disabilitati, significa che:
- Non hai ancora un account Amazon Advertising per questi marketplace, OPPURE
- I token API non hanno accesso a questi profili

### Come Verificare

1. Vai su https://advertising.amazon.com
2. Accedi con il tuo account
3. In alto a destra, clicca sul **selettore del paese**
4. Verifica quali marketplace vedi elencati

Se non vedi US, CA o AU, devi:
- Creare un account Vendor/Seller per quei marketplace
- Abilitare Amazon Advertising per quei marketplace

---

## 🔧 Come Funziona il Sistema

### 1. Caricamento Profili

Quando clicchi su **"Sync Singolo"**, il frontend:

1. Chiama `/api/campaigns/profiles` (backend)
2. Il backend chiama Amazon API per ottenere tutti i profili disponibili
3. Amazon risponde con la lista dei profili attivi (es: UK, IT, DE, FR, ES)
4. Il frontend mostra solo i marketplace per cui Amazon ha restituito un profilo

### 2. Marketplace Supportati vs Disponibili

Il frontend supporta **8 marketplace**:
- 🇺🇸 US
- 🇨🇦 CA
- 🇬🇧 UK
- 🇮🇹 IT
- 🇩🇪 DE
- 🇫🇷 FR
- 🇪🇸 ES
- 🇦🇺 AU

Ma **mostra attivi** solo quelli per cui Amazon API restituisce un profilo valido.

---

## 🐛 Problema: Sync UK Non Mostra Campagne

### Cause Possibili

1. **Campagne in pausa**: Le campagne in pausa **dovrebbero** essere sincronizzate lo stesso
2. **Filtro dello stato**: Amazon API potrebbe filtrare le campagne in pausa
3. **Errore di sincronizzazione**: Controlla i log del backend

### Debug

#### Opzione 1: Controlla i Log del Backend

1. Vai su **Render Dashboard** → Servizio Backend
2. Clicca su **Logs**
3. Cerca la sincronizzazione UK, dovresti vedere:
   ```
   📊 Sincronizzazione campagne per profilo: [UK_PROFILE_ID]
   ✅ Sincronizzate X campagne
   ```

#### Opzione 2: Controlla il Database Supabase

1. Vai su **Supabase** → **Table Editor** → Tabella `campaigns`
2. Filtra per `marketplace = 'UK'` o `marketplace = 'GB'`
3. Verifica se ci sono campagne nel database

#### Opzione 3: Verifica su Amazon Advertising

1. Vai su https://advertising.amazon.com
2. Seleziona marketplace **UK**
3. Vai su **Campaign Manager**
4. Verifica quante campagne vedi (attive + in pausa)
5. Se vedi campagne su Amazon ma non nel tuo sistema, c'è un problema di sync

---

## 📝 Possibili Fix

### Fix 1: Verifica Token Amazon

I token Amazon devono avere i permessi corretti. Controlla nel file `.env` su Render:

```env
AMAZON_CLIENT_ID=your_client_id_here
AMAZON_CLIENT_SECRET=your_client_secret_here
AMAZON_REFRESH_TOKEN=your_refresh_token_here
```

Verifica che questi token siano:
- Corretti
- Non scaduti
- Con permessi di lettura campagne per tutti i marketplace

### Fix 2: Controlla il Codice di Sincronizzazione

Il backend potrebbe filtrare le campagne. Verifica il file:
- `src/routes/campaigns.ts` → endpoint `POST /api/campaigns/sync/:profileId`

Cerca se c'è un filtro come:
```typescript
state: 'enabled'  // ❌ Questo filtrerebbe le campagne in pausa
```

Dovrebbe essere:
```typescript
// ✅ Nessun filtro, prende tutte le campagne
```

### Fix 3: Forza Sync Completo

Prova a fare **"Sync Tutti"** invece di "Sync Singolo":
- Questo sincronizza TUTTI i marketplace contemporaneamente
- Potrebbe bypassare problemi di filtro

---

## 🎨 Bandiere nel Popup

Le bandiere **dovrebbero** già essere visibili nel popup. Se non le vedi:

### Verifica Browser

Alcuni browser non supportano le emoji delle bandiere. Prova:
- Chrome (✅ supporta)
- Firefox (✅ supporta)
- Safari (✅ supporta)
- Edge (✅ supporta)

### Verifica Font

Se usi Windows, assicurati che il font **Segoe UI Emoji** sia installato (dovrebbe esserlo di default).

---

## 📊 Output Atteso

Quando fai sync, dovresti vedere:

### Popup Selettore Marketplace

```
Seleziona Marketplace

🇺🇸 US               ← Disabilitato se non configurato
🇨🇦 CA               ← Disabilitato se non configurato
🇬🇧 UK               ✅ Attivo
🇮🇹 IT               ✅ Attivo
🇩🇪 DE               ✅ Attivo
🇫🇷 FR               ✅ Attivo
🇪🇸 ES               ✅ Attivo
🇦🇺 AU               ← Disabilitato se non configurato
```

### Dopo Sync UK

```
✅ Sincronizzazione completata: 15 create, 0 aggiornate
```

Oppure (se già sincronizzate prima):

```
✅ Sincronizzazione completata: 0 create, 15 aggiornate
```

### Nella Tabella Campagne

Dovresti vedere le campagne UK con:
- Bandiera 🇬🇧
- Nome campagna
- Stato: **Pausa** (se sono in pausa)
- Badge **F1, F2, F3, F4, F5** per le funzioni attive

---

## 🔍 Test Rapido

Per verificare che tutto funzioni:

1. Apri **Developer Tools** (F12)
2. Vai su **Console**
3. Fai sync UK
4. Guarda i log nella console

Dovresti vedere:
```javascript
GET https://tuo-backend.onrender.com/api/campaigns/profiles → 200 OK
POST https://tuo-backend.onrender.com/api/campaigns/sync/[PROFILE_ID] → 200 OK
GET https://tuo-backend.onrender.com/api/campaigns?includeConfig=true → 200 OK
```

Se vedi errori (❌ 401, 404, 500), mandami lo screenshot e ti aiuto a risolvere.

---

## 💡 Suggerimenti

1. **Inizia con un marketplace**: Sincronizza prima UK (che hai configurato)
2. **Verifica il database**: Controlla su Supabase che le campagne siano state salvate
3. **Espandi gradualmente**: Una volta che UK funziona, aggiungi altri marketplace
4. **US, CA, AU**: Configura questi marketplace su Amazon Advertising quando sei pronto

---

**Hai bisogno di aiuto?** Mandami:
1. Il messaggio esatto che vedi dopo sync UK
2. Screenshot della console (F12 → Console) dopo sync
3. Screenshot dei log del backend su Render

Ti aiuterò a risolvere! 🚀
