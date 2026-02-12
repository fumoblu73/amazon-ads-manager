// ================================================
// FUNZIONE 5: CAMPAIGN FEEDING
// ================================================
// Alimenta automaticamente le campagne con search terms performanti:
// - Da Campagna 5 (Auto) → Campagne 1, 2, 3, 4
// - Auto-alimentazione: le campagne aggiungono i propri search terms
//
// Si applica a: Campagne 1, 2, 3, 4, 5 (TUTTE)
//
// Frequenza: Ogni 7 giorni (indipendente)

import { UserAmazonApiService } from '../../services/UserAmazonApiService';
import { formatDateForAmazon } from '../../utils/timeframe';

export interface Func5Config {
  frequency: number;        // Default: 7 giorni
  minOrders: number;        // Default: 1 ordine minimo
  bidBroad: number;         // Default: 0.30
  bidExact: number;         // Default: 0.50
  bidPhrase: number;        // Default: 0.40
  bidExpanded: number;      // Default: 0.30
  dryRun?: boolean;         // Se true, non aggiunge keyword/target (solo analisi)
}

export interface CampaignMapping {
  campaign1Id?: string;  // Keyword Targeting (Broad)
  campaign1AdGroupId?: string;
  campaign2Id?: string;  // Product Targeting (Exact)
  campaign2AdGroupId?: string;
  campaign3Id?: string;  // Keyword Super (Exact + Phrase)
  campaign3AdGroupId?: string;
  campaign4Id?: string;  // Product Super (Expanded)
  campaign4AdGroupId?: string;
  campaign5Id?: string;  // AD Automatica
  campaign5AdGroupId?: string;
}

export interface Func5Result {
  sourceCampaignId: string;
  sourceCampaignType: number;
  searchTermsProcessed: number;
  keywordsAdded: number;
  targetsAdded: number;
  dryRun: boolean;
  destinationCampaigns: {
    campaign1?: number;
    campaign2?: number;
    campaign3?: number;
    campaign4?: number;
  };
  errors: string[];
  details?: Array<{
    searchTerm: string;
    isAsin: boolean;
    orders: number;
    destinations: string[];
  }>;
}

/**
 * Esegue la Funzione 5: Campaign Feeding
 *
 * Workflow in base alla campagna sorgente:
 *
 * CAMPAGNA 5 (Auto) → Altre:
 *   - SE keyword → Camp.1 (Broad) + Camp.3 (Exact+Phrase)
 *   - SE ASIN → Camp.2 (Exact) + Camp.4 (Expanded)
 *
 * CAMPAGNA 1 (Keyword Broad) → Altre:
 *   - Keyword → Camp.1 (auto-feed) + Camp.3 (Exact+Phrase)
 *
 * CAMPAGNA 3 (Keyword Super) → Altre:
 *   - Keyword → Camp.1 (Broad) + Camp.3 (auto-feed)
 *
 * CAMPAGNA 2 (Product Exact) → Altre:
 *   - ASIN → Camp.2 (auto-feed) + Camp.4 (Expanded)
 *
 * CAMPAGNA 4 (Product Super) → Altre:
 *   - ASIN → Camp.2 (Exact) + Camp.4 (auto-feed)
 *
 * @param sourceCampaignId - ID della campagna sorgente
 * @param sourceCampaignType - Tipo campagna sorgente (1-5)
 * @param campaignMapping - Mapping di tutte le campagne del libro
 * @param config - Configurazione parametri (opzionale)
 * @returns Risultato con statistiche esecuzione
 */
