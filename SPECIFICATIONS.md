# Amazon Ads Manager - Specifiche Complete

## 📋 Indice
1. [Panoramica](#panoramica)
2. [Tipologie Campagne](#tipologie-campagne)
3. [FAST ACoS](#fast-acos)
4. [Marketplace e Valute](#marketplace-e-valute)
5. [Funzione 1: Progressive Bidding Increase](#funzione-1-progressive-bidding-increase)
6. [Funzione 2: Placement Optimization](#funzione-2-placement-optimization)
7. [Funzione 3: Targeting Optimization](#funzione-3-targeting-optimization)
8. [Funzione 4: Auto Ad Optimization](#funzione-4-auto-ad-optimization)
9. [Funzione 5: Campaign Feeding](#funzione-5-campaign-feeding)
10. [Calendario Esecuzioni](#calendario-esecuzioni)

---

## Panoramica

Sistema di automazione per la gestione e ottimizzazione delle campagne Amazon Advertising.

### Architettura
- **Backend**: Node.js + TypeScript
- **Database**: PostgreSQL (Supabase)
- **Hosting**: Render.com (gratuito)
- **Trigger**: Cron-Job.org (chiamate HTTP programmate)
- **API**: Amazon Advertising API

### Periodo di riscaldamento
Tutte le automazioni partono **7 giorni dopo la creazione della campagna** per permettere la raccolta di dati sufficienti.

---

## Tipologie Campagne

| # | Nome | Match Type | Descrizione |
|---|------|------------|-------------|
| 1 | **Keyword Targeting** | Broad | Keyword a corrispondenza generica |
| 2 | **Product Targeting** | Exact | Prodotti a corrispondenza esatta |
| 3 | **Keyword Super** | Exact + Phrase | Keyword precise e a frase |
| 4 | **Product Super** | Expanded | Prodotti con targeting espanso |
| 5 | **AD Automatica** | Auto | Campagne automatiche Amazon |

---

## FAST ACoS

Metrica chiave per determinare la redditività di una campagna.

### Formula
```
FAST ACoS = Royalty / (Prezzo × 1.22)

Dove:
- Royalty = (60% × Prezzo) - Costi di stampa
- Prezzo = Prezzo di vendita del libro
- 1.22 = IVA italiana (22%)
```

### Esempio Calcolo
```
Prezzo libro: 15€
Costi stampa: 3€
Royalty = (60% × 15€) - 3€ = 9€ - 3€ = 6€
FAST ACoS = 6€ / (15€ × 1.22) = 6 / 18.3 = 32.8%
```

Il FAST ACoS rappresenta l'**ACoS di breakeven** (punto di pareggio).

### Tabella Fasce FAST ACoS

Il FAST ACoS viene diviso in 5 fasce per determinare le azioni di ottimizzazione:

| Fascia | Range ACoS | Azione Placement | Azione Bid |
|--------|------------|------------------|------------|
| 1 | 0% → FAST/3 | +10% | +0.05 |
| 2 | FAST/3 → FAST×2/3 | +5% | +0.02 |
| 3 | FAST×2/3 → FAST | 0% | 0 |
| 4 | FAST → FAST×4/3 | -5% | -0.02 |
| 5 | FAST×4/3 → FAST×5/3 | -10% | -0.05 |

**Esempio con FAST ACoS = 60%:**
- Fascia 1: 0-20% (ottima performance)
- Fascia 2: 20-40% (buona performance)
- Fascia 3: 40-60% (performance accettabile)
- Fascia 4: 60-80% (performance scarsa)
- Fascia 5: 80%+ (performance pessima)

**Note:**
- Il FAST ACoS è specifico per **ogni libro** (non per marketplace)
- I marketplace hanno valute diverse ma il calcolo è lo stesso
- Limiti minimi: Bid minimo = 0.00, Placement minimo = 0%

---

## Marketplace e Valute

| Marketplace | Codice | Valuta |
|-------------|--------|--------|
| United States | US | USD ($) |
| United Kingdom | UK | GBP (£) |
| Canada | CA | CAD ($) |
| Germania | DE | EUR (€) |
| Spagna | ES | EUR (€) |
| Francia | FR | EUR (€) |
| Australia | AU | AUD ($) |
| Italia | IT | EUR (€) |

---

## Funzione 1: Progressive Bidding Increase

### Si applica a
- ✅ Campagna 1: Keyword Targeting
- ✅ Campagna 2: Product Targeting
- ✅ Campagna 3: Keyword Super
- ✅ Campagna 4: Product Super
- ❌ Campagna 5: AD Automatica

### Parametri

| Parametro | Descrizione | Default | Min | Max |
|-----------|-------------|---------|-----|-----|
| **Bid Increase** | Aumento bid in centesimi | 0.02 | - | - |
| **Frequency (days)** | Ogni quanti giorni | 3 | - | - |
| **Impressions (max)** | MAX impressions per aumentare | 20 | - | - |
| **Clicks (max)** | MAX clicks per aumentare | 0 | - | - |

### Logica

```
OGNI 3 giorni (dal giorno 7):

Per ogni keyword/prodotto nelle campagne 1, 2, 3, 4:

  1. Prendi dati ultimi 3 giorni (frequency)

  2. SE (impressions <= 20 AND clicks <= 0):
       → Aumenta bid di 0.02 (nella valuta del marketplace)

  3. ALTRIMENTI:
       → Non fare nulla
```

### Note
- **Obiettivo**: Dare visibilità a keyword/prodotti con poche impressions
- **Nessun limite massimo** di bid
- **DEVE essere sincronizzata** con Funzione 3 (stessa frequency)

---

## Funzione 2: Placement Optimization

### Si applica a
- ✅ Campagna 1: Keyword Targeting
- ✅ Campagna 2: Product Targeting
- ✅ Campagna 3: Keyword Super
- ✅ Campagna 4: Product Super
- ✅ Campagna 5: AD Automatica

### Parametri

| Parametro | Descrizione | Default | Min | Max |
|-----------|-------------|---------|-----|-----|
| **Frequency (days)** | Ogni quanti giorni | 7 | 3 | 14 |
| **Placement Timeframe (weeks)** | Settimane dati per ACoS | 4 | 1 | 6 |

### Placement Types Amazon
1. **Top of Search** - Prima posizione risultati ricerca
2. **Rest of Search** - Altre posizioni risultati
3. **Product Pages** - Pagine dettaglio prodotti

### Logica

```
OGNI 7 giorni (dal giorno 7):

1. Calcola ACoS CAMPAGNA ultimi 28 giorni (4 settimane)
2. Calcola FAST ACoS del libro
3. Determina fascia FAST ACoS
4. Applica adjustment a TUTTI e 3 i placement:

   Fascia 1 (ACoS <= FAST/3):
     → +10% a tutti i placement

   Fascia 2 (ACoS <= FAST×2/3):
     → +5% a tutti i placement

   Fascia 3 (ACoS <= FAST):
     → 0% (nessuna modifica)

   Fascia 4 (ACoS <= FAST×4/3):
     → -5% a tutti i placement (minimo 0%)

   Fascia 5 (ACoS > FAST×4/3):
     → -10% a tutti i placement (minimo 0%)
```

### Esempio
```
Placement correnti:
- Top of Search: 0%
- Rest of Search: 10%
- Product Pages: 5%

SE ACoS campagna in Fascia 2 (+5%):

Placement aggiornati:
- Top of Search: 5%
- Rest of Search: 15%
- Product Pages: 10%
```

### Note
- Il **Bid Adjustment** è una percentuale applicata al bid base
- Si applica a **livello di campagna** (non singola keyword)
- Placement minimo: **0%** (non può andare in negativo)

---

## Funzione 3: Targeting Optimization

### Si applica a
- ✅ Campagna 1: Keyword Targeting
- ✅ Campagna 2: Product Targeting
- ✅ Campagna 3: Keyword Super
- ✅ Campagna 4: Product Super
- ❌ Campagna 5: AD Automatica

### Parametri

| Parametro | Descrizione | Default | Min | Max |
|-----------|-------------|---------|-----|-----|
| **Frequency (days)** | Ogni quanti giorni (= Funz.1) | 3 | 1 | 7 |
| **Timeframe A** | Soglia impressions bassa | 2000 | 1000 | 8000 |
| **Timeframe B** | Soglia impressions media | 3000 | 1000 | 8000 |
| **Timeframe C** | Soglia impressions alta | 5000 | 1000 | 8000 |
| **Clicks (pausa)** | MAX clicks senza ordini | 10 | 0 | ∞ |
| **Clicks (65 days)** | MAX clicks senza ordini 65gg | 30 | 0 | ∞ |

### Determinazione Timeframe Dinamico

```
Daily impressions = Impressions campagna / 30

SE daily_impressions < 2000:
  timeframe = 30 giorni

ALTRIMENTI SE daily_impressions < 3000:
  timeframe = 25 giorni

ALTRIMENTI SE daily_impressions < 5000:
  timeframe = 20 giorni

ALTRIMENTI:
  timeframe = 15 giorni
```

### Logica

```
OGNI 3 giorni (DOPO Funzione 1):

1. Calcola impressions giornaliere CAMPAGNA
2. Determina timeframe dinamico
3. Per ogni keyword/prodotto:

   a) CONTROLLO PAUSA (condizione OR):

      SE (clicks nel timeframe >= 10 E ordini = 0)
         OPPURE
         (clicks ultimi 65 giorni >= 30 E ordini = 0):

         → PAUSA keyword/prodotto
         → ESCI (non fare ottimizzazione bid)

   b) OTTIMIZZAZIONE BID:

      - Calcola ACoS keyword/prodotto nel timeframe
      - Confronta con FAST ACoS
      - Determina fascia:

      Fascia 1 (ACoS <= FAST/3):
        SE (ordini = 1 E clicks = 1):
          → Aumenta bid di +0.02  // CASO SPECIALE
        ALTRIMENTI:
          → Aumenta bid di +0.05

      Fascia 2 (ACoS <= FAST×2/3):
        → Aumenta bid di +0.02

      Fascia 3 (ACoS <= FAST):
        → Nessuna modifica

      Fascia 4 (ACoS <= FAST×4/3):
        → Riduci bid di -0.02 (minimo $0.00)

      Fascia 5 (ACoS > FAST×4/3):
        → Riduci bid di -0.05 (minimo $0.00)
```

### Note
- Si applica a **livello di singola keyword/prodotto**
- **DEVE** essere eseguita DOPO Funzione 1 (stessa frequency)
- Timeframe **dinamico** in base al volume di traffico
- Caso speciale: 1 vendita con 1 click → aumento minore (+0.02 invece di +0.05)

---

## Funzione 4: Auto Ad Optimization

### Si applica a
- ❌ Campagna 1: Keyword Targeting
- ❌ Campagna 2: Product Targeting
- ❌ Campagna 3: Keyword Super
- ❌ Campagna 4: Product Super
- ✅ Campagna 5: AD Automatica (SOLO questa)

### Parametri

| Parametro | Descrizione | Default | Min | Max |
|-----------|-------------|---------|-----|-----|
| **Frequency (days)** | Ogni quanti giorni (indipendente) | 7 | 1 | 14 |
| **Timeframe A** | Soglia impressions bassa | 1000 | 1000 | 8000 |
| **Timeframe B** | Soglia impressions media | 3000 | 1000 | 8000 |
| **Timeframe C** | Soglia impressions alta | 5000 | 1000 | 8000 |
| **Clicks (negative)** | MAX clicks per negative | 10 | 0 | ∞ |
| **Spend (negative)** | MAX spesa per negative | 10 | 0 | ∞ |

### Targeting Groups Amazon Auto Ads
1. **Complements** - Prodotti complementari
2. **Loose match** - Corrispondenza generica
3. **Close match** - Corrispondenza stretta
4. **Substitutes** - Prodotti sostitutivi

### Determinazione Timeframe Dinamico

```
Daily impressions = Impressions campagna / 30

SE daily_impressions < 1000:
  timeframe = 30 giorni

ALTRIMENTI SE daily_impressions < 3000:
  timeframe = 25 giorni

ALTRIMENTI SE daily_impressions < 5000:
  timeframe = 20 giorni

ALTRIMENTI:
  timeframe = 15 giorni
```

### Logica

```
OGNI 7 giorni (dal giorno 7):

1. Calcola impressions giornaliere CAMPAGNA AUTO
2. Determina timeframe dinamico

3. OTTIMIZZAZIONE TARGETING GROUPS:

   Per ogni targeting group (Complements, Loose, Close, Substitutes):

   a) CONTROLLO PAUSA:
      SE (clicks nel timeframe > 10 E ordini = 0):
        → PAUSA targeting group
        → ESCI

   b) OTTIMIZZAZIONE BID:
      - Calcola ACoS del targeting group
      - Applica modifica bid secondo tabella FAST ACoS:

      Fascia 1: +0.05
      Fascia 2: +0.02
      Fascia 3: 0
      Fascia 4: -0.02 (minimo $0.00)
      Fascia 5: -0.05 (minimo $0.00)

4. NEGATIVE TARGETING (Search Terms):

   Per ogni search term nella sezione "Search terms":

   SE (clicks >= 10 E ordini = 0)
      OPPURE
      (spend >= 10 E ordini = 0):

      SE search term è una KEYWORD:
        → Aggiungi a "Negative keywords"

      ALTRIMENTI SE search term è un ASIN:
        → Aggiungi a "Negative products"
```

### Note
- Frequency **indipendente** dalle altre funzioni
- Gestisce sia **ottimizzazione bid** che **negative targeting**
- Search terms con performance pessime vanno in negativa

---

## Funzione 5: Campaign Feeding

### Si applica a
- ✅ Campagna 1: Keyword Targeting
- ✅ Campagna 2: Product Targeting
- ✅ Campagna 3: Keyword Super
- ✅ Campagna 4: Product Super
- ✅ Campagna 5: AD Automatica (come fonte)

### Parametri

| Parametro | Descrizione | Default | Valori |
|-----------|-------------|---------|--------|
| **Frequency (days)** | Ogni quanti giorni (indipendente) | 7 | 7, 14, 21, 28 |
| **Orders (min)** | MIN ordini per aggiunta | 1 | 1+ |

### Bid Iniziali per Nuove Keyword/Prodotti

| Campagna | Match Type | Bid Default | Min | Max |
|----------|------------|-------------|-----|-----|
| Campagna 1 | Broad | $0.30 | $0.01 | ∞ |
| Campagna 2 | Exact | $0.30 | $0.01 | ∞ |
| Campagna 3 | Exact | $0.50 | $0.01 | ∞ |
| Campagna 3 | Phrase | $0.40 | $0.01 | ∞ |
| Campagna 4 | Expanded | $0.30 | $0.01 | ∞ |

### Workflow

#### 1. Search Terms da Campagna 5 (AD Automatica) → Altre

```
Per ogni Search Term con orders >= 1:

  SE è una KEYWORD:
    → Aggiungi a Campagna 1 (Broad) con bid $0.30
    → Aggiungi a Campagna 3 (Exact) con bid $0.50
    → Aggiungi a Campagna 3 (Phrase) con bid $0.40

  SE è un ASIN:
    → Aggiungi a Campagna 2 (Exact) con bid $0.30
    → Aggiungi a Campagna 4 (Expanded) con bid $0.30
```

#### 2. Search Terms da Campagna 1 (Keyword Targeting)

```
Per ogni Search Term con orders >= 1:

  → Aggiungi a Campagna 1 (Broad) - AUTO-FEED con bid $0.30
  → Aggiungi a Campagna 3 (Exact) con bid $0.50
  → Aggiungi a Campagna 3 (Phrase) con bid $0.40
```

#### 3. Search Terms da Campagna 3 (Keyword Super)

```
Per ogni Search Term con orders >= 1:

  → Aggiungi a Campagna 1 (Broad) con bid $0.30
  → Aggiungi a Campagna 3 (Exact) - AUTO-FEED con bid $0.50
  → Aggiungi a Campagna 3 (Phrase) - AUTO-FEED con bid $0.40
```

#### 4. Search Terms da Campagna 2 (Product Targeting)

```
Per ogni Search Term con orders >= 1:

  → Aggiungi a Campagna 2 (Exact) - AUTO-FEED con bid $0.30
  → Aggiungi a Campagna 4 (Expanded) con bid $0.30
```

#### 5. Search Terms da Campagna 4 (Product Super)

```
Per ogni Search Term con orders >= 1:

  → Aggiungi a Campagna 2 (Exact) con bid $0.30
  → Aggiungi a Campagna 4 (Expanded) - AUTO-FEED con bid $0.30
```

### Schema Flusso Visivo

```
CAMPAGNA 5 (Auto)
    ↓
    ├─→ KEYWORD → Camp.1 (Broad) + Camp.3 (Exact+Phrase)
    └─→ ASIN → Camp.2 (Exact) + Camp.4 (Expanded)

CAMPAGNA 1 (Keyword Broad)
    ↓
    KEYWORD → Camp.1 (auto-feed) + Camp.3 (Exact+Phrase)

CAMPAGNA 3 (Keyword Super)
    ↓
    KEYWORD → Camp.1 (Broad) + Camp.3 (auto-feed)

CAMPAGNA 2 (Product Exact)
    ↓
    ASIN → Camp.2 (auto-feed) + Camp.4 (Expanded)

CAMPAGNA 4 (Product Super)
    ↓
    ASIN → Camp.2 (Exact) + Camp.4 (auto-feed)
```

### Note
- **Auto-alimentazione**: Le campagne aggiungono i propri search terms performanti
- **Duplicati**: Amazon gestisce automaticamente (non aggiunge se già esiste)
- **Frequency indipendente** dalle altre funzioni
- Solo search terms con **almeno 1 ordine** vengono aggiunti

---

## Calendario Esecuzioni

### Timeline Esempio (Frequency Default)

| Giorno | Funzioni Eseguite |
|--------|-------------------|
| 0 | Campagna creata |
| 1-6 | Periodo riscaldamento (nessuna automazione) |
| 7 | **Funz.1 → Funz.3** (Camp.1-4) + **Funz.2** (Tutte) + **Funz.4** (Camp.5) + **Funz.5** (Tutte) |
| 10 | **Funz.1 → Funz.3** (Camp.1-4) |
| 13 | **Funz.1 → Funz.3** (Camp.1-4) |
| 14 | **Funz.2** (Tutte) + **Funz.4** (Camp.5) + **Funz.5** (Tutte) |
| 16 | **Funz.1 → Funz.3** (Camp.1-4) |
| 19 | **Funz.1 → Funz.3** (Camp.1-4) |
| 21 | **Funz.2** (Tutte) + **Funz.4** (Camp.5) + **Funz.5** (Tutte) |
| ... | Continua ciclicamente |

### Riepilogo Frequenze

| Funzione | Campagne | Frequency Default | Indipendente |
|----------|----------|-------------------|--------------|
| **1. Progressive Bidding** | 1, 2, 3, 4 | 3 giorni | No (con Funz.3) |
| **2. Placement Optimization** | 1, 2, 3, 4, 5 | 7 giorni | Sì |
| **3. Targeting Optimization** | 1, 2, 3, 4 | 3 giorni | No (dopo Funz.1) |
| **4. Auto Ad Optimization** | 5 | 7 giorni | Sì |
| **5. Campaign Feeding** | 1, 2, 3, 4, 5 | 7 giorni | Sì |

### Ordine Esecuzione Critico

**IMPORTANTE**: Quando Funzione 1 e 3 vengono eseguite lo stesso giorno, l'ordine DEVE essere:
1. **Prima**: Funzione 1 (Progressive Bidding)
2. **Poi**: Funzione 3 (Targeting Optimization)

Questo perché la Funzione 1 aumenta i bid delle keyword con poche impressions, e la Funzione 3 ottimizza/pausa in base alle performance.

---

## Note Tecniche Implementazione

### Gestione Duplicati
Amazon Ads gestisce automaticamente i duplicati:
- Quando si tenta di aggiungere una keyword/ASIN già esistente, Amazon la ignora o restituisce errore
- Non è necessario controllare manualmente l'esistenza prima dell'aggiunta

### Calcolo Daily Impressions
```
Daily Impressions = Impressions totali campagna / 30
```
Questa metrica determina il timeframe dinamico per le funzioni 3 e 4.

### Limiti Minimi
- **Bid minimo**: 0.00 (non può mai essere negativo)
- **Placement minimo**: 0% (non può mai essere negativo)

### Valute per Marketplace
Tutti i valori numerici (bid, spend) devono essere nella valuta corretta del marketplace:
- US, CA, AU: dollari ($)
- UK: sterline (£)
- DE, ES, FR, IT: euro (€)

---

## API Amazon Advertising - Endpoints Principali

### Campagne
- `GET /v2/sp/campaigns` - Lista campagne
- `GET /v2/sp/campaigns/{campaignId}` - Dettagli campagna
- `PUT /v2/sp/campaigns` - Aggiorna campagna

### Keywords
- `GET /v2/sp/keywords` - Lista keywords
- `PUT /v2/sp/keywords` - Aggiorna keywords (bid, stato)
- `POST /v2/sp/keywords` - Aggiungi keywords

### Product Ads
- `GET /v2/sp/productAds` - Lista product ads
- `PUT /v2/sp/productAds` - Aggiorna product ads

### Reports
- `POST /v2/sp/keywords/report` - Richiedi report keyword
- `GET /v2/reports/{reportId}` - Controlla stato report
- Download report da URL fornito

### Search Terms
- `POST /v2/sp/targets/report` - Report search terms
- Usato per Campaign Feeding e Negative Targeting

### Negative Keywords/Products
- `POST /v2/sp/negativeKeywords` - Aggiungi negative keywords
- `POST /v2/sp/negativeTargets` - Aggiungi negative products

---

## Database Schema

### Tabella: campaigns
- id (uuid)
- amazonCampaignId (string, unique)
- name (string)
- type (enum: 1-5)
- state (enum: enabled/paused/archived)
- dailyBudget (decimal)
- campaignType (string)
- marketplace (string)
- createdAt (timestamp)
- updatedAt (timestamp)

### Tabella: automation_logs
- id (uuid)
- campaignId (uuid FK)
- functionName (string: func1, func2, func3, func4, func5)
- action (string: bid_increase, bid_decrease, keyword_pause, etc)
- targetId (string: keyword/ASIN ID)
- targetName (string)
- oldValue (decimal)
- newValue (decimal)
- reason (text)
- status (string: success/failed/skipped)
- errorMessage (text)
- createdAt (timestamp)

### Tabella: keyword_performance
- id (uuid)
- keywordId (string)
- keyword (string)
- campaignId (string)
- date (date)
- impressions (int)
- clicks (int)
- cost (decimal)
- sales (decimal)
- orders (int)
- ctr (decimal)
- acos (decimal)
- cpc (decimal)
- currentBid (decimal)
- state (string)
- createdAt (timestamp)

### Tabella: books
- id (uuid)
- asin (string)
- title (string)
- price (decimal)
- printingCost (decimal)
- royaltyPercentage (decimal, default 60)
- fastAcos (decimal, calculated)
- marketplace (string)
- createdAt (timestamp)
- updatedAt (timestamp)

### Tabella: automation_config
- id (uuid)
- campaignId (uuid FK)
- bookId (uuid FK)
-
- func1_enabled (boolean)
- func1_bidIncrease (decimal)
- func1_frequency (int)
- func1_impressions (int)
- func1_clicks (int)
-
- func2_enabled (boolean)
- func2_frequency (int)
- func2_timeframeWeeks (int)
-
- func3_enabled (boolean)
- func3_frequency (int)
- func3_timeframeA (int)
- func3_timeframeB (int)
- func3_timeframeC (int)
- func3_clicksPause (int)
- func3_clicks65days (int)
-
- func4_enabled (boolean)
- func4_frequency (int)
- func4_timeframeA (int)
- func4_timeframeB (int)
- func4_timeframeC (int)
- func4_clicksNegative (int)
- func4_spendNegative (decimal)
-
- func5_enabled (boolean)
- func5_frequency (int)
- func5_minOrders (int)
- func5_bidBroad (decimal)
- func5_bidExact (decimal)
- func5_bidPhrase (decimal)
- func5_bidExpanded (decimal)
-
- createdAt (timestamp)
- updatedAt (timestamp)

---

## Prossimi Step Implementazione

1. **Completare amazonApi.ts** con tutti gli endpoint necessari
2. **Creare automation/functions/** con 5 file (func1.ts - func5.ts)
3. **Implementare logica FAST ACoS** in utils/fastAcos.ts
4. **Creare scheduler intelligente** che coordina le 5 funzioni
5. **Implementare gestione configurazione** per campagne
6. **Creare API REST** per gestione campagne e configurazioni
7. **Implementare sistema di logging** completo
8. **Testing** di ogni funzione singolarmente
9. **Configurare cron-job.org** per trigger
10. **Creare dashboard frontend** (opzionale)

---

## Contatti e Risorse

- **Amazon Advertising API Docs**: https://advertising.amazon.com/API/docs
- **GitHub Repository**: https://github.com/fumoblu73/amazon-ads-manager
- **App Live**: https://amazon-ads-manager.onrender.com

---

*Documento creato il: 10 Novembre 2025*
*Versione: 1.0*
*Autore: Sistema di specifica Amazon Ads Manager*
