// ================================================
// REGOLE DI AUTOMAZIONE - ORCHESTRAZIONE
// ================================================
// Coordina l'esecuzione delle 5 funzioni di automazione
// per tutte le campagne, rispettando:
// - Periodo di warmup (7 giorni)
// - Frequenze di esecuzione
// - Ordine di esecuzione (Funz.1 → Funz.3)

import { amazonApiService } from '../services/amazonApi';
import { isInWarmupPeriod } from '../utils/timeframe';
import { automationScheduler } from './scheduler';

// Import delle 5 funzioni
import { executeFunc1, shouldExecuteFunc1 } from './functions/func1';
import { executeFunc2, shouldExecuteFunc2 } from './functions/func2';
import { executeFunc3, shouldExecuteFunc3 } from './functions/func3';
import { executeFunc4, shouldExecuteFunc4 } from './functions/func4';
import { executeFunc5, shouldExecuteFunc5, CampaignMapping } from './functions/func5';

/**
 * FUNZIONE PRINCIPALE
 * Esegue tutte le automazioni per tutte le campagne
 */
export async function runAutomationRules(): Promise<void> {
  console.log('🎯 Inizio esecuzione regole di automazione\n');

  try {
    // ================================================
    // 1. RECUPERA TUTTE LE CAMPAGNE
    // ================================================
    const campaigns = await amazonApiService.getCampaigns();
    console.log(`📊 Trovate ${campaigns.length} campagne totali`);

    // Filtra solo campagne enabled
    const activeCampaigns = campaigns.filter((c: any) => c.state === 'enabled');
    console.log(`✅ Campagne attive: ${activeCampaigns.length}\n`);

    if (activeCampaigns.length === 0) {
      console.log('⚠️  Nessuna campagna attiva. Nulla da fare.');
      return;
    }

    // ================================================
    // 2. RAGGRUPPA CAMPAGNE PER LIBRO (ASIN)
    // ================================================
    // Assumiamo che ogni campagna abbia un campo bookId o asin
    // Per semplificare, processiamo ogni campagna individualmente
    // In un'app reale, dovresti raggruppare per libro per la Funzione 5

    const stats = {
      campaignsProcessed: 0,
      campaignsInWarmup: 0,
      func1Executed: 0,
      func2Executed: 0,
      func3Executed: 0,
      func4Executed: 0,
      func5Executed: 0,
      errors: 0
    };

    // ================================================
    // 3. PROCESSA OGNI CAMPAGNA
    // ================================================
    for (const campaign of activeCampaigns) {
      try {
        await processCampaign(campaign, stats);
      } catch (error) {
        stats.errors++;
        console.error(`❌ Errore elaborazione campagna ${campaign.name}:`, error);
      }
    }

    // ================================================
    // 4. RIEPILOGO FINALE
    // ================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO ESECUZIONE AUTOMAZIONI');
    console.log('='.repeat(60));
    console.log(`Campagne processate: ${stats.campaignsProcessed}`);
    console.log(`Campagne in warmup (saltate): ${stats.campaignsInWarmup}`);
    console.log(`\nFunzioni eseguite:`);
    console.log(`  - Funzione 1 (Progressive Bidding): ${stats.func1Executed}`);
    console.log(`  - Funzione 2 (Placement Optimization): ${stats.func2Executed}`);
    console.log(`  - Funzione 3 (Targeting Optimization): ${stats.func3Executed}`);
    console.log(`  - Funzione 4 (Auto Ad Optimization): ${stats.func4Executed}`);
    console.log(`  - Funzione 5 (Campaign Feeding): ${stats.func5Executed}`);
    console.log(`\nErrori: ${stats.errors}`);
    console.log('='.repeat(60));

    console.log('\n🎯 Tutte le regole sono state eseguite\n');

  } catch (error) {
    console.error('❌ Errore fatale durante esecuzione automazioni:', error);
    throw error;
  }
}

/**
 * Processa una singola campagna
 */
