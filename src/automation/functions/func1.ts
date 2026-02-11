// ================================================
// FUNZIONE 1: PROGRESSIVE BIDDING INCREASE
// ================================================
// Aumenta progressivamente il bid di keyword/prodotti con poche impressions
// per dare loro più visibilità
//
// Si applica a: Campagne 1, 2, 3, 4 (NON campagna 5 - AD Automatica)
//
// Frequenza: Ogni 3 giorni (sincronizzata con Funzione 3)

import { UserAmazonApiService } from '../../services/UserAmazonApiService';
import { formatDateForAmazon } from '../../utils/timeframe';

export interface Func1Config {
  bidIncrease: number;      // Default: 0.02
  frequency: number;        // Default: 3 giorni
  maxImpressions: number;   // Default: 20
  maxClicks: number;        // Default: 0
}

export interface Func1Result {
  campaignId: string;
  campaignName: string;
  itemsProcessed: number;
  itemsIncreased: number;
  errors: string[];
  details?: Array<{
    itemId: string;
    itemName: string;
    currentBid: number;
    impressions: number;
    clicks: number;
    action: 'increased' | 'skipped' | 'no_bid';
    newBid?: number;
  }>;
}

/**
 * Esegue la Funzione 1: Progressive Bidding Increase
 *
 * Logica:
 * - Per ogni keyword/prodotto nelle campagne 1-4
 * - Prende dati ultimi 3 giorni (frequency)
 * - SE (impressions <= 20 AND clicks <= 0):
 *   → Aumenta bid di 0.02 (nella valuta del marketplace)
 *
 * @param campaignId - ID della campagna Amazon
 * @param campaignType - Tipo campagna (1-4)
 * @param campaignName - Nome della campagna
 * @param marketplace - Marketplace code
 * @param apiService - Per-user Amazon API service instance
 * @param config - Configurazione parametri (opzionale)
 * @returns Risultato con statistiche esecuzione
 */
export async function executeFunc1(
  campaignId: string,
  campaignType: 1 | 2 | 3 | 4,
  campaignName: string,
  marketplace: string,
  apiService: any,  // Support both UserAmazonApiService and AmazonApiService
  config?: Partial<Func1Config>
): Promise<Func1Result> {
  console.log('\n════════════════════════════════════════');
  console.log('📈 FUNZIONE 1: Progressive Bidding Increase');
  console.log(`   Campagna: ${campaignName} (Tipo ${campaignType})`);
  console.log('════════════════════════════════════════');

  // Configurazione default
  const cfg: Func1Config = {
    bidIncrease: config?.bidIncrease || 0.02,
    frequency: config?.frequency || 3,
    maxImpressions: config?.maxImpressions || 20,
    maxClicks: config?.maxClicks || 0
  };

  const result: Func1Result = {
    campaignId,
    campaignName,
    itemsProcessed: 0,
    itemsIncreased: 0,
    errors: [],
    details: []
  };

  try {
    // 1. Calcola date per il timeframe (ultimi N giorni)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - cfg.frequency);

    const startDateStr = formatDateForAmazon(startDate);
    const endDateStr = formatDateForAmazon(endDate);

    console.log(`📅 Periodo analisi: ${startDateStr} - ${endDateStr} (${cfg.frequency} giorni)`);

    // 2. Richiedi report delle performance
    const reportId = await apiService.requestReport(startDateStr, ['impressions', 'clicks', 'spend', 'sales']);

    // 3. Aspetta e scarica il report
    const reportData = await apiService.waitAndDownloadReport(reportId);

    // 4. Recupera keywords o targets in base al tipo di campagna
    let items: any[] = [];

    if (campaignType === 1 || campaignType === 3) {
      // Campagne Keyword-based
      items = await apiService.getKeywords(campaignId);
      console.log(`📊 Trovate ${items.length} keywords`);
    } else if (campaignType === 2 || campaignType === 4) {
      // Campagne Product-based
      items = await apiService.getTargets(campaignId);
      console.log(`📊 Trovati ${items.length} targets`);
    }

    // 5. Processa ogni item
    for (const item of items) {
      result.itemsProcessed++;

      try {
        const itemId = item.keywordId || item.targetId;
        const itemName = item.keywordText || item.asin || itemId;
        const currentBid = item.bid;

        // Trova le metriche del report per questo item
        const metrics = reportData.find((r: any) =>
          (r.keywordId && r.keywordId === itemId) ||
          (r.targetId && r.targetId === itemId)
        );

        // Se non ci sono dati nel report, la keyword ha 0 impressioni e 0 click
        // (Amazon include nel report solo items con almeno qualche attivita')
        const impressions = metrics?.impressions || 0;
        const clicks = metrics?.clicks || 0;

        // Skip items senza bid (es. state=paused senza bid impostato)
        if (currentBid === undefined || currentBid === null) {
          result.details!.push({ itemId, itemName, currentBid: 0, impressions, clicks, action: 'no_bid' });
          continue;
        }

        // 6. Controlla condizione: impressions <= maxImpressions AND clicks <= maxClicks
        if (impressions <= cfg.maxImpressions && clicks <= cfg.maxClicks) {
          const newBid = currentBid + cfg.bidIncrease;

          console.log(`   🔼 ${itemName}:`);
          console.log(`      Impressions: ${impressions}, Clicks: ${clicks}`);
          console.log(`      Bid: ${currentBid.toFixed(2)} → ${newBid.toFixed(2)}`);

          // Aggiorna il bid
          if (campaignType === 1 || campaignType === 3) {
            await apiService.updateKeywordBid(itemId, newBid);
          } else {
            await apiService.updateTargetBid(itemId, newBid);
          }

          result.itemsIncreased++;
          result.details!.push({ itemId, itemName, currentBid, impressions, clicks, action: 'increased', newBid });
        } else {
          result.details!.push({ itemId, itemName, currentBid, impressions, clicks, action: 'skipped' });
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing item: ${errMsg}`);
        console.error(`   ❌ Errore:`, error);
      }
    }

    console.log('────────────────────────────────────────');
    console.log(`✅ Funzione 1 completata`);
    console.log(`   Items analizzati: ${result.itemsProcessed}`);
    console.log(`   Bid aumentati: ${result.itemsIncreased}`);
    console.log(`   Errori: ${result.errors.length}`);
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Fatal error: ${errMsg}`);
    console.error('❌ Errore fatale Funzione 1:', error);
  }

  return result;
}

/**
 * Verifica se la Funzione 1 deve essere eseguita per una campagna
 *
 * @param campaignType - Tipo campagna (1-5)
 * @returns true se la funzione si applica
 */
export function shouldExecuteFunc1(campaignType: number): boolean {
  // Si applica solo a campagne 1, 2, 3, 4 (NON 5)
  return campaignType >= 1 && campaignType <= 4;
}
