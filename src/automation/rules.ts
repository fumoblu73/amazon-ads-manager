// ================================================
// REGOLE DI AUTOMAZIONE - ORCHESTRAZIONE
// ================================================
// Coordina l'esecuzione delle 5 funzioni di automazione
// per tutte le campagne, rispettando:
// - Periodo di warmup (7 giorni)
// - Frequenze di esecuzione
// - Ordine di esecuzione (Funz.1 → Funz.3)

import { amazonApiService } from '../services/amazonApi';
import { createUserAmazonApiService } from '../services/UserAmazonApiFactory';
import {
  createMarketplaceApiService,
  getConfiguredMarketplaces,
  isMarketplaceConfigured
} from '../services/MarketplaceApiFactory';
import { AppDataSource } from '../config/database';
import { Campaign } from '../models/Campaign';
import { isInWarmupPeriod } from '../utils/timeframe';
import { automationScheduler } from './scheduler';

// Import delle 5 funzioni
import { executeFunc1, shouldExecuteFunc1 } from './functions/func1';
import { executeFunc2, shouldExecuteFunc2 } from './functions/func2';
import { executeFunc3, shouldExecuteFunc3 } from './functions/func3';
import { executeFunc4, shouldExecuteFunc4 } from './functions/func4';
import { executeFunc5, shouldExecuteFunc5, CampaignMapping } from './functions/func5';

/**
 * FUNZIONE PRINCIPALE (MULTI-MARKETPLACE)
 * Esegue tutte le automazioni per tutte le campagne su tutti i marketplace configurati
 */
