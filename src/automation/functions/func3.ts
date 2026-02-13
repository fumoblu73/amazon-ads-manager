// ================================================
// FUNZIONE 3: TARGETING OPTIMIZATION
// ================================================
// Ottimizza i bid delle keyword/prodotti e mette in pausa
// quelli con performance pessime
//
// Si applica a: Campagne 1, 2, 3, 4 (NON campagna 5)
//
// Frequenza: Ogni 3 giorni (DOPO Funzione 1)

import { UserAmazonApiService } from '../../services/UserAmazonApiService';
import { calculateFastAcos, determineFastAcosBand, calculateNewBid, calculateAcos, getSpecialCaseBidAdjustment } from '../../utils/fastAcos';
import { calculateTimeframeFunc3, formatDateForAmazon } from '../../utils/timeframe';

export interface Func3Config {
  frequency: number;        // Default: 3 giorni (= Funzione 1)
  timeframeA: number;       // Default: 2000 impressions
  timeframeB: number;       // Default: 3000 impressions
  timeframeC: number;       // Default: 5000 impressions
  clicksPause: number;      // Default: 10 clicks
  clicks65days: number;     // Default: 30 clicks
  dryRun?: boolean;         // Se true, non modifica bid/stato (solo analisi)
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
  dryRun: boolean;
  errors: string[];
  details?: Array<{
    itemId: string;
    itemName: string;
    currentBid: number;
    clicks: number;
    orders: number;
    acos?: number;
    band?: number;
    action: 'paused' | 'bid_increased' | 'bid_decreased' | 'skipped' | 'no_data';
    newBid?: number;
  }>;
}

/**
 * Esegue la Funzione 3: Targeting Optimization
 */
