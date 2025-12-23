# Amazon Ads Manager - KDP Sync Extension

Estensione Chrome per sincronizzare automaticamente i dati Amazon KDP con Amazon Ads Manager.

## Installazione

### 1. Carica l'estensione in Chrome

1. Apri Chrome e vai su `chrome://extensions/`
2. Attiva la "Modalità sviluppatore" in alto a destra
3. Clicca "Carica estensione non pacchettizzata"
4. Seleziona la cartella `browser-extension`

### 2. Configurazione

Prima di usare l'estensione, aggiorna l'`API_URL` in `popup.js`:

```javascript
// Sviluppo locale
const API_URL = 'http://localhost:3000';

// Produzione
const API_URL = 'https://tua-app.onrender.com';
```

### 3. Aggiungi icone

Crea le icone dell'estensione nella cartella `browser-extension/images/`:
- `icon16.png` (16x16px)
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

## Utilizzo

1. **Accedi a Amazon KDP**
   - Vai su `https://kdp.amazon.com`
   - Effettua il login con il tuo account

2. **Apri l'estensione**
   - Clicca sull'icona dell'estensione nella barra di Chrome
   - Clicca "🔄 Sincronizza con KDP"

3. **Verifica stato**
   - Clicca "📊 Verifica Stato" per controllare l'ultima sincronizzazione

## Sicurezza

- I cookie vengono criptati prima di essere salvati nel database
- La comunicazione con il server usa HTTPS in produzione
- I cookie vengono aggiornati automaticamente ogni 7 giorni

## Troubleshooting

### "Nessun cookie trovato"
- Assicurati di essere loggato su kdp.amazon.com
- Ricarica la pagina KDP e riprova

### "Errore di connessione"
- Verifica che l'API_URL sia corretto
- Controlla che il backend sia in esecuzione
- Verifica i permessi CORS del backend

### "Cookie scaduti"
- Riapri kdp.amazon.com
- Clicca nuovamente "Sincronizza con KDP"

## Supporto marketplace

L'estensione supporta i seguenti marketplace Amazon:
- 🇺🇸 US (amazon.com)
- 🇮🇹 IT (amazon.it)
- 🇬🇧 UK (amazon.co.uk)
- 🇩🇪 DE (amazon.de)
- 🇫🇷 FR (amazon.fr)
- 🇪🇸 ES (amazon.es)
- 🇨🇦 CA (amazon.ca)
- 🇦🇺 AU (amazon.com.au)