async function processCampaign(campaign: any, stats: any): Promise<void> {
  stats.campaignsProcessed++;

  const campaignId = campaign.campaignId;
  const campaignName = campaign.name;
  const campaignType = determineCampaignType(campaign);
  const marketplace = campaign.marketplace || campaign.countryCode || 'US';
  const createdAt = new Date(campaign.startDate || campaign.creationDate || Date.now());

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📢 Campagna: ${campaignName}`);
  console.log(`   Tipo: ${campaignType} | ID: ${campaignId} | Marketplace: ${marketplace}`);
  console.log(`${'─'.repeat(60)}`);

  // ================================================
  // CONTROLLO PERIODO DI WARMUP
  // ================================================
  if (isInWarmupPeriod(createdAt)) {
    console.log(`⏳ Campagna in periodo di warmup (< 7 giorni). Salto automazioni.`);
    stats.campaignsInWarmup++;
    return;
  }

  // ================================================
  // RECUPERA CONFIGURAZIONE E DATI DEL LIBRO
  // ================================================
  // NOTA: In un'app reale, dovresti recuperare da database:
  // - AutomationConfig per questa campagna
  // - Book associato per calcolare FAST ACoS
  // Per ora usiamo dati mock

  const mockBook = {
    price: 15,
    printingCost: 3,
    royaltyPercentage: 60
  };

  const mockConfig = {
    func1_enabled: true,
    func1_bidIncrease: 0.02,
    func1_frequency: 3,
    func1_impressions: 20,
    func1_clicks: 0,

    func2_enabled: true,
    func2_frequency: 7,
    func2_timeframeWeeks: 4,

    func3_enabled: true,
    func3_frequency: 3,
    func3_timeframeA: 2000,
    func3_timeframeB: 3000,
    func3_timeframeC: 5000,
    func3_clicksPause: 10,
    func3_clicks65days: 30,

    func4_enabled: true,
    func4_frequency: 7,
    func4_timeframeA: 1000,
    func4_timeframeB: 3000,
    func4_timeframeC: 5000,
    func4_clicksNegative: 10,
    func4_spendNegative: 10,

    func5_enabled: true,
    func5_frequency: 7,
    func5_minOrders: 1,
    func5_bidBroad: 0.30,
    func5_bidExact: 0.50,
    func5_bidPhrase: 0.40,
    func5_bidExpanded: 0.30
  };

  const mockPlacements = {
    topOfSearch: 0,
    restOfSearch: 10,
    productPages: 5
  };

  // Mock impressions totali ultimi 30 giorni (per calcolo timeframe dinamico)
  const mockTotalImpressions = 50000;

  // Mock ad group ID (necessario per alcune funzioni)
  const mockAdGroupId = campaign.adGroupId || 'mock-adgroup-id';

  // ================================================
  // ESEGUE LE FUNZIONI APPLICABILI
  // ================================================

  // FUNZIONE 1: Progressive Bidding Increase
  if (shouldExecuteFunc1(campaignType) && mockConfig.func1_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func1_${campaignId}`,
      mockConfig.func1_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
        await executeFunc1(campaignId, campaignType as any, campaignName, marketplace, {
          bidIncrease: mockConfig.func1_bidIncrease,
          frequency: mockConfig.func1_frequency,
          maxImpressions: mockConfig.func1_impressions,
          maxClicks: mockConfig.func1_clicks
        });
        automationScheduler.markFunctionExecuted(`func1_${campaignId}`);
        stats.func1Executed++;
      } catch (error) {
        console.error(`❌ Errore Funzione 1:`, error);
      }
    }
  }

  // FUNZIONE 3: Targeting Optimization (DOPO Funzione 1)
  // NOTA: Deve avere stessa frequency di Funzione 1
  if (shouldExecuteFunc3(campaignType) && mockConfig.func3_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func3_${campaignId}`,
      mockConfig.func3_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
        await executeFunc3(
          campaignId,
          campaignType as any,
          campaignName,
          marketplace,
          mockBook,
          mockTotalImpressions,
          {
            frequency: mockConfig.func3_frequency,
            timeframeA: mockConfig.func3_timeframeA,
            timeframeB: mockConfig.func3_timeframeB,
            timeframeC: mockConfig.func3_timeframeC,
            clicksPause: mockConfig.func3_clicksPause,
            clicks65days: mockConfig.func3_clicks65days
          }
        );
        automationScheduler.markFunctionExecuted(`func3_${campaignId}`);
        stats.func3Executed++;
      } catch (error) {
        console.error(`❌ Errore Funzione 3:`, error);
      }
    }
  }

  // FUNZIONE 2: Placement Optimization
  if (shouldExecuteFunc2(campaignType) && mockConfig.func2_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func2_${campaignId}`,
      mockConfig.func2_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
        await executeFunc2(
          campaignId,
          campaignName,
          marketplace,
          mockBook,
          mockPlacements,
          {
            frequency: mockConfig.func2_frequency,
            placementTimeframeWeeks: mockConfig.func2_timeframeWeeks
          }
        );
        automationScheduler.markFunctionExecuted(`func2_${campaignId}`);
        stats.func2Executed++;
      } catch (error) {
        console.error(`❌ Errore Funzione 2:`, error);
      }
    }
  }

  // FUNZIONE 4: Auto Ad Optimization (SOLO campagna 5)
  if (shouldExecuteFunc4(campaignType) && mockConfig.func4_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func4_${campaignId}`,
      mockConfig.func4_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
        await executeFunc4(
          campaignId,
          campaignName,
          marketplace,
          mockAdGroupId,
          mockBook,
          mockTotalImpressions,
          {
            frequency: mockConfig.func4_frequency,
            timeframeA: mockConfig.func4_timeframeA,
            timeframeB: mockConfig.func4_timeframeB,
            timeframeC: mockConfig.func4_timeframeC,
            clicksNegative: mockConfig.func4_clicksNegative,
            spendNegative: mockConfig.func4_spendNegative
          }
        );
        automationScheduler.markFunctionExecuted(`func4_${campaignId}`);
        stats.func4Executed++;
      } catch (error) {
        console.error(`❌ Errore Funzione 4:`, error);
      }
    }
  }

  // FUNZIONE 5: Campaign Feeding
  if (shouldExecuteFunc5(campaignType) && mockConfig.func5_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func5_${campaignId}`,
      mockConfig.func5_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
        // Mock campaign mapping (in realtà dovresti recuperare tutte le campagne dello stesso libro)
        const mockCampaignMapping: CampaignMapping = {
          campaign1Id: 'mock-campaign-1',
          campaign1AdGroupId: 'mock-adgroup-1',
          campaign2Id: 'mock-campaign-2',
          campaign2AdGroupId: 'mock-adgroup-2',
          campaign3Id: 'mock-campaign-3',
          campaign3AdGroupId: 'mock-adgroup-3',
          campaign4Id: 'mock-campaign-4',
          campaign4AdGroupId: 'mock-adgroup-4',
          campaign5Id: campaignId,
          campaign5AdGroupId: mockAdGroupId
        };

        await executeFunc5(
          campaignId,
          campaignType as any,
          marketplace,
          mockCampaignMapping,
          {
            frequency: mockConfig.func5_frequency,
            minOrders: mockConfig.func5_minOrders,
            bidBroad: mockConfig.func5_bidBroad,
            bidExact: mockConfig.func5_bidExact,
            bidPhrase: mockConfig.func5_bidPhrase,
            bidExpanded: mockConfig.func5_bidExpanded
          }
        );
        automationScheduler.markFunctionExecuted(`func5_${campaignId}`);
        stats.func5Executed++;
      } catch (error) {
        console.error(`❌ Errore Funzione 5:`, error);
      }
    }
  }
}

/**
 * Determina il tipo di campagna (1-5) in base al nome o ad altri criteri
 * In un'app reale, questo dovrebbe essere memorizzato nel database
 */
function determineCampaignType(campaign: any): 1 | 2 | 3 | 4 | 5 {
  const name = campaign.name.toLowerCase();

  // Euristica per determinare il tipo in base al nome
  if (name.includes('auto') || name.includes('automatic')) {
    return 5; // AD Automatica
  } else if (name.includes('super') && name.includes('keyword')) {
    return 3; // Keyword Super
  } else if (name.includes('super') && name.includes('product')) {
    return 4; // Product Super
  } else if (name.includes('product')) {
    return 2; // Product Targeting
  } else {
    return 1; // Keyword Targeting (default)
  }
}

// Esporta anche le funzioni individuali per uso diretto (opzionale)
export {
  executeFunc1,
  executeFunc2,
  executeFunc3,
  executeFunc4,
  executeFunc5
};
