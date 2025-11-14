# 🔧 Setup Claude API per VS Code - Guida Completa

## ✅ Stato Attuale

- **API Key**: Configurata in `.env` ✅
- **File .env**: Protetto da `.gitignore` ✅
- **Crediti disponibili**: $250 (scadenza 18 Novembre 2024)

---

## 📋 Prossimi Passi per Usare l'API

### Step 1: Riavvia VS Code

1. **Chiudi completamente VS Code** (non solo la finestra, chiudi l'applicazione)
2. **Riapri VS Code**
3. Apri la cartella del progetto: `h:\Il mio Drive\tools&risorse\amazon-ads-manager`

### Step 2: Verifica Estensione Claude Code

**Opzione A - Se hai già l'estensione Claude Code:**
1. Premi `Ctrl+Shift+P`
2. Digita: `Claude`
3. Dovresti vedere comandi Claude disponibili
4. Se vedi l'estensione, passa a Step 3

**Opzione B - Se NON hai l'estensione:**
1. Apri Extensions: `Ctrl+Shift+X`
2. Cerca: **"Claude Code"** o **"Anthropic"**
3. Clicca **Install**
4. Riavvia VS Code

### Step 3: Configura Estensione per Usare .env

L'estensione Claude Code dovrebbe automaticamente leggere la variabile `ANTHROPIC_API_KEY` dal file `.env`.

**Se l'estensione NON legge automaticamente .env:**

1. Apri Command Palette: `Ctrl+Shift+P`
2. Digita: **"Preferences: Open User Settings (JSON)"**
3. Aggiungi questa configurazione:

```json
{
  "claude.apiKey": "${env:ANTHROPIC_API_KEY}"
}
```

### Step 4: Test Configurazione

1. Apri Command Palette: `Ctrl+Shift+P`
2. Digita: **"Claude: New Chat"** (o comando simile)
3. Prova a scrivere un messaggio di test
4. Se funziona, vedrai la risposta di Claude ✅

**Se vedi errore "API Key not found":**
- Verifica che il file `.env` contenga la riga: `ANTHROPIC_API_KEY=sk-ant-...`
- Verifica che VS Code sia stato riavviato dopo aver modificato `.env`
- Prova a chiudere TUTTE le finestre VS Code e riaprire

---

## 🔍 Verifica Crediti API

1. Vai su: [https://console.anthropic.com/settings/usage](https://console.anthropic.com/settings/usage)
2. Dovresti vedere:
   - **Balance**: $250.00 (o meno se già usati)
   - **Expiration**: 18 Nov 2024

---

## 🎯 Come Usare l'API per il Frontend

Una volta configurato, puoi:

1. **Aprire nuova chat Claude** con API credits
2. **Continuare questa conversazione** nella nuova chat con API
3. **Sviluppare frontend completo** senza preoccuparti dei token

### Comando per Continuare Questa Sessione

Quando apri una nuova chat con API credits attivi, scrivi:

```
Continua da dove ci siamo fermati.
Ho configurato l'API key e voglio sviluppare il frontend completo
seguendo l'approccio ibrido (Opzione A light + B graduale).

Backend completato:
- API Books, Campaigns, Logs funzionanti ✅
- Database migrations applicate ✅
- Deploy su Render.com attivo ✅

Voglio iniziare con:
1. Setup base React + TypeScript + Vite + TailwindCSS
2. Dashboard con statistiche
3. Componenti Books, Campaigns, Logs
```

---

## ⚠️ Troubleshooting

### Problema: "API Key not found"

**Soluzione 1:**
```bash
# Verifica che la variabile sia nel file
cat .env | grep ANTHROPIC
```

Dovresti vedere:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Soluzione 2:**
- Riavvia VS Code completamente
- Chiudi tutte le finestre
- Riapri il progetto

**Soluzione 3:**
- Verifica che l'estensione Claude Code sia installata
- Verifica versione estensione (aggiorna se necessario)

### Problema: "Invalid API Key"

**Causa**: La chiave è scaduta o errata

**Soluzione:**
1. Vai su [console.anthropic.com](https://console.anthropic.com)
2. Vai su "API Keys"
3. Verifica che la chiave esista
4. Se necessario, crea una nuova chiave
5. Aggiorna il file `.env` con la nuova chiave

### Problema: "Rate Limit Exceeded"

**Causa**: Hai superato il limite di richieste

**Soluzione:**
- Attendi qualche secondo
- Riprova
- I crediti bonus hanno limiti generosi

---

## 📊 Monitoring Uso Crediti

Monitora l'uso dei crediti su:
- [https://console.anthropic.com/settings/usage](https://console.anthropic.com/settings/usage)

**Stima costi frontend:**
- Setup base: ~$2-3
- Componenti core: ~$5-8
- Features avanzate: ~$10-15
- **Totale stimato: ~$20-30 di $250 disponibili**

Hai crediti più che sufficienti! 🚀

---

## 🎉 Prossimi Step

Una volta configurato tutto:

1. ✅ Chiudi questa chat (salva se necessario)
2. ✅ Apri nuova chat Claude Code (con API credits)
3. ✅ Copia il comando sopra per continuare
4. ✅ Inizia sviluppo frontend!

**Scadenza crediti: 18 Novembre 2024** (tra 5 giorni)
**Usa i crediti ora per completare il frontend!** 💪
