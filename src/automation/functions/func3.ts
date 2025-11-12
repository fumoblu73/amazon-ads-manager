// ================================================
// FUNZIONE 3: TARGETING OPTIMIZATION
// ================================================
// Ottimizza i bid delle keyword/prodotti e mette in pausa
// quelli con performance pessime
//
// Si applica a: Campagne 1, 2, 3, 4 (NON campagna 5)
//
// Frequenza: Ogni 3 giorni (DOPO Funzione 1)

import { amazonApiService } from '../../services/amazonApi';
import { calculateFastAcos, determineFastAcosBand, calculateNewBid, calculateAcos, getSpecialCaseBidAdjustment } from '../../utils/fastAcos';
import { calculateTimeframeFunc3, formatDateForAmazon } from '../../utils/timeframe';

export interface Func3Config {
  frequency: number;        // Default: 3 giorni (= Funzione 1)
  timeframeA: number;       // Default: 2000 impressions
  timeframeB: number;       // Default: 3000 impressions
  timeframeC: number;       // Default: 5000 impressions
  clicksPause: number;      // Default: 10 clicks
  clicks65days: number;     // Default: 30 clicks
}

export interface Book {
  price: number;
  printingCost: number;
  royaltyPercentage?: number;
}

export interface Func3Result {
  campaignId: string;
  campaignName: string;
  itemsProcessed: number;
  itemsPaused: number;
  itemsBidIncreased: number;
  itemsBidDecreased: number;
  timeframeDays: number;
  errors: string[];
}

/**
 * Esegue la Funzione 3: Targeting Optimization
 */
export async function executeFunc3(
  campaignId: string,
  campaignType: 1 | 2 | 3 | 4,
  campaignName: string,
  book: Book,
  totalImpressions30Days: number,
  config?: Partial<Func3Config>
): Promise<Func3Result> {
  console.log('\n════════════════════════════════════════');
  console.log('🎯 FUNZIONE 3: Targeting Optimization');
  console.log(`   Campagna: ${campaignName} (Tipo ${campaignType})`);
  console.log('════════════════════════════════════════');

  const cfg: Func3Config = {
    frequency: config?.frequency || 3,
    timeframeA: config?.timeframeA || 2000,
    timeframeB: config?.timeframeB || 3000,
    timeframeC: config?.timeframeC || 5000,
    clicksPause: config?.clicksPause || 10,
    clicks65days: config?.clicks65days || 30
  };

  const result: Func3Result = {
    campaignId,
    campaignName,
    itemsProcessed: 0,
    itemsPaused: 0,
    itemsBidIncreased: 0,
    itemsBidDecreased: 0,
    timeframeDays: 0,
    errors: []
  };

  try {
    // 1. Calcola FAST ACoS
    const fastAcosResult = calculateFastAcos(book);
    console.log(`📊 FAST ACoS: ${fastAcosResult.fastAcos.toFixed(2)}%`);

    // 2. Determina timeframe dinamico
    const timeframeResult = calculateTimeframeFunc3(totalImpressions30Days, cfg);
    result.timeframeDays = timeframeResult.timeframeDays;
    console.log(`⏱️  ${timeframeResult.reason}`);
    console.log(`📅 Timeframe: ${timeframeResult.timeframeDays} giorni`);

    // 3. Calcola date
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframeResult.timeframeDays);

    const startDate65 = new Date();
    startDate65.setDate(startDate65.getDate() - 65);

    // 4. Richiedi report
    const reportId = await amazonApiService.requestReport(formatDateForAmazon(startDate), [
      'keywordId', 'targetId', 'impressions', 'clicks', 'cost', 'sales', 'orders', 'bid'
    ]);
    const reportData = await amazonApiService.waitAndDownloadReport(reportId);

    // Report ultimi 65 giorni per controllo pausa
    const reportId65 = await amazonApiService.requestReport(formatDateForAmazon(startDate65), [
      'keywordId', 'targetId', 'clicks', 'orders'
    ]);
    const reportData65 = await amazonApiService.waitAndDownloadReport(reportId65);

    // 5. Recupera items
    let items: any[] = [];
    if (campaignType === 1 || campaignType === 3) {
      items = await amazonApiService.getKeywords(campaignId);
    } else {
      items = await amazonApiService.getTargets(campaignId);
    }

    console.log(`📊 Trovati ${items.length} items da analizzare`);

    // 6. Processa ogni item
    for (const item of items) {
      result.itemsProcessed++;

      try {
        const itemId = item.keywordId || item.targetId;
        const itemName = item.keywordText || item.asin || itemId;
        const currentBid = item.bid;

        // Trova metriche
        const metrics = reportData.find((r: any) =>
          (r.keywordId === itemId) || (r.targetId === itemId)
        );
        const metrics65 = reportData65.find((r: any) =>
          (r.keywordId === itemId) || (r.targetId === itemId)
        );

        if (!metrics) continue;

        const clicks = metrics.clicks || 0;
        const orders = metrics.orders || 0;
        const clicks65 = metrics65?.clicks || 0;
        const orders65 = metrics65?.orders || 0;
        const cost = metrics.cost || 0;
        const sales = metrics.sales || 0;

        // a) CONTROLLO PAUSA
        const shouldPause =
          (clicks >= cfg.clicksPause && orders === 0) ||
          (clicks65 >= cfg.clicks65days && orders65 === 0);

        if (shouldPause) {
          console.log(`   ⏸️  PAUSA ${itemName}: clicks=${clicks}/${clicks65}, orders=${orders}/${orders65}`);

          if (campaignType === 1 || campaignType === 3) {
            await amazonApiService.updateKeywordState(itemId, 'paused');
          } else {
            await amazonApiService.updateTargetState(itemId, 'paused');
          }

          result.itemsPaused++;
          continue;
        }

        // b) OTTIMIZZAZIONE BID
        if (orders > 0) {
          const acos = calculateAcos(cost, sales);
          const band = determineFastAcosBand(acos, fastAcosResult.fastAcos);

          // Caso speciale: 1 ordine con 1 click
          const bidAdjustment = getSpecialCaseBidAdjustment(orders, clicks, band);
          const newBid = calculateNewBid(currentBid, bidAdjustment);

          if (newBid !== currentBid) {
            console.log(`   ${bidAdjustment > 0 ? '🔼' : '🔽'} ${itemName}: ${currentBid.toFixed(2)} → ${newBid.toFixed(2)} (Fascia ${band.band})`);

            if (campaignType === 1 || campaignType === 3) {
              await amazonApiService.updateKeywordBid(itemId, newBid);
            } else {
              await amazonApiService.updateTargetBid(itemId, newBid);
            }

            if (bidAdjustment > 0) result.itemsBidIncreased++;
            else if (bidAdjustment < 0) result.itemsBidDecreased++;
          }
        }

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing item: ${errMsg}`);
      }
    }

    console.log('────────────────────────────────────────');
    console.log(`✅ Funzione 3 completata`);
    console.log(`   Items analizzati: ${result.itemsProcessed}`);
    console.log(`   Items pausati: ${result.itemsPaused}`);
    console.log(`   Bid aumentati: ${result.itemsBidIncreased}`);
    console.log(`   Bid ridotti: ${result.itemsBidDecreased}`);
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Fatal error: ${errMsg}`);
    console.error('❌ Errore fatale Funzione 3:', error);
  }

  return result;
}

export function shouldExecuteFunc3(campaignType: number): boolean {
  return campaignType >= 1 && campaignType <= 4;
}
