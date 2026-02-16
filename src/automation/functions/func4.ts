// ================================================
// FUNZIONE 4: AUTO AD OPTIMIZATION
// ================================================
// Ottimizza le campagne automatiche (Campagna 5):
// 1. Ottimizza bid dei targeting groups (complements, loose, close, substitutes)
// 2. Aggiunge negative keywords/products per search terms con performance pessime
//
// Si applica a: SOLO Campagna 5 (AD Automatica)
//
// Frequenza: Ogni 7 giorni (indipendente)

import { UserAmazonApiService } from '../../services/UserAmazonApiService';
import { calculateFastAcos, determineFastAcosBand, calculateNewBid, calculateAcos } from '../../utils/fastAcos';
import { calculateTimeframeFunc4, formatDateForAmazon } from '../../utils/timeframe';

export interface Func4Config {
  frequency: number;          // Default: 7 giorni
  timeframeA: number;         // Default: 1000 impressions (più bassa di Func3)
  timeframeB: number;         // Default: 3000 impressions
  timeframeC: number;         // Default: 5000 impressions
  clicksNegative: number;     // Default: 10 clicks
  spendNegative: number;      // Default: 10 (valuta locale)
  dryRun?: boolean;           // Se true, non modifica bid/stato/negative (solo analisi)
  skipPart1?: boolean;         // Se true, salta Parte 1 (targeting groups) - solo per test
}

export interface Book {
  price: number;
  printingCost: number;
  royaltyPercentage?: number;
}

export interface Func4Result {
  campaignId: string;
  campaignName: string;
  targetingGroupsProcessed: number;
  targetingGroupsPaused: number;
  targetingGroupsBidUpdated: number;
  negativeKeywordsAdded: number;
  negativeTargetsAdded: number;
  timeframeDays: number;
  dryRun: boolean;
  errors: string[];
  details?: {
    targetingGroups: Array<{
      targetId: string;
      groupName: string;
      clicks: number;
      orders: number;
      action: 'paused' | 'bid_updated' | 'skipped' | 'no_data';
      currentBid?: number;
      newBid?: number;
      band?: number;
    }>;
    negatives: Array<{
      term: string;
      type: 'keyword' | 'asin';
      clicks: number;
      cost: number;
    }>;
  };
}

/**
 * Esegue la Funzione 4: Auto Ad Optimization
 *
 * Logica:
 * 1. OTTIMIZZAZIONE TARGETING GROUPS:
 *    - Per ogni targeting group (complements, loose, close, substitutes)
 *    - SE clicks > 10 E orders = 0: PAUSA
 *    - ALTRIMENTI: ottimizza bid in base a fascia FAST ACoS
 *
 * 2. NEGATIVE TARGETING (Search Terms):
 *    - Per ogni search term
 *    - SE clicks >= 10 E orders = 0 OPPURE spend >= 10 E orders = 0:
 *      → SE keyword: aggiungi a negative keywords
 *      → SE ASIN: aggiungi a negative products
 *
 * @param campaignId - ID della campagna Amazon
 * @param campaignName - Nome della campagna
 * @param adGroupId - ID dell'ad group
 * @param book - Dati del libro per calcolare FAST ACoS
 * @param totalImpressions30Days - Impressions totali ultimi 30 giorni
 * @param config - Configurazione parametri (opzionale)
 * @returns Risultato con statistiche esecuzione
 */