export async function runAutomationRules(): Promise<void> {
  console.log('🎯 Inizio esecuzione regole di automazione (MULTI-MARKETPLACE)\n');

  try {
    // ================================================
    // 1. RECUPERA MARKETPLACE CONFIGURATI
    // ================================================
    const configuredMarketplaces = getConfiguredMarketplaces();
    console.log(`🌍 Marketplace configurati: ${configuredMarketplaces.join(', ')}`);

    if (configuredMarketplaces.length === 0) {
      console.log('⚠️  Nessun marketplace configurato. Nulla da fare.');
      return;
    }

    const globalStats = {
      totalCampaignsProcessed: 0,
      totalCampaignsInWarmup: 0,
      func1Executed: 0,
      func2Executed: 0,
      func3Executed: 0,
      func4Executed: 0,
      func5Executed: 0,
      errors: 0,
      byMarketplace: {} as Record<string, { campaigns: number; functions: number }>
    };

    // ================================================
    // 2. PROCESSA OGNI MARKETPLACE
    // ================================================
    for (const marketplace of configuredMarketplaces) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🌍 MARKETPLACE: ${marketplace}`);
      console.log('='.repeat(60));

      try {
        // Crea API service per questo marketplace
        const apiService = createMarketplaceApiService(marketplace);

        // Recupera campagne per questo marketplace
        const campaigns = await apiService.getCampaigns();
        console.log(`📊 Trovate ${campaigns.length} campagne totali`);

        // Filtra solo campagne enabled
        const activeCampaigns = campaigns.filter((c: any) =>
          c.state === 'enabled' || c.state === 'ENABLED'
        );
        console.log(`✅ Campagne attive: ${activeCampaigns.length}`);

        globalStats.byMarketplace[marketplace] = { campaigns: activeCampaigns.length, functions: 0 };

        if (activeCampaigns.length === 0) {
          console.log(`⚠️  [${marketplace}] Nessuna campagna attiva. Skip.`);
          continue;
        }

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

        // Processa ogni campagna
        for (const campaign of activeCampaigns) {
          try {
            await processCampaignWithApiService(campaign, stats, apiService, marketplace);
          } catch (error) {
            stats.errors++;
            console.error(`❌ [${marketplace}] Errore campagna ${campaign.name}:`, error);
          }
        }

        // Accumula statistiche
        globalStats.totalCampaignsProcessed += stats.campaignsProcessed;
        globalStats.totalCampaignsInWarmup += stats.campaignsInWarmup;
        globalStats.func1Executed += stats.func1Executed;
        globalStats.func2Executed += stats.func2Executed;
        globalStats.func3Executed += stats.func3Executed;
        globalStats.func4Executed += stats.func4Executed;
        globalStats.func5Executed += stats.func5Executed;
        globalStats.errors += stats.errors;
        globalStats.byMarketplace[marketplace].functions =
          stats.func1Executed + stats.func2Executed + stats.func3Executed +
          stats.func4Executed + stats.func5Executed;

        console.log(`✅ [${marketplace}] Completato: ${stats.campaignsProcessed} campagne processate`);

      } catch (error: any) {
        globalStats.errors++;
        console.error(`❌ [${marketplace}] Errore marketplace: ${error.message}`);
      }

      // Delay tra marketplace per evitare rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // ================================================
    // 3. RIEPILOGO FINALE GLOBALE
    // ================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO ESECUZIONE AUTOMAZIONI (TUTTI I MARKETPLACE)');
    console.log('='.repeat(60));
    console.log(`Marketplace processati: ${configuredMarketplaces.length}`);
    console.log(`Campagne totali processate: ${globalStats.totalCampaignsProcessed}`);
    console.log(`Campagne in warmup (saltate): ${globalStats.totalCampaignsInWarmup}`);
    console.log(`\nPer marketplace:`);
    Object.entries(globalStats.byMarketplace).forEach(([mp, data]) => {
      console.log(`   - ${mp}: ${data.campaigns} campagne, ${data.functions} funzioni`);
    });
    console.log(`\nFunzioni eseguite totali:`);
    console.log(`  - Funzione 1 (Progressive Bidding): ${globalStats.func1Executed}`);
    console.log(`  - Funzione 2 (Placement Optimization): ${globalStats.func2Executed}`);
    console.log(`  - Funzione 3 (Targeting Optimization): ${globalStats.func3Executed}`);
    console.log(`  - Funzione 4 (Auto Ad Optimization): ${globalStats.func4Executed}`);
    console.log(`  - Funzione 5 (Campaign Feeding): ${globalStats.func5Executed}`);
    console.log(`\nErrori totali: ${globalStats.errors}`);
    console.log('='.repeat(60));

    console.log('\n🎯 Tutte le regole sono state eseguite su tutti i marketplace\n');

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
        await executeFunc1(campaignId, campaignType as any, campaignName, marketplace, amazonApiService, {
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
          amazonApiService,
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
          amazonApiService,
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
          amazonApiService,
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
          amazonApiService,
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
 * Processa una singola campagna con un apiService specifico (per multi-marketplace)
 * @param campaign - Campagna da processare
 * @param stats - Oggetto statistiche
 * @param apiService - Istanza AmazonApiService per il marketplace specifico
 * @param marketplace - Codice marketplace
 */
async function processCampaignWithApiService(
  campaign: any,
  stats: any,
  apiService: any,
  marketplace: string
): Promise<void> {
  stats.campaignsProcessed++;

  const campaignId = campaign.campaignId;
  const campaignName = campaign.name;
  const campaignType = determineCampaignType(campaign);
  const createdAt = new Date(campaign.startDate || campaign.creationDate || Date.now());

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📢 [${marketplace}] Campagna: ${campaignName}`);
  console.log(`   Tipo: ${campaignType} | ID: ${campaignId}`);
  console.log(`${'─'.repeat(50)}`);

  // Controllo periodo di warmup
  if (isInWarmupPeriod(createdAt)) {
    console.log(`⏳ [${marketplace}] Campagna in warmup (< 7 giorni). Skip.`);
    stats.campaignsInWarmup++;
    return;
  }

  // Configurazione mock (in produzione: recuperare da database)
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

  const mockPlacements = { topOfSearch: 0, restOfSearch: 10, productPages: 5 };
  const mockTotalImpressions = 50000;
  const mockAdGroupId = campaign.adGroupId || 'mock-adgroup-id';

  // FUNZIONE 1: Progressive Bidding Increase
  if (shouldExecuteFunc1(campaignType) && mockConfig.func1_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func1_${marketplace}_${campaignId}`,
      mockConfig.func1_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
        await executeFunc1(campaignId, campaignType as any, campaignName, marketplace, apiService, {
          bidIncrease: mockConfig.func1_bidIncrease,
          frequency: mockConfig.func1_frequency,
          maxImpressions: mockConfig.func1_impressions,
          maxClicks: mockConfig.func1_clicks
        });
        automationScheduler.markFunctionExecuted(`func1_${marketplace}_${campaignId}`);
        stats.func1Executed++;
      } catch (error: any) {
        console.error(`❌ [${marketplace}] Errore Func1: ${error.message}`);
      }
    }
  }

  // FUNZIONE 3: Targeting Optimization
  if (shouldExecuteFunc3(campaignType) && mockConfig.func3_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func3_${marketplace}_${campaignId}`,
      mockConfig.func3_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
        await executeFunc3(
          campaignId, campaignType as any, campaignName, marketplace,
          mockBook, mockTotalImpressions, apiService,
          {
            frequency: mockConfig.func3_frequency,
            timeframeA: mockConfig.func3_timeframeA,
            timeframeB: mockConfig.func3_timeframeB,
            timeframeC: mockConfig.func3_timeframeC,
            clicksPause: mockConfig.func3_clicksPause,
            clicks65days: mockConfig.func3_clicks65days
          }
        );
        automationScheduler.markFunctionExecuted(`func3_${marketplace}_${campaignId}`);
        stats.func3Executed++;
      } catch (error: any) {
        console.error(`❌ [${marketplace}] Errore Func3: ${error.message}`);
      }
    }
  }

  // FUNZIONE 2: Placement Optimization
  if (shouldExecuteFunc2(campaignType) && mockConfig.func2_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func2_${marketplace}_${campaignId}`,
      mockConfig.func2_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
        await executeFunc2(
          campaignId, campaignName, marketplace,
          mockBook, mockPlacements, apiService,
          {
            frequency: mockConfig.func2_frequency,
            placementTimeframeWeeks: mockConfig.func2_timeframeWeeks
          }
        );
        automationScheduler.markFunctionExecuted(`func2_${marketplace}_${campaignId}`);
        stats.func2Executed++;
      } catch (error: any) {
        console.error(`❌ [${marketplace}] Errore Func2: ${error.message}`);
      }
    }
  }

  // FUNZIONE 4: Auto Ad Optimization
  if (shouldExecuteFunc4(campaignType) && mockConfig.func4_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func4_${marketplace}_${campaignId}`,
      mockConfig.func4_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
        await executeFunc4(
          campaignId, campaignName, marketplace,
          mockAdGroupId, mockBook, mockTotalImpressions, apiService,
          {
            frequency: mockConfig.func4_frequency,
            timeframeA: mockConfig.func4_timeframeA,
            timeframeB: mockConfig.func4_timeframeB,
            timeframeC: mockConfig.func4_timeframeC,
            clicksNegative: mockConfig.func4_clicksNegative,
            spendNegative: mockConfig.func4_spendNegative
          }
        );
        automationScheduler.markFunctionExecuted(`func4_${marketplace}_${campaignId}`);
        stats.func4Executed++;
      } catch (error: any) {
        console.error(`❌ [${marketplace}] Errore Func4: ${error.message}`);
      }
    }
  }

  // FUNZIONE 5: Campaign Feeding
  if (shouldExecuteFunc5(campaignType) && mockConfig.func5_enabled) {
    const shouldRun = automationScheduler.shouldExecuteFunction(
      `func5_${marketplace}_${campaignId}`,
      mockConfig.func5_frequency,
      createdAt
    );

    if (shouldRun) {
      try {
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
          campaignId, campaignType as any, marketplace,
          mockCampaignMapping, apiService,
          {
            frequency: mockConfig.func5_frequency,
            minOrders: mockConfig.func5_minOrders,
            bidBroad: mockConfig.func5_bidBroad,
            bidExact: mockConfig.func5_bidExact,
            bidPhrase: mockConfig.func5_bidPhrase,
            bidExpanded: mockConfig.func5_bidExpanded
          }
        );
        automationScheduler.markFunctionExecuted(`func5_${marketplace}_${campaignId}`);
        stats.func5Executed++;
      } catch (error: any) {
        console.error(`❌ [${marketplace}] Errore Func5: ${error.message}`);
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

/**
 * PER-USER AUTOMATION EXECUTION (MULTI-MARKETPLACE)
 * Runs automation rules for a specific user across all configured marketplaces
 */
export async function runAutomationRulesForUser(userId: string): Promise<void> {
  console.log(`\n🤖 Running automations for user ${userId}...`);

  try {
    // Get configured marketplaces
    const configuredMarketplaces = getConfiguredMarketplaces();
    console.log(`🌍 Configured marketplaces: ${configuredMarketplaces.join(', ')}`);

    if (configuredMarketplaces.length === 0) {
      console.log('⚠️  No marketplaces configured. Nothing to do.');
      return;
    }

    // Get user's campaigns from database
    const campaignRepo = AppDataSource.getRepository(Campaign);
    const campaigns = await campaignRepo.find({
      where: { userId, state: 'enabled' }
    });

    console.log(`📊 Found ${campaigns.length} active campaigns for user ${userId}`);

    if (campaigns.length === 0) {
      console.log('⚠️  No active campaigns for this user. Nothing to do.');
      return;
    }

    const stats = {
      campaignsProcessed: 0,
      campaignsInWarmup: 0,
      campaignsSkippedNoMarketplace: 0,
      func1Executed: 0,
      func2Executed: 0,
      func3Executed: 0,
      func4Executed: 0,
      func5Executed: 0,
      errors: 0,
      byMarketplace: {} as Record<string, number>
    };

    // Group campaigns by marketplace
    const campaignsByMarketplace = new Map<string, typeof campaigns>();
    for (const campaign of campaigns) {
      const mp = (campaign.marketplace || 'US').toUpperCase();
      if (!campaignsByMarketplace.has(mp)) {
        campaignsByMarketplace.set(mp, []);
      }
      campaignsByMarketplace.get(mp)!.push(campaign);
    }

    console.log(`\n📊 Campaigns by marketplace:`);
    campaignsByMarketplace.forEach((camps, mp) => {
      console.log(`   - ${mp}: ${camps.length} campaigns`);
    });

    // Process each marketplace
    for (const marketplace of configuredMarketplaces) {
      const marketplaceCampaigns = campaignsByMarketplace.get(marketplace) || [];

      if (marketplaceCampaigns.length === 0) {
        console.log(`\n⏭️  [${marketplace}] No campaigns, skipping`);
        continue;
      }

      console.log(`\n${'─'.repeat(60)}`);
      console.log(`🌍 Processing marketplace: ${marketplace} (${marketplaceCampaigns.length} campaigns)`);
      console.log(`${'─'.repeat(60)}`);

      // Create API service for this marketplace
      let apiService;
      try {
        apiService = createMarketplaceApiService(marketplace);
      } catch (error: any) {
        console.error(`❌ [${marketplace}] Failed to create API service: ${error.message}`);
        stats.errors++;
        continue;
      }

      stats.byMarketplace[marketplace] = 0;

      // Process campaigns for this marketplace
      for (const campaign of marketplaceCampaigns) {
        try {
          stats.campaignsProcessed++;

          // Check warmup period (skip if too new)
          if (isInWarmupPeriod(campaign.createdAt)) {
            stats.campaignsInWarmup++;
            console.log(`⏳ [${marketplace}] Campaign ${campaign.name} in warmup. Skipping.`);
            continue;
          }

          console.log(`\n📦 [${marketplace}] Processing: ${campaign.name}`);

          // Determine campaign type
          const campaignType = determineCampaignType(campaign);
          console.log(`   Type: ${campaignType}`);

          // Execute functions based on campaign type
          // Func1: Progressive Bidding (campaigns 1-4)
          if (campaignType >= 1 && campaignType <= 4) {
            try {
              await executeFunc1(
                campaign.amazonCampaignId,
                campaignType as 1 | 2 | 3 | 4,
                campaign.name,
                marketplace,
                apiService
              );
              stats.func1Executed++;
              stats.byMarketplace[marketplace]++;
            } catch (error: any) {
              console.error(`   ❌ Func1 error: ${error.message}`);
              stats.errors++;
            }
          }

          // Func2, Func3, Func4, Func5 would follow similar pattern
          // with appropriate conditions based on campaignType

        } catch (error: any) {
          stats.errors++;
          console.error(`❌ [${marketplace}] Error processing ${campaign.name}: ${error.message}`);
        }
      }

      // Small delay between marketplaces to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`📊 AUTOMATION SUMMARY FOR USER ${userId}`);
    console.log('='.repeat(60));
    console.log(`Campaigns processed: ${stats.campaignsProcessed}`);
    console.log(`Campaigns in warmup (skipped): ${stats.campaignsInWarmup}`);
    console.log(`\nBy marketplace:`);
    Object.entries(stats.byMarketplace).forEach(([mp, count]) => {
      console.log(`   - ${mp}: ${count} functions executed`);
    });
    console.log(`\nFunctions executed:`);
    console.log(`  - Function 1 (Progressive Bidding): ${stats.func1Executed}`);
    console.log(`  - Function 2 (Placement Optimization): ${stats.func2Executed}`);
    console.log(`  - Function 3 (Targeting Optimization): ${stats.func3Executed}`);
    console.log(`  - Function 4 (Auto Ad Optimization): ${stats.func4Executed}`);
    console.log(`  - Function 5 (Campaign Feeding): ${stats.func5Executed}`);
    console.log(`\nErrors: ${stats.errors}`);
    console.log('='.repeat(60));

    console.log(`\n✅ Completed automations for user ${userId}\n`);

  } catch (error) {
    console.error(`❌ Fatal error running automations for user ${userId}:`, error);
    throw error;
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