export async function executeFunc5(
  sourceCampaignId: string,
  sourceCampaignType: 1 | 2 | 3 | 4 | 5,
  marketplace: string,
  campaignMapping: CampaignMapping,
  apiService: any,  // Support both UserAmazonApiService and AmazonApiService
  config?: Partial<Func5Config>
): Promise<Func5Result> {
  console.log('\n════════════════════════════════════════');
  console.log('🔄 FUNZIONE 5: Campaign Feeding');
  console.log(`   Campagna sorgente: Tipo ${sourceCampaignType}`);
  console.log('════════════════════════════════════════');

  // Configurazione default
  const cfg: Func5Config = {
    frequency: config?.frequency || 7,
    minOrders: config?.minOrders || 1,
    bidBroad: config?.bidBroad || 0.30,
    bidExact: config?.bidExact || 0.50,
    bidPhrase: config?.bidPhrase || 0.40,
    bidExpanded: config?.bidExpanded || 0.30,
    dryRun: config?.dryRun || false
  };

  if (cfg.dryRun) {
    console.log('🔍 MODALITA\' DRY RUN - Nessuna keyword/target verra\' aggiunta');
  }

  const result: Func5Result = {
    sourceCampaignId,
    sourceCampaignType,
    searchTermsProcessed: 0,
    keywordsAdded: 0,
    targetsAdded: 0,
    dryRun: cfg.dryRun!,
    destinationCampaigns: {},
    errors: [],
    details: []
  };

  try {
    // 1. Calcola date (ultimi 7 giorni o frequency)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - cfg.frequency);

    const startDateStr = formatDateForAmazon(startDate);
    const endDateStr = formatDateForAmazon(endDate);

    console.log(`📅 Periodo analisi: ${startDateStr} - ${endDateStr}`);

    // 2. Richiedi report search terms per la campagna sorgente
    const reportId = await apiService.requestSearchTermsReport(startDateStr, endDateStr, sourceCampaignId);

    const searchTermsData = await apiService.waitAndDownloadReport(reportId);
    console.log(`📊 Trovati ${searchTermsData.length} search terms`);

    // 3. Filtra solo search terms con almeno 1 ordine
    const performingSearchTerms = searchTermsData.filter((st: any) => (st.orders || 0) >= cfg.minOrders);
    console.log(`✅ Search terms con >= ${cfg.minOrders} ordini: ${performingSearchTerms.length}`);

    // 4. Processa ogni search term
    for (const searchTerm of performingSearchTerms) {
      result.searchTermsProcessed++;

      try {
        const term = searchTerm.searchTerm;
        const orders = searchTerm.orders || 0;

        // Determina se è una keyword o un ASIN
        const isAsin = /^B[0-9A-Z]{9}$/.test(term);

        console.log(`\n   ${isAsin ? '📦' : '🔑'} ${cfg.dryRun ? '[DRY RUN] ' : ''}"${term}" (${orders} ordini)`);

        const destinations: string[] = [];

        // Esegue il feeding in base al tipo di campagna sorgente
        if (sourceCampaignType === 5) {
          await feedFromCampaign5(term, isAsin, marketplace, campaignMapping, cfg, result, apiService, cfg.dryRun!, destinations);
        } else if (sourceCampaignType === 1) {
          if (!isAsin) {
            await feedFromCampaign1(term, marketplace, campaignMapping, cfg, result, apiService, cfg.dryRun!, destinations);
          }
        } else if (sourceCampaignType === 3) {
          if (!isAsin) {
            await feedFromCampaign3(term, marketplace, campaignMapping, cfg, result, apiService, cfg.dryRun!, destinations);
          }
        } else if (sourceCampaignType === 2) {
          if (isAsin) {
            await feedFromCampaign2(term, marketplace, campaignMapping, cfg, result, apiService, cfg.dryRun!, destinations);
          }
        } else if (sourceCampaignType === 4) {
          if (isAsin) {
            await feedFromCampaign4(term, marketplace, campaignMapping, cfg, result, apiService, cfg.dryRun!, destinations);
          }
        }

        result.details!.push({ searchTerm: term, isAsin, orders, destinations });

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing search term "${searchTerm.searchTerm}": ${errMsg}`);
        console.error(`   ❌ Errore:`, error);
      }
    }

    console.log('────────────────────────────────────────');
    console.log(`✅ Funzione 5 completata${cfg.dryRun ? ' (DRY RUN)' : ''}`);
    console.log(`   Search terms processati: ${result.searchTermsProcessed}`);
    console.log(`   Keywords ${cfg.dryRun ? 'da aggiungere' : 'aggiunte'}: ${result.keywordsAdded}`);
    console.log(`   Targets ${cfg.dryRun ? 'da aggiungere' : 'aggiunti'}: ${result.targetsAdded}`);
    console.log(`   Distribuzioni:`);
    if (result.destinationCampaigns.campaign1) console.log(`      → Campagna 1: ${result.destinationCampaigns.campaign1}`);
    if (result.destinationCampaigns.campaign2) console.log(`      → Campagna 2: ${result.destinationCampaigns.campaign2}`);
    if (result.destinationCampaigns.campaign3) console.log(`      → Campagna 3: ${result.destinationCampaigns.campaign3}`);
    if (result.destinationCampaigns.campaign4) console.log(`      → Campagna 4: ${result.destinationCampaigns.campaign4}`);
    console.log(`   Errori: ${result.errors.length}`);
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Fatal error: ${errMsg}`);
    console.error('❌ Errore fatale Funzione 5:', error);
  }

  return result;
}

// ================================================
// FUNZIONI HELPER PER FEEDING
// ================================================

/**
 * Feed da Campagna 5 (Auto)
 * - SE keyword → Camp.1 (Broad) + Camp.3 (Exact+Phrase)
 * - SE ASIN → Camp.2 (Exact) + Camp.4 (Expanded)
 */
async function feedFromCampaign5(
  term: string,
  isAsin: boolean,
  marketplace: string,
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result,
  apiService: any,
  dryRun: boolean,
  destinations: string[]
): Promise<void> {
  if (isAsin) {
    if (mapping.campaign2Id && mapping.campaign2AdGroupId) {
      if (!dryRun) {
        await apiService.addTargets(mapping.campaign2Id, mapping.campaign2AdGroupId, [{
          asin: term, bid: cfg.bidBroad, expressionType: 'manual'
        }]);
      }
      result.targetsAdded++;
      result.destinationCampaigns.campaign2 = (result.destinationCampaigns.campaign2 || 0) + 1;
      destinations.push('Campaign 2 (Exact)');
      console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 2 (Exact)`);
    }
    if (mapping.campaign4Id && mapping.campaign4AdGroupId) {
      if (!dryRun) {
        await apiService.addTargets(mapping.campaign4Id, mapping.campaign4AdGroupId, [{
          asin: term, bid: cfg.bidExpanded, expressionType: 'manual'
        }]);
      }
      result.targetsAdded++;
      result.destinationCampaigns.campaign4 = (result.destinationCampaigns.campaign4 || 0) + 1;
      destinations.push('Campaign 4 (Expanded)');
      console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 4 (Expanded)`);
    }
  } else {
    if (mapping.campaign1Id && mapping.campaign1AdGroupId) {
      if (!dryRun) {
        await apiService.addKeywords(mapping.campaign1Id, mapping.campaign1AdGroupId, [{
          keywordText: term, matchType: 'broad', bid: cfg.bidBroad
        }]);
      }
      result.keywordsAdded++;
      result.destinationCampaigns.campaign1 = (result.destinationCampaigns.campaign1 || 0) + 1;
      destinations.push('Campaign 1 (Broad)');
      console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 1 (Broad)`);
    }
    if (mapping.campaign3Id && mapping.campaign3AdGroupId) {
      if (!dryRun) {
        await apiService.addKeywords(mapping.campaign3Id, mapping.campaign3AdGroupId, [
          { keywordText: term, matchType: 'exact', bid: cfg.bidExact },
          { keywordText: term, matchType: 'phrase', bid: cfg.bidPhrase }
        ]);
      }
      result.keywordsAdded += 2;
      result.destinationCampaigns.campaign3 = (result.destinationCampaigns.campaign3 || 0) + 2;
      destinations.push('Campaign 3 (Exact + Phrase)');
      console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 3 (Exact + Phrase)`);
    }
  }
}

