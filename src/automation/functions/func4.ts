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

import { amazonApiService } from '../../services/amazonApi';
import { calculateFastAcos, determineFastAcosBand, calculateNewBid, calculateAcos } from '../../utils/fastAcos';
import { calculateTimeframeFunc4, formatDateForAmazon } from '../../utils/timeframe';

export interface Func4Config {
  frequency: number;          // Default: 7 giorni
  timeframeA: number;         // Default: 1000 impressions (più bassa di Func3)
  timeframeB: number;         // Default: 3000 impressions
  timeframeC: number;         // Default: 5000 impressions
  clicksNegative: number;     // Default: 10 clicks
  spendNegative: number;      // Default: 10 (valuta locale)
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
  errors: string[];
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
    spendNegative: config?.spendNegative || 10
  };

  const result: Func4Result = {
    campaignId,
    campaignName,
    targetingGroupsProcessed: 0,
    targetingGroupsPaused: 0,
    targetingGroupsBidUpdated: 0,
    negativeKeywordsAdded: 0,
    negativeTargetsAdded: 0,
    timeframeDays: 0,
    errors: []
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
    console.log('\n📊 PARTE 1: Ottimizzazione Targeting Groups');

    // 4. Recupera targeting groups
    const targetingGroups = await amazonApiService.getAutoTargetingGroups(marketplace, campaignId);
    console.log(`   Trovati ${targetingGroups.length} targeting groups`);

    // 5. Richiedi report per targeting groups
    const reportIdGroups = await amazonApiService.requestReport(marketplace, startDateStr, [
      'targetId',
      'impressions',
      'clicks',
      'cost',
      'sales',
      'orders',
      'bid'
    ]);

    const reportDataGroups = await amazonApiService.waitAndDownloadReport(marketplace, reportIdGroups);

    // 6. Processa ogni targeting group
    for (const group of targetingGroups) {
      result.targetingGroupsProcessed++;

      try {
        const targetId = group.targetId;
        const groupName = group.expression?.[0]?.type || targetId; // es: "complements", "close_match"
        const currentBid = group.bid;

        // Trova metriche del report
        const metrics = reportDataGroups.find((r: any) => r.targetId === targetId);

        if (!metrics) {
          console.log(`   ⏭️  Nessun dato per ${groupName}`);
          continue;
        }

        const clicks = metrics.clicks || 0;
        const orders = metrics.orders || 0;
        const cost = metrics.cost || 0;
        const sales = metrics.sales || 0;

        // a) CONTROLLO PAUSA
        if (clicks > cfg.clicksNegative && orders === 0) {
          console.log(`   ⏸️  PAUSA ${groupName}: clicks=${clicks}, orders=0`);
          await amazonApiService.updateTargetState(marketplace, targetId, 'paused');
          result.targetingGroupsPaused++;
          continue;
        }

        // b) OTTIMIZZAZIONE BID
        if (orders > 0 && sales > 0) {
          const acos = calculateAcos(cost, sales);
          const band = determineFastAcosBand(acos, fastAcosResult.fastAcos);
          const newBid = calculateNewBid(currentBid, band.bidAdjustment);

          if (newBid !== currentBid) {
            console.log(`   ${band.bidAdjustment > 0 ? '🔼' : '🔽'} ${groupName}:`);
            console.log(`      ACoS: ${acos.toFixed(2)}% (Fascia ${band.band})`);
            console.log(`      Bid: ${currentBid.toFixed(2)} → ${newBid.toFixed(2)}`);

            await amazonApiService.updateTargetBid(marketplace, targetId, newBid);
            result.targetingGroupsBidUpdated++;
          }
        }

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing targeting group: ${errMsg}`);
        console.error(`   ❌ Errore:`, error);
      }
    }

    // ================================================
    // PARTE 2: NEGATIVE TARGETING (Search Terms)
    // ================================================
    console.log('\n📊 PARTE 2: Negative Targeting (Search Terms)');

    // 7. Richiedi report search terms
    const reportIdSearchTerms = await amazonApiService.requestSearchTermsReport(marketplace, {
      startDate: startDateStr,
      endDate: endDateStr,
      campaignId
    });

    const searchTermsData = await amazonApiService.waitAndDownloadReport(marketplace, reportIdSearchTerms);
    console.log(`   Trovati ${searchTermsData.length} search terms`);

    // 8. Processa ogni search term
    for (const searchTerm of searchTermsData) {
      try {
        const term = searchTerm.searchTerm;
        const clicks = searchTerm.clicks || 0;
        const orders = searchTerm.orders || 0;
        const cost = searchTerm.cost || 0;

        // Controlla condizioni per negative targeting
        const shouldAddNegative =
          (clicks >= cfg.clicksNegative && orders === 0) ||
          (cost >= cfg.spendNegative && orders === 0);

        if (shouldAddNegative) {
          // Determina se è una keyword o un ASIN
          const isAsin = /^B[0-9A-Z]{9}$/.test(term); // Formato ASIN Amazon

          if (isAsin) {
            // Aggiungi a negative products
            console.log(`   ➖ Negative ASIN: ${term} (clicks=${clicks}, cost=${cost.toFixed(2)})`);
            await amazonApiService.addNegativeTarget(marketplace, campaignId, adGroupId, term);
            result.negativeTargetsAdded++;
          } else {
            // Aggiungi a negative keywords
            console.log(`   ➖ Negative Keyword: "${term}" (clicks=${clicks}, cost=${cost.toFixed(2)})`);
            await amazonApiService.addNegativeKeyword(marketplace, campaignId, adGroupId, term, 'negativeExact');
            result.negativeKeywordsAdded++;
          }
        }

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing search term: ${errMsg}`);
        console.error(`   ❌ Errore:`, error);
      }
    }

    console.log('────────────────────────────────────────');
    console.log(`✅ Funzione 4 completata`);
    console.log(`   Targeting groups analizzati: ${result.targetingGroupsProcessed}`);
    console.log(`   Targeting groups pausati: ${result.targetingGroupsPaused}`);
    console.log(`   Targeting groups bid aggiornati: ${result.targetingGroupsBidUpdated}`);
    console.log(`   Negative keywords aggiunte: ${result.negativeKeywordsAdded}`);
    console.log(`   Negative targets aggiunti: ${result.negativeTargetsAdded}`);
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
