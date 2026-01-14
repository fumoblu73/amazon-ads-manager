# Guida Sincronizzazione KDP Sales & Royalties

## Panoramica

Il sistema di sincronizzazione KDP è stato implementato per importare automaticamente:

1. **Bookshelf** - Metadati libri (titolo, ASIN, autore, copertina, ecc.)
2. **Sales Dashboard** - Vendite giornaliere per ASIN (paid units, free units, KENP reads)
3. **Payments & Royalties** - Royalties e spese pubblicitarie
4. **CSV Reports** - Dati storici da "Prior Month's Royalties Report"

## Architettura

### Servizi Implementati

1. **kdp-scraper.service.ts**
   - Scraping bookshelf da `https://kdp.amazon.com/bookshelf`
   - Estrae metadati libri (solo Paperback)
   - Gestisce paginazione automatica

2. **kdp-reports-scraper.service.ts** (NUOVO)
   - Scraping da `https://kdpreports.amazon.com` (KDP Reports Beta)
   - **Approccio ibrido**:
     - Intercetta chiamate API interne (metodo primario)
     - Fallback su HTML scraping se API non disponibile
   - Supporta:
     - Sales Dashboard (`#/orders`)
     - Payments & Royalties (`#/royalties`)
     - CSV download (`#/reports`)

3. **kdp-sync-scheduler.ts**
   - Scheduler cron che esegue sync ogni 6 ore
   - Sync sequenziale: prima bookshelf, poi sales/royalties
   - Gestisce multiple utenti in parallelo

### Database

**Tabelle Coinvolte:**

- `kdp_books` - Libri sincronizzati da bookshelf
- `kdp_daily_stats` - Statistiche giornaliere per ASIN/data
  - Campi: `date`, `asin`, `paidUnits`, `freeUnits`, `kenpReads`, `grossRoyalties`, `spending`, `netRoyalties`, `marketplace`

## Come Funziona

### 1. Setup Iniziale (Estensione Chrome)

L'utente deve installare l'estensione Chrome e sincronizzare i cookie KDP:

```
1. Accedi a https://kdp.amazon.com
2. Apri l'estensione Chrome
3. Clicca "Sincronizza con KDP"
```

L'estensione:
- Estrae cookie Amazon necessari per autenticazione
- Li cripta e salva nel database
- Abilita `kdpSyncEnabled = true` per l'utente

### 2. Sync Automatico (Ogni 6 ore)

Lo scheduler esegue automaticamente:

```typescript
// Per ogni utente con sync abilitato:

// Step 1: Sync Bookshelf
const books = await kdpScraperService.syncUserData(userId);
// → Salva libri in kdp_books

// Step 2: Sync Sales & Royalties (ultimi 90 giorni)
const sales = await kdpReportsScraperService.syncSalesAndRoyalties(userId, false);
// → Salva statistiche in kdp_daily_stats
```

### 3. Import Dati Storici (Manuale)

L'utente può importare tutti i mesi storici disponibili:

**API Endpoint:** `POST /api/kdp/books/sync-historical`

```typescript
const result = await kdpReportsScraperService.syncSalesAndRoyalties(userId, true);
// → Download tutti i CSV mensili disponibili
// → Parse e import in kdp_daily_stats
```

## API Endpoints

### Sync Manuale (Bookshelf + Sales Recenti)

```http
POST /api/kdp/books/sync
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "books": 25,
    "stats": 150,
    "message": "KDP data synchronized successfully"
  }
}
```

### Import Dati Storici

```http
POST /api/kdp/books/sync-historical
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "monthsImported": 12,
    "message": "Successfully imported 12 months of historical data"
  }
}
```

### Verifica Cookie Status

```http
GET /api/kdp-sync/status
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "syncEnabled": true,
    "cookiesUpdatedAt": "2026-01-10T10:00:00Z",
    "lastSyncAt": "2026-01-13T08:00:00Z",
    "marketplace": "US",
    "cookieAge": 3,
    "cookiesExpired": false,
    "needsRefresh": false,
    "daysUntilExpiration": 4
  }
}
```

## Approccio Tecnico: Scraping KDP Reports Beta

### KDP Reports Beta è una SPA React

Le pagine `https://kdpreports.amazon.com` sono costruite con React e caricano i dati via API interne dopo il load iniziale.

### Strategia Ibrida Implementata

#### 1. API Interception (Primario)

```typescript
// Setup request/response interceptor in Puppeteer
await page.setRequestInterception(true);

page.on('response', async (response) => {
  const url = response.url();

  if (url.includes('kdpreports.amazon.com') && response.status() === 200) {
    if (url.includes('orders') || url.includes('sales')) {
      const data = await response.json();
      this.interceptedApiData.set('sales', data);
    }
  }
});
```

