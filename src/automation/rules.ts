// ================================================
// REGOLE DI AUTOMAZIONE
// ================================================
// Qui definiamo le regole che automatizzano le operazioni
// sulle campagne Amazon Ads

import { amazonApiService } from '../services/amazonApi';

// Interfaccia per definire una regola di automazione
interface AutomationRule {
  name: string;           // Nome della regola
  description: string;    // Descrizione di cosa fa
  enabled: boolean;       // Se è attiva o no
  execute: () => Promise<void>;  // Funzione che esegue la regola
}

// ================================================
// DEFINIZIONE DELLE REGOLE
// ================================================

// REGOLA 1: Abbassa bid delle keyword con ACoS alto
const reduceBidHighAcosRule: AutomationRule = {
  name: 'Riduci bid ACoS alto',
  description: 'Riduce del 10% il bid delle keyword con ACoS > 40%',
  enabled: true,

  async execute() {
    console.log(`\n📋 Esecuzione regola: ${this.name}`);

    try {
      // 1. Recupera tutte le keyword
      const keywords = await amazonApiService.getKeywords();
      console.log(`   Analisi di ${keywords.length} keywords...`);

      // 2. Per ogni keyword, controlla le metriche
      // NOTA: In un'app reale dovresti recuperare i report delle performance
      // Qui è un esempio semplificato

      let modifiedCount = 0;

      for (const keyword of keywords) {
        // Simula il calcolo dell'ACoS (in realtà lo prendi dal report)
        // ACoS = (Spesa Pubblicitaria / Vendite) * 100

        // ESEMPIO: se la keyword ha ACoS > 40%
        // In realtà qui dovresti fare:
        // const performance = await getKeywordPerformance(keyword.keywordId);
        // const acos = (performance.cost / performance.sales) * 100;

        // Per ora, logica di esempio:
        const shouldReduce = false; // Cambia in base ai tuoi dati reali

        if (shouldReduce) {
          // Calcola il nuovo bid (riduzione del 10%)
          const currentBid = keyword.bid;
          const newBid = currentBid * 0.9;

          console.log(`   🔽 Riduco bid keyword ${keyword.keywordId}: ${currentBid} → ${newBid}`);

          // Aggiorna il bid
          await amazonApiService.updateKeywordBid(keyword.keywordId, newBid);
          modifiedCount++;
        }
      }

      console.log(`   ✅ Regola completata. Modificate ${modifiedCount} keywords`);
    } catch (error) {
      console.error(`   ❌ Errore esecuzione regola:`, error);
    }
  }
};

// REGOLA 2: Metti in pausa keyword con performance pessime
const pauseLowPerformanceKeywordsRule: AutomationRule = {
  name: 'Pausa keyword scarse',
  description: 'Mette in pausa keyword con CTR < 0.3% e almeno 100 impressions',
  enabled: true,

  async execute() {
    console.log(`\n📋 Esecuzione regola: ${this.name}`);

    try {
      const keywords = await amazonApiService.getKeywords();
      console.log(`   Analisi di ${keywords.length} keywords...`);

      let pausedCount = 0;

      for (const keyword of keywords) {
        // ESEMPIO: logica per determinare se pausare
        // In realtà dovresti controllare:
        // - CTR (Click Through Rate) = (clicks / impressions) * 100
        // - Numero di impressions

        // const performance = await getKeywordPerformance(keyword.keywordId);
        // const ctr = (performance.clicks / performance.impressions) * 100;
        // const shouldPause = ctr < 0.3 && performance.impressions >= 100;

        const shouldPause = false; // Cambia in base ai tuoi dati reali

        if (shouldPause && keyword.state === 'enabled') {
          console.log(`   ⏸️  Metto in pausa keyword ${keyword.keywordId}`);

          await amazonApiService.updateKeywordState(keyword.keywordId, 'paused');
          pausedCount++;
        }
      }

      console.log(`   ✅ Regola completata. Pausate ${pausedCount} keywords`);
    } catch (error) {
      console.error(`   ❌ Errore esecuzione regola:`, error);
    }
  }
};

// REGOLA 3: Aumenta bid delle keyword performanti
const increaseBidHighPerformanceRule: AutomationRule = {
  name: 'Aumenta bid top keywords',
  description: 'Aumenta del 15% il bid delle keyword con ACoS < 20% e almeno 5 conversioni',
  enabled: true,

  async execute() {
    console.log(`\n📋 Esecuzione regola: ${this.name}`);

    try {
      const keywords = await amazonApiService.getKeywords();
      console.log(`   Analisi di ${keywords.length} keywords...`);

      let modifiedCount = 0;

      for (const keyword of keywords) {
        // ESEMPIO: logica per aumentare bid
        // const performance = await getKeywordPerformance(keyword.keywordId);
        // const acos = (performance.cost / performance.sales) * 100;
        // const shouldIncrease = acos < 20 && performance.conversions >= 5;

        const shouldIncrease = false; // Cambia in base ai tuoi dati reali

        if (shouldIncrease) {
          const currentBid = keyword.bid;
          const newBid = currentBid * 1.15; // Aumento del 15%

          console.log(`   🔼 Aumento bid keyword ${keyword.keywordId}: ${currentBid} → ${newBid}`);

          await amazonApiService.updateKeywordBid(keyword.keywordId, newBid);
          modifiedCount++;
        }
      }

      console.log(`   ✅ Regola completata. Modificate ${modifiedCount} keywords`);
    } catch (error) {
      console.error(`   ❌ Errore esecuzione regola:`, error);
    }
  }
};

// ================================================
// ARRAY DI TUTTE LE REGOLE
// ================================================
const allRules: AutomationRule[] = [
  reduceBidHighAcosRule,
  pauseLowPerformanceKeywordsRule,
  increaseBidHighPerformanceRule
  // Aggiungi altre regole qui...
];

// ================================================
// FUNZIONE PRINCIPALE CHE ESEGUE TUTTE LE REGOLE
// ================================================
export async function runAutomationRules(): Promise<void> {
  console.log('🎯 Inizio esecuzione regole di automazione\n');

  // Filtra solo le regole abilitate
  const enabledRules = allRules.filter(rule => rule.enabled);

  console.log(`📊 Regole abilitate: ${enabledRules.length}/${allRules.length}`);

  // Esegui ogni regola in sequenza
  for (const rule of enabledRules) {
    try {
      await rule.execute();
    } catch (error) {
      console.error(`❌ Errore nella regola "${rule.name}":`, error);
      // Continua con le altre regole anche se una fallisce
    }
  }

  console.log('\n🎯 Tutte le regole sono state eseguite');
}

// Esporta anche l'array delle regole per gestirle da API
export { allRules };
