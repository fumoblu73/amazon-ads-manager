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

import { amazonApiService } from '../../services/amazonApi';
import { formatDateForAmazon } from '../../utils/timeframe';

export interface Func5Config {
  frequency: number;        // Default: 7 giorni
  minOrders: number;        // Default: 1 ordine minimo
  bidBroad: number;         // Default: 0.30
  bidExact: number;         // Default: 0.50
  bidPhrase: number;        // Default: 0.40
  bidExpanded: number;      // Default: 0.30
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
  destinationCampaigns: {
    campaign1?: number;
    campaign2?: number;
    campaign3?: number;
    campaign4?: number;
  };
  errors: string[];
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
  campaignMapping: CampaignMapping,
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
    bidExpanded: config?.bidExpanded || 0.30
  };

  const result: Func5Result = {
    sourceCampaignId,
    sourceCampaignType,
    searchTermsProcessed: 0,
    keywordsAdded: 0,
    targetsAdded: 0,
    destinationCampaigns: {},
    errors: []
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
    const reportId = await amazonApiService.requestSearchTermsReport(
      startDateStr,
      endDateStr,
      sourceCampaignId
    );

    const searchTermsData = await amazonApiService.waitAndDownloadReport(reportId);
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

        console.log(`\n   ${isAsin ? '📦' : '🔑'} "${term}" (${orders} ordini)`);

        // Esegue il feeding in base al tipo di campagna sorgente
        if (sourceCampaignType === 5) {
          // ============================================
          // CAMPAGNA 5 (Auto) → Altre
          // ============================================
          await feedFromCampaign5(term, isAsin, campaignMapping, cfg, result);

        } else if (sourceCampaignType === 1) {
          // ============================================
          // CAMPAGNA 1 (Keyword Broad) → Altre
          // ============================================
          if (!isAsin) {
            await feedFromCampaign1(term, campaignMapping, cfg, result);
          }

        } else if (sourceCampaignType === 3) {
          // ============================================
          // CAMPAGNA 3 (Keyword Super) → Altre
          // ============================================
          if (!isAsin) {
            await feedFromCampaign3(term, campaignMapping, cfg, result);
          }

        } else if (sourceCampaignType === 2) {
          // ============================================
          // CAMPAGNA 2 (Product Exact) → Altre
          // ============================================
          if (isAsin) {
            await feedFromCampaign2(term, campaignMapping, cfg, result);
          }

        } else if (sourceCampaignType === 4) {
          // ============================================
          // CAMPAGNA 4 (Product Super) → Altre
          // ============================================
          if (isAsin) {
            await feedFromCampaign4(term, campaignMapping, cfg, result);
          }
        }

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing search term "${searchTerm.searchTerm}": ${errMsg}`);
        console.error(`   ❌ Errore:`, error);
      }
    }

    console.log('────────────────────────────────────────');
    console.log(`✅ Funzione 5 completata`);
    console.log(`   Search terms processati: ${result.searchTermsProcessed}`);
    console.log(`   Keywords aggiunte: ${result.keywordsAdded}`);
    console.log(`   Targets aggiunti: ${result.targetsAdded}`);
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
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result
): Promise<void> {
  if (isAsin) {
    // ASIN → Camp.2 (Exact) + Camp.4 (Expanded)
    if (mapping.campaign2Id && mapping.campaign2AdGroupId) {
      await amazonApiService.addTargets(mapping.campaign2Id, mapping.campaign2AdGroupId, [{
        asin: term,
        bid: cfg.bidBroad,
        expressionType: 'manual'
      }]);
      result.targetsAdded++;
      result.destinationCampaigns.campaign2 = (result.destinationCampaigns.campaign2 || 0) + 1;
      console.log(`      ✅ → Campagna 2 (Exact)`);
    }

    if (mapping.campaign4Id && mapping.campaign4AdGroupId) {
      await amazonApiService.addTargets(mapping.campaign4Id, mapping.campaign4AdGroupId, [{
        asin: term,
        bid: cfg.bidExpanded,
        expressionType: 'manual'
      }]);
      result.targetsAdded++;
      result.destinationCampaigns.campaign4 = (result.destinationCampaigns.campaign4 || 0) + 1;
      console.log(`      ✅ → Campagna 4 (Expanded)`);
    }
  } else {
    // Keyword → Camp.1 (Broad) + Camp.3 (Exact+Phrase)
    if (mapping.campaign1Id && mapping.campaign1AdGroupId) {
      await amazonApiService.addKeywords(mapping.campaign1Id, mapping.campaign1AdGroupId, [{
        keywordText: term,
        matchType: 'broad',
        bid: cfg.bidBroad
      }]);
      result.keywordsAdded++;
      result.destinationCampaigns.campaign1 = (result.destinationCampaigns.campaign1 || 0) + 1;
      console.log(`      ✅ → Campagna 1 (Broad)`);
    }

    if (mapping.campaign3Id && mapping.campaign3AdGroupId) {
      await amazonApiService.addKeywords(mapping.campaign3Id, mapping.campaign3AdGroupId, [
        { keywordText: term, matchType: 'exact', bid: cfg.bidExact },
        { keywordText: term, matchType: 'phrase', bid: cfg.bidPhrase }
      ]);
      result.keywordsAdded += 2;
      result.destinationCampaigns.campaign3 = (result.destinationCampaigns.campaign3 || 0) + 2;
      console.log(`      ✅ → Campagna 3 (Exact + Phrase)`);
    }
  }
}

/**
 * Feed da Campagna 1 (Keyword Broad)
 * → Camp.1 (auto-feed) + Camp.3 (Exact+Phrase)
 */
async function feedFromCampaign1(
  term: string,
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result
): Promise<void> {
  // Auto-feed nella stessa campagna
  if (mapping.campaign1Id && mapping.campaign1AdGroupId) {
    await amazonApiService.addKeywords(mapping.campaign1Id, mapping.campaign1AdGroupId, [{
      keywordText: term,
      matchType: 'broad',
      bid: cfg.bidBroad
    }]);
    result.keywordsAdded++;
    result.destinationCampaigns.campaign1 = (result.destinationCampaigns.campaign1 || 0) + 1;
    console.log(`      ✅ → Campagna 1 (auto-feed)`);
  }

  // Feed a Campagna 3
  if (mapping.campaign3Id && mapping.campaign3AdGroupId) {
    await amazonApiService.addKeywords(mapping.campaign3Id, mapping.campaign3AdGroupId, [
      { keywordText: term, matchType: 'exact', bid: cfg.bidExact },
      { keywordText: term, matchType: 'phrase', bid: cfg.bidPhrase }
    ]);
    result.keywordsAdded += 2;
    result.destinationCampaigns.campaign3 = (result.destinationCampaigns.campaign3 || 0) + 2;
    console.log(`      ✅ → Campagna 3 (Exact + Phrase)`);
  }
}

/**
 * Feed da Campagna 3 (Keyword Super)
 * → Camp.1 (Broad) + Camp.3 (auto-feed)
 */
async function feedFromCampaign3(
  term: string,
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result
): Promise<void> {
  // Feed a Campagna 1
  if (mapping.campaign1Id && mapping.campaign1AdGroupId) {
    await amazonApiService.addKeywords(mapping.campaign1Id, mapping.campaign1AdGroupId, [{
      keywordText: term,
      matchType: 'broad',
      bid: cfg.bidBroad
    }]);
    result.keywordsAdded++;
    result.destinationCampaigns.campaign1 = (result.destinationCampaigns.campaign1 || 0) + 1;
    console.log(`      ✅ → Campagna 1 (Broad)`);
  }

  // Auto-feed nella stessa campagna
  if (mapping.campaign3Id && mapping.campaign3AdGroupId) {
    await amazonApiService.addKeywords(mapping.campaign3Id, mapping.campaign3AdGroupId, [
      { keywordText: term, matchType: 'exact', bid: cfg.bidExact },
      { keywordText: term, matchType: 'phrase', bid: cfg.bidPhrase }
    ]);
    result.keywordsAdded += 2;
    result.destinationCampaigns.campaign3 = (result.destinationCampaigns.campaign3 || 0) + 2;
    console.log(`      ✅ → Campagna 3 (auto-feed)`);
  }
}

/**
 * Feed da Campagna 2 (Product Exact)
 * → Camp.2 (auto-feed) + Camp.4 (Expanded)
 */
async function feedFromCampaign2(
  term: string,
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result
): Promise<void> {
  // Auto-feed nella stessa campagna
  if (mapping.campaign2Id && mapping.campaign2AdGroupId) {
    await amazonApiService.addTargets(mapping.campaign2Id, mapping.campaign2AdGroupId, [{
      asin: term,
      bid: cfg.bidBroad,
      expressionType: 'manual'
    }]);
    result.targetsAdded++;
    result.destinationCampaigns.campaign2 = (result.destinationCampaigns.campaign2 || 0) + 1;
    console.log(`      ✅ → Campagna 2 (auto-feed)`);
  }

  // Feed a Campagna 4
  if (mapping.campaign4Id && mapping.campaign4AdGroupId) {
    await amazonApiService.addTargets(mapping.campaign4Id, mapping.campaign4AdGroupId, [{
      asin: term,
      bid: cfg.bidExpanded,
      expressionType: 'manual'
    }]);
    result.targetsAdded++;
    result.destinationCampaigns.campaign4 = (result.destinationCampaigns.campaign4 || 0) + 1;
    console.log(`      ✅ → Campagna 4 (Expanded)`);
  }
}

/**
 * Feed da Campagna 4 (Product Super)
 * → Camp.2 (Exact) + Camp.4 (auto-feed)
 */
async function feedFromCampaign4(
  term: string,
  mapping: CampaignMapping,
  cfg: Func5Config,
  result: Func5Result
): Promise<void> {
  // Feed a Campagna 2
  if (mapping.campaign2Id && mapping.campaign2AdGroupId) {
    await amazonApiService.addTargets(mapping.campaign2Id, mapping.campaign2AdGroupId, [{
      asin: term,
      bid: cfg.bidBroad,
      expressionType: 'manual'
    }]);
    result.targetsAdded++;
    result.destinationCampaigns.campaign2 = (result.destinationCampaigns.campaign2 || 0) + 1;
    console.log(`      ✅ → Campagna 2 (Exact)`);
  }

  // Auto-feed nella stessa campagna
  if (mapping.campaign4Id && mapping.campaign4AdGroupId) {
    await amazonApiService.addTargets(mapping.campaign4Id, mapping.campaign4AdGroupId, [{
      asin: term,
      bid: cfg.bidExpanded,
      expressionType: 'manual'
    }]);
    result.targetsAdded++;
    result.destinationCampaigns.campaign4 = (result.destinationCampaigns.campaign4 || 0) + 1;
    console.log(`      ✅ → Campagna 4 (auto-feed)`);
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