**Vantaggi:**
- ✅ Più affidabile (dati strutturati JSON)
- ✅ Non dipende da CSS/HTML
- ✅ Più veloce

#### 2. HTML Scraping (Fallback)

Se l'intercettazione API fallisce, usa selettori HTML:

```typescript
const salesData = await page.evaluate(() => {
  const tables = document.querySelectorAll('table');
  // Extract data from table rows
});
```

### 3. CSV Parsing (Dati Storici)

Per importare mesi precedenti, scarica CSV ufficiali:

```typescript
// Find all CSV download links
const csvLinks = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('a[href*=".csv"]'));
});

// Download and parse each CSV
for (const link of csvLinks) {
  const csvContent = await this.downloadCSV(page, link.href);
  const records = csv.parse(csvContent, { columns: true });
  // Save to database
}
```

## Testing

### Test Manuale via API

```bash
# 1. Login e ottieni token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 2. Trigger sync manuale
curl -X POST http://localhost:3000/api/kdp/books/sync \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# 3. Import dati storici
curl -X POST http://localhost:3000/api/kdp/books/sync-historical \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# 4. Verifica dati
curl http://localhost:3000/api/kdp/analytics/historical
```

### Test da Frontend

```typescript
import { kdpBooksApi } from './services/api';

// Sync manuale
const result = await kdpBooksApi.sync(token);
console.log(`Synced: ${result.data.books} books, ${result.data.stats} stats`);

// Import storico
const historical = await kdpBooksApi.syncHistorical(token);
console.log(`Imported ${historical.data.monthsImported} months`);
```

## Troubleshooting

### 1. "Authentication failed - redirected to login"

**Causa:** Cookie scaduti o invalidi

**Soluzione:**
- Vai su kdp.amazon.com e fai login
- Riapri estensione Chrome e clicca "Sincronizza con KDP"
- Verifica cookie status: `GET /api/kdp-sync/status`

### 2. "No API data intercepted, trying HTML scraping"

**Causa:** KDP Reports ha cambiato API interne o le chiamate non sono state intercettate

**Soluzione:**
- Aumentare timeout: `await page.waitForTimeout(10000);`
- Ispezionare Network tab su kdpreports.amazon.com per vedere URL API reali
- Aggiornare parser HTML se necessario

### 3. "Book not found for ASIN, skipping"

**Causa:** Il libro non è presente in `kdp_books` (bookshelf non sincronizzato)

**Soluzione:**
- Eseguire prima sync bookshelf: `POST /api/kdp/books/sync`
- Assicurarsi che il libro sia visibile su kdp.amazon.com/bookshelf

### 4. CSV parsing fallisce

**Causa:** Amazon ha cambiato formato CSV

**Soluzione:**
- Scaricare CSV manualmente da KDP Reports
- Ispezionare colonne (header)
- Aggiornare `parseRoyaltiesCSV()` con nuovi nomi colonne

## Limitazioni Attuali

1. **Marketplace Support:** Attualmente supporta solo marketplace US
   - Possibile estendere a UK, DE, FR, IT, ES, ecc.

2. **Date Range:** Sales Dashboard scraping limitato a ultimi 90 giorni
   - Dati più vecchi vanno importati da CSV

3. **API Intercept:** Richiede che KDP Reports usi chiamate XHR/Fetch standard
   - Se Amazon usa GraphQL o WebSocket, serve adattamento

4. **Rate Limiting:** Amazon potrebbe bloccare troppe richieste
   - Attualmente: 5 secondi di pausa tra utenti
   - Aumentare se necessario

## Prossimi Sviluppi

- [ ] Supporto multi-marketplace simultaneo
- [ ] Retry automatico in caso di errore temporaneo
- [ ] Notifiche email quando sync fallisce
- [ ] Dashboard admin per monitorare sync status di tutti gli utenti
- [ ] Cache intelligente per ridurre chiamate Amazon
- [ ] Export dati in Excel/CSV per backup

## Note Tecniche

### Performance

- **Sync Bookshelf:** ~30 secondi per 50 libri (con paginazione)
- **Sync Sales Dashboard:** ~15 secondi per 90 giorni di dati
- **Import CSV Storico:** ~5 minuti per 12 mesi (include download)

### Sicurezza

- Cookie criptati con AES-256
- Token JWT per autenticazione API
- Cookie auto-expire dopo 7 giorni (reminder a 5 giorni)

### Scalabilità

- Scheduler gestisce multiple utenti in sequenza
- Browser Puppeteer riutilizzato tra sync dello stesso utente
- Chiusura automatica browser dopo batch completo