export async function executeFunc4(
  campaignId: string,
  campaignName: string,
  marketplace: string,
  adGroupId: string,
  book: Book,
  totalImpressions30Days: number,
  apiService: any,  // Support both UserAmazonApiService and AmazonApiService
  config?: Partial<Func4Config>
): Promise<Func4Result> {
  console.log('\n════════════════════════════════════════');
  console.log('🤖 FUNZIONE 4: Auto Ad Optimization');
  console.log(`   Campagna: ${campaignName} (AD Automatica)`);
  console.log('════════════════════════════════════════');

  // Configurazione default
  const cfg: Func4Config = {
    frequency: config?.frequency || 7,
    timeframeA: config?.timeframeA || 1000,
    timeframeB: config?.timeframeB || 3000,
    timeframeC: config?.timeframeC || 5000,
    clicksNegative: config?.clicksNegative || 10,
    spendNegative: config?.spendNegative || 10,
    dryRun: config?.dryRun || false,
    skipPart1: config?.skipPart1 || false
  };

  if (cfg.dryRun) {
    console.log('🔍 MODALITA\' DRY RUN - Nessuna modifica verra\' applicata');
  }

  const result: Func4Result = {
    campaignId,
    campaignName,
    targetingGroupsProcessed: 0,
    targetingGroupsPaused: 0,
    targetingGroupsBidUpdated: 0,
    negativeKeywordsAdded: 0,
    negativeTargetsAdded: 0,
    timeframeDays: 0,
    dryRun: cfg.dryRun!,
    errors: [],
    details: { targetingGroups: [], negatives: [] }
  };

  try {
    // 1. Calcola FAST ACoS
    const fastAcosResult = calculateFastAcos(book);
    console.log(`📊 FAST ACoS: ${fastAcosResult.fastAcos.toFixed(2)}%`);

    // 2. Determina timeframe dinamico
    const timeframeResult = calculateTimeframeFunc4(totalImpressions30Days, cfg);
    result.timeframeDays = timeframeResult.timeframeDays;
    console.log(`⏱️  ${timeframeResult.reason}`);
    console.log(`📅 Timeframe: ${timeframeResult.timeframeDays} giorni`);

    // 3. Calcola date
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframeResult.timeframeDays);

    const startDateStr = formatDateForAmazon(startDate);
    const endDateStr = formatDateForAmazon(endDate);

    console.log(`📅 Periodo analisi: ${startDateStr} - ${endDateStr}`);

    // ================================================
    // PARTE 1: OTTIMIZZAZIONE TARGETING GROUPS
    // ================================================
    if (cfg.skipPart1) {
      console.log('\n⏭️  PARTE 1: Skippata (skipPart1=true)');
    } else {
    console.log('\n📊 PARTE 1: Ottimizzazione Targeting Groups');

    // 4. Recupera targeting groups
    const targetingGroups = await apiService.getAutoTargetingGroups(campaignId);
    console.log(`   Trovati ${targetingGroups.length} targeting groups`);

    // 5. Richiedi report per targeting groups
    // API v3: targetId/bid/orders/sales sono invalidi, usiamo colonne v3 valide
    // Il report spTargeting con groupBy targeting restituisce targeting (stringa), non targetId
    const reportIdGroups = await apiService.requestReport(startDateStr, [
      'impressions',
      'clicks',
      'cost',
      'sales14d',
      'purchases14d'
    ]);

    const reportDataGroupsAll = await apiService.waitAndDownloadReport(reportIdGroups);
    console.log(`   Report targeting (totale): ${reportDataGroupsAll.length} righe`);

    // Filtra per campaignId (il report contiene TUTTE le campagne)
    const reportDataGroups = reportDataGroupsAll.filter((r: any) => String(r.campaignId) === String(campaignId));
    console.log(`   Report targeting (campagna ${campaignId}): ${reportDataGroups.length} righe`);

    // Debug: mostra i targeting trovati per questa campagna
    if (reportDataGroups.length > 0) {
      console.log(`   Sample targeting values: ${reportDataGroups.slice(0, 10).map((r: any) => r.targeting).join(', ')}`);
    }

    // Debug: mostra i nomi dei targeting groups dall'API
    console.log(`   Targeting group names: ${targetingGroups.map((g: any) => g.expression?.[0]?.type || g.targetId).join(', ')}`);

    // Mapping tra nomi API (expression type) e nomi nel report spTargeting
    const autoTargetingMap: Record<string, string[]> = {
      'QUERY_HIGH_REL_MATCHES': ['close-match', 'close_match', 'queryHighRelMatches'],
      'QUERY_BROAD_REL_MATCHES': ['loose-match', 'loose_match', 'queryBroadRelMatches'],
      'ASIN_SUBSTITUTE_RELATED': ['substitutes', 'asinSubstituteRelated'],
      'ASIN_ACCESSORY_RELATED': ['complements', 'asinAccessoryRelated'],
    };

    // Per auto campaigns, aggreghiamo le metriche per tipo di targeting
    // Il report ha righe individuali (keyword/ASIN), non per gruppo
    // Quindi sommiamo tutte le righe del report per questa campagna
    const aggregatedByGroup: Record<string, { clicks: number; orders: number; cost: number; sales: number; impressions: number }> = {};

    for (const row of reportDataGroups) {
      const targeting = (row.targeting || '').toLowerCase();
      // Determina a quale gruppo appartiene questa riga
      let matchedGroup = 'unknown';
      for (const [apiName, reportNames] of Object.entries(autoTargetingMap)) {
        if (reportNames.some(name => targeting === name || targeting.includes(name))) {
          matchedGroup = apiName;
          break;
        }
      }
      // Se non matcha nessun gruppo auto, potrebbe essere un keyword/ASIN specifico
      // Per auto campaigns, ogni search term/ASIN viene associato a un gruppo
      // ma il report non indica esplicitamente il gruppo
      if (!aggregatedByGroup[matchedGroup]) {
        aggregatedByGroup[matchedGroup] = { clicks: 0, orders: 0, cost: 0, sales: 0, impressions: 0 };
      }
      aggregatedByGroup[matchedGroup].clicks += (row.clicks || 0);
      aggregatedByGroup[matchedGroup].orders += (row.purchases14d || row.orders || 0);
      aggregatedByGroup[matchedGroup].cost += (row.cost || 0);
      aggregatedByGroup[matchedGroup].sales += (row.sales14d || row.sales || 0);
      aggregatedByGroup[matchedGroup].impressions += (row.impressions || 0);
    }

    console.log(`   Aggregated groups: ${JSON.stringify(aggregatedByGroup)}`);

    // 6. Processa ogni targeting group
    for (const group of targetingGroups) {
      result.targetingGroupsProcessed++;

      try {
        const targetId = group.targetId;
        const groupName = group.expression?.[0]?.type || targetId;
        const currentBid = group.bid;

        // Cerca nelle metriche aggregate o nella mappatura diretta
        const metrics = aggregatedByGroup[groupName];

        if (!metrics || metrics.impressions === 0) {
          console.log(`   ⏭️  Nessun dato per ${groupName} (targetId: ${targetId})`);
          result.details!.targetingGroups.push({ targetId, groupName, clicks: 0, orders: 0, action: 'no_data', currentBid });
          continue;
        }

        const clicks = metrics.clicks;
        const orders = metrics.orders;
        const cost = metrics.cost;
        const sales = metrics.sales;

        // a) CONTROLLO PAUSA
        if (clicks > cfg.clicksNegative && orders === 0) {
          console.log(`   ⏸️  ${cfg.dryRun ? '[DRY RUN] ' : ''}PAUSA ${groupName}: clicks=${clicks}, orders=0`);
          if (!cfg.dryRun) {
            await apiService.updateTargetState(targetId, 'paused');
          }
          result.targetingGroupsPaused++;
          result.details!.targetingGroups.push({ targetId, groupName, clicks, orders, action: 'paused', currentBid });
          continue;
        }

        // b) OTTIMIZZAZIONE BID
        if (orders > 0 && sales > 0) {
          const acos = calculateAcos(cost, sales);
          const band = determineFastAcosBand(acos, fastAcosResult.fastAcos);
          const newBid = calculateNewBid(currentBid, band.bidAdjustment);

          if (newBid !== currentBid) {
            console.log(`   ${band.bidAdjustment > 0 ? '🔼' : '🔽'} ${cfg.dryRun ? '[DRY RUN] ' : ''}${groupName}:`);
            console.log(`      ACoS: ${acos.toFixed(2)}% (Fascia ${band.band})`);
            console.log(`      Bid: ${currentBid.toFixed(2)} → ${newBid.toFixed(2)}`);

            if (!cfg.dryRun) {
              await apiService.updateTargetBid(targetId, newBid);
            }
            result.targetingGroupsBidUpdated++;
            result.details!.targetingGroups.push({ targetId, groupName, clicks, orders, action: 'bid_updated', currentBid, newBid, band: band.band });
          } else {
            result.details!.targetingGroups.push({ targetId, groupName, clicks, orders, action: 'skipped', currentBid });
          }
        } else {
          result.details!.targetingGroups.push({ targetId, groupName, clicks, orders, action: 'skipped', currentBid });
        }

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing targeting group: ${errMsg}`);
        console.error(`   ❌ Errore:`, error);
      }
    }

    } // end if !skipPart1

    // ================================================
    // PARTE 2: NEGATIVE TARGETING (Search Terms)
    // ================================================
    console.log('\n📊 PARTE 2: Negative Targeting (Search Terms)');

    // 7. Richiedi report search terms
    const reportIdSearchTerms = await apiService.requestSearchTermsReport(startDateStr, endDateStr, campaignId);

    const searchTermsData = await apiService.waitAndDownloadReport(reportIdSearchTerms);
    console.log(`   Trovati ${searchTermsData.length} search terms`);

    // 8. Processa ogni search term (con deduplicazione)
    const processedTerms = new Set<string>();

    for (const searchTerm of searchTermsData) {
      try {
        const term = searchTerm.searchTerm;

        // Skip termini già processati (il report può avere duplicati da targeting groups diversi)
        if (processedTerms.has(term)) continue;
        processedTerms.add(term);

        const clicks = searchTerm.clicks || 0;
        const orders = searchTerm.purchases14d || searchTerm.orders || 0;
        const cost = searchTerm.cost || 0;

        // Controlla condizioni per negative targeting
        const shouldAddNegative =
          (clicks >= cfg.clicksNegative && orders === 0) ||
          (cost >= cfg.spendNegative && orders === 0);

        if (shouldAddNegative) {
          // Determina se è un prodotto (ASIN o ISBN-10) o una keyword
          const isAsin = /^B[0-9A-Z]{9}$/i.test(term); // Formato ASIN Amazon
          const isIsbn10 = /^[0-9]{9}[0-9Xx]$/.test(term); // Formato ISBN-10
          const isProduct = isAsin || isIsbn10;

          if (isProduct) {
            // Aggiungi a negative products (ASIN/ISBN come target)
            const productId = isAsin ? term.toUpperCase() : term;
            console.log(`   ➖ ${cfg.dryRun ? '[DRY RUN] ' : ''}Negative Product: ${productId} (clicks=${clicks}, cost=${cost.toFixed(2)})`);
            if (!cfg.dryRun) {
              await apiService.addNegativeTarget(campaignId, adGroupId, productId);
            }
            result.negativeTargetsAdded++;
            result.details!.negatives.push({ term, type: 'asin', clicks, cost });
          } else {
            // Aggiungi a negative keywords
            console.log(`   ➖ ${cfg.dryRun ? '[DRY RUN] ' : ''}Negative Keyword: "${term}" (clicks=${clicks}, cost=${cost.toFixed(2)})`);
            if (!cfg.dryRun) {
              await apiService.addNegativeKeyword(campaignId, adGroupId, term, 'negativeExact');
            }
            result.negativeKeywordsAdded++;
            result.details!.negatives.push({ term, type: 'keyword', clicks, cost });
          }
        }

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing search term: ${errMsg}`);
        console.error(`   ❌ Errore:`, error);
      }
    }

    console.log('────────────────────────────────────────');
    console.log(`✅ Funzione 4 completata${cfg.dryRun ? ' (DRY RUN)' : ''}`);
    console.log(`   Targeting groups analizzati: ${result.targetingGroupsProcessed}`);
    console.log(`   Targeting groups ${cfg.dryRun ? 'da pausare' : 'pausati'}: ${result.targetingGroupsPaused}`);
    console.log(`   Targeting groups bid ${cfg.dryRun ? 'da aggiornare' : 'aggiornati'}: ${result.targetingGroupsBidUpdated}`);
    console.log(`   Negative keywords ${cfg.dryRun ? 'da aggiungere' : 'aggiunte'}: ${result.negativeKeywordsAdded}`);
    console.log(`   Negative targets ${cfg.dryRun ? 'da aggiungere' : 'aggiunti'}: ${result.negativeTargetsAdded}`);
    console.log(`   Errori: ${result.errors.length}`);
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Fatal error: ${errMsg}`);
    console.error('❌ Errore fatale Funzione 4:', error);
  }

  return result;
}

/**
 * Verifica se la Funzione 4 deve essere eseguita per una campagna
 *
 * @param campaignType - Tipo campagna (1-5)
 * @returns true se la funzione si applica
 */
export function shouldExecuteFunc4(campaignType: number): boolean {
  // Si applica SOLO alla campagna 5 (AD Automatica)
  return campaignType === 5;
}