export async function executeFunc3(
  campaignId: string,
  campaignType: 1 | 2 | 3 | 4,
  campaignName: string,
  marketplace: string,
  book: Book,
  totalImpressions30Days: number,
  apiService: any,  // Support both UserAmazonApiService and AmazonApiService
  config?: Partial<Func3Config>,
  preloadedReports?: { reportData: any[]; reportData65: any[] }
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
    clicks65days: config?.clicks65days || 30,
    dryRun: config?.dryRun || false
  };

  if (cfg.dryRun) {
    console.log('🔍 MODALITA\' DRY RUN - Nessun bid/stato verra\' modificato');
  }

  const result: Func3Result = {
    campaignId,
    campaignName,
    itemsProcessed: 0,
    itemsPaused: 0,
    itemsBidIncreased: 0,
    itemsBidDecreased: 0,
    timeframeDays: 0,
    dryRun: cfg.dryRun!,
    errors: [],
    details: []
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

    // 4. Usa report pre-caricati se disponibili, altrimenti richiedi da Amazon
    let reportData: any[];
    let reportData65: any[];

    if (preloadedReports) {
      console.log(`📊 Usando report pre-caricati (${preloadedReports.reportData.length} righe + ${preloadedReports.reportData65.length} righe 65gg)`);
      reportData = preloadedReports.reportData;
      reportData65 = preloadedReports.reportData65;
    } else {
      // Richiedi report principale (timeframe dinamico, max 31 giorni)
      const reportId = await apiService.requestReport(formatDateForAmazon(startDate), [
        'impressions', 'clicks', 'cost', 'sales', 'orders'
      ]);
      reportData = await apiService.waitAndDownloadReport(reportId);

      // Report ultimi 65 giorni: Amazon limita a 31gg, dividiamo in 2 chunk
      const startDate65a = new Date();
      startDate65a.setDate(startDate65a.getDate() - 30);
      const startDate65b = new Date();
      startDate65b.setDate(startDate65b.getDate() - 65);
      const endDate65b = new Date();
      endDate65b.setDate(endDate65b.getDate() - 31);

      console.log(`📅 Report 65gg: chunk A = ultimi 31gg, chunk B = giorni 31-65`);

      const reportId65a = await apiService.requestReport(formatDateForAmazon(startDate65a), [
        'clicks', 'orders'
      ]);
      const reportData65a = await apiService.waitAndDownloadReport(reportId65a);

      const reportId65b = await apiService.requestReport(
        formatDateForAmazon(startDate65b), ['clicks', 'orders'], formatDateForAmazon(endDate65b)
      );
      const reportData65b = await apiService.waitAndDownloadReport(reportId65b);

      // Merge: somma clicks e orders dei 2 chunk per ogni targeting
      const mergedMap: Record<string, { clicks: number; orders: number }> = {};
      for (const row of [...reportData65a, ...reportData65b]) {
        const key = row.targeting || row.keywordId || row.targetId || '';
        if (!mergedMap[key]) mergedMap[key] = { clicks: 0, orders: 0 };
        mergedMap[key].clicks += (row.clicks || 0);
        mergedMap[key].orders += (row.purchases14d || row.orders || 0);
      }
      reportData65 = Object.entries(mergedMap).map(([targeting, data]) => ({
        targeting,
        clicks: data.clicks,
        purchases14d: data.orders
      }));
    }

    // 5. Recupera items
    let items: any[] = [];
    if (campaignType === 1 || campaignType === 3) {
      items = await apiService.getKeywords(campaignId);
    } else {
      items = await apiService.getTargets(campaignId);
    }

    console.log(`📊 Trovati ${items.length} items da analizzare`);

    // 6. Processa ogni item
    for (const item of items) {
      result.itemsProcessed++;

      try {
        const itemId = item.keywordId || item.targetId;
        const itemName = item.keywordText || item.asin || itemId;
        const currentBid = item.bid;

        // Trova metriche - API v3 usa 'targeting' (testo keyword/ASIN) per matching
        const matchTarget = item.keywordText || item.resolvedExpression?.value || item.expression?.[0]?.value || '';
        const metrics = reportData.find((r: any) =>
          (r.keywordId && String(r.keywordId) === String(itemId)) ||
          (r.targetId && String(r.targetId) === String(itemId)) ||
          (r.targeting && matchTarget && r.targeting === matchTarget)
        );
        const metrics65 = reportData65.find((r: any) =>
          (r.keywordId && String(r.keywordId) === String(itemId)) ||
          (r.targetId && String(r.targetId) === String(itemId)) ||
          (r.targeting && matchTarget && r.targeting === matchTarget)
        );

        if (!metrics) {
          result.details!.push({ itemId, itemName, currentBid: currentBid || 0, clicks: 0, orders: 0, action: 'no_data' });
          continue;
        }

        const clicks = metrics.clicks || 0;
        const orders = metrics.purchases14d || metrics.orders || 0;
        const clicks65 = metrics65?.clicks || 0;
        const orders65 = metrics65?.purchases14d || (metrics65 as any)?.orders || 0;
        const cost = metrics.cost || 0;
        const sales = metrics.sales14d || metrics.sales || 0;

        // a) CONTROLLO PAUSA
        const shouldPause =
          (clicks >= cfg.clicksPause && orders === 0) ||
          (clicks65 >= cfg.clicks65days && orders65 === 0);

        if (shouldPause) {
          console.log(`   ⏸️  ${cfg.dryRun ? '[DRY RUN] ' : ''}PAUSA ${itemName}: clicks=${clicks}/${clicks65}, orders=${orders}/${orders65}`);

          if (!cfg.dryRun) {
            if (campaignType === 1 || campaignType === 3) {
              await apiService.updateKeywordState(itemId, 'paused');
            } else {
              await apiService.updateTargetState(itemId, 'paused');
            }
          }

          result.itemsPaused++;
          result.details!.push({ itemId, itemName, currentBid: currentBid || 0, clicks, orders, action: 'paused' });
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
            console.log(`   ${bidAdjustment > 0 ? '🔼' : '🔽'} ${cfg.dryRun ? '[DRY RUN] ' : ''}${itemName}: ${currentBid.toFixed(2)} → ${newBid.toFixed(2)} (Fascia ${band.band})`);

            if (!cfg.dryRun) {
              if (campaignType === 1 || campaignType === 3) {
                await apiService.updateKeywordBid(itemId, newBid);
              } else {
                await apiService.updateTargetBid(itemId, newBid);
              }
            }

            if (bidAdjustment > 0) {
              result.itemsBidIncreased++;
              result.details!.push({ itemId, itemName, currentBid, clicks, orders, acos, band: band.band, action: 'bid_increased', newBid });
            } else if (bidAdjustment < 0) {
              result.itemsBidDecreased++;
              result.details!.push({ itemId, itemName, currentBid, clicks, orders, acos, band: band.band, action: 'bid_decreased', newBid });
            }
          } else {
            result.details!.push({ itemId, itemName, currentBid, clicks, orders, acos, band: band.band, action: 'skipped' });
          }
        } else {
          result.details!.push({ itemId, itemName, currentBid: currentBid || 0, clicks, orders, action: 'skipped' });
        }

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing item: ${errMsg}`);
      }
    }

    console.log('────────────────────────────────────────');
    console.log(`✅ Funzione 3 completata${cfg.dryRun ? ' (DRY RUN)' : ''}`);
    console.log(`   Items analizzati: ${result.itemsProcessed}`);
    console.log(`   Items ${cfg.dryRun ? 'da pausare' : 'pausati'}: ${result.itemsPaused}`);
    console.log(`   Bid ${cfg.dryRun ? 'da aumentare' : 'aumentati'}: ${result.itemsBidIncreased}`);
    console.log(`   Bid ${cfg.dryRun ? 'da ridurre' : 'ridotti'}: ${result.itemsBidDecreased}`);
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