/**
 * Feed da Campagna 1 (Keyword Broad)
 * → Camp.1 (auto-feed) + Camp.3 (Exact+Phrase)
 */
async function feedFromCampaign1(
  term: string,
  marketplace: string,
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result,
  apiService: any,
  dryRun: boolean,
  destinations: string[]
): Promise<void> {
  if (mapping.campaign1Id && mapping.campaign1AdGroupId) {
    if (!dryRun) {
      await apiService.addKeywords(mapping.campaign1Id, mapping.campaign1AdGroupId, [{
        keywordText: term, matchType: 'broad', bid: cfg.bidBroad
      }]);
    }
    result.keywordsAdded++;
    result.destinationCampaigns.campaign1 = (result.destinationCampaigns.campaign1 || 0) + 1;
    destinations.push('Campaign 1 (auto-feed)');
    console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 1 (auto-feed)`);
  }
  if (mapping.campaign3Id && mapping.campaign3AdGroupId) {
    if (!dryRun) {
      await apiService.addKeywords(mapping.campaign3Id, mapping.campaign3AdGroupId, [
        { keywordText: term, matchType: 'exact', bid: cfg.bidExact },
        { keywordText: term, matchType: 'phrase', bid: cfg.bidPhrase }
      ]);
    }
    result.keywordsAdded += 2;
    result.destinationCampaigns.campaign3 = (result.destinationCampaigns.campaign3 || 0) + 2;
    destinations.push('Campaign 3 (Exact + Phrase)');
    console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 3 (Exact + Phrase)`);
  }
}

/**
 * Feed da Campagna 3 (Keyword Super)
 * → Camp.1 (Broad) + Camp.3 (auto-feed)
 */
async function feedFromCampaign3(
  term: string,
  marketplace: string,
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result,
  apiService: any,
  dryRun: boolean,
  destinations: string[]
): Promise<void> {
  if (mapping.campaign1Id && mapping.campaign1AdGroupId) {
    if (!dryRun) {
      await apiService.addKeywords(mapping.campaign1Id, mapping.campaign1AdGroupId, [{
        keywordText: term, matchType: 'broad', bid: cfg.bidBroad
      }]);
    }
    result.keywordsAdded++;
    result.destinationCampaigns.campaign1 = (result.destinationCampaigns.campaign1 || 0) + 1;
    destinations.push('Campaign 1 (Broad)');
    console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 1 (Broad)`);
  }
  if (mapping.campaign3Id && mapping.campaign3AdGroupId) {
    if (!dryRun) {
      await apiService.addKeywords(mapping.campaign3Id, mapping.campaign3AdGroupId, [
        { keywordText: term, matchType: 'exact', bid: cfg.bidExact },
        { keywordText: term, matchType: 'phrase', bid: cfg.bidPhrase }
      ]);
    }
    result.keywordsAdded += 2;
    result.destinationCampaigns.campaign3 = (result.destinationCampaigns.campaign3 || 0) + 2;
    destinations.push('Campaign 3 (auto-feed)');
    console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 3 (auto-feed)`);
  }
}

/**
 * Feed da Campagna 2 (Product Exact)
 * → Camp.2 (auto-feed) + Camp.4 (Expanded)
 */
async function feedFromCampaign2(
  term: string,
  marketplace: string,
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result,
  apiService: any,
  dryRun: boolean,
  destinations: string[]
): Promise<void> {
  if (mapping.campaign2Id && mapping.campaign2AdGroupId) {
    if (!dryRun) {
      await apiService.addTargets(mapping.campaign2Id, mapping.campaign2AdGroupId, [{
        asin: term, bid: cfg.bidBroad, expressionType: 'manual'
      }]);
    }
    result.targetsAdded++;
    result.destinationCampaigns.campaign2 = (result.destinationCampaigns.campaign2 || 0) + 1;
    destinations.push('Campaign 2 (auto-feed)');
    console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 2 (auto-feed)`);
  }
  if (mapping.campaign4Id && mapping.campaign4AdGroupId) {
    if (!dryRun) {
      await apiService.addTargets(mapping.campaign4Id, mapping.campaign4AdGroupId, [{
        asin: term, bid: cfg.bidExpanded, expressionType: 'manual'
      }]);
    }
    result.targetsAdded++;
    result.destinationCampaigns.campaign4 = (result.destinationCampaigns.campaign4 || 0) + 1;
    destinations.push('Campaign 4 (Expanded)');
    console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 4 (Expanded)`);
  }
}

/**
 * Feed da Campagna 4 (Product Super)
 * → Camp.2 (Exact) + Camp.4 (auto-feed)
 */
async function feedFromCampaign4(
  term: string,
  marketplace: string,
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result,
  apiService: any,
  dryRun: boolean,
  destinations: string[]
): Promise<void> {
  if (mapping.campaign2Id && mapping.campaign2AdGroupId) {
    if (!dryRun) {
      await apiService.addTargets(mapping.campaign2Id, mapping.campaign2AdGroupId, [{
        asin: term, bid: cfg.bidBroad, expressionType: 'manual'
      }]);
    }
    result.targetsAdded++;
    result.destinationCampaigns.campaign2 = (result.destinationCampaigns.campaign2 || 0) + 1;
    destinations.push('Campaign 2 (Exact)');
    console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 2 (Exact)`);
  }
  if (mapping.campaign4Id && mapping.campaign4AdGroupId) {
    if (!dryRun) {
      await apiService.addTargets(mapping.campaign4Id, mapping.campaign4AdGroupId, [{
        asin: term, bid: cfg.bidExpanded, expressionType: 'manual'
      }]);
    }
    result.targetsAdded++;
    result.destinationCampaigns.campaign4 = (result.destinationCampaigns.campaign4 || 0) + 1;
    destinations.push('Campaign 4 (auto-feed)');
    console.log(`      ✅ ${dryRun ? '[DRY RUN] ' : ''}→ Campagna 4 (auto-feed)`);
  }
}

/**
 * Verifica se la Funzione 5 deve essere eseguita per una campagna
 *
 * @param campaignType - Tipo campagna (1-5)
 * @returns true se la funzione si applica
 */
export function shouldExecuteFunc5(campaignType: number): boolean {
  // Si applica a TUTTE le campagne (1-5)
  return campaignType >= 1 && campaignType <= 5;
}
