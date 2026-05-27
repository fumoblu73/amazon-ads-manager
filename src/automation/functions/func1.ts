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
import { findMetricsForItem } from './_reportMatching';

export interface Func1Config {
  bidIncrease: number;      // Default: 0.02
  frequency: number;        // Default: 3 giorni
  maxImpressions: number;   // Default: 20
  maxClicks: number;        // Default: 0
  dryRun?: boolean;         // Se true, non aggiorna i bid (solo analisi)
}

export interface Func1Result {
  campaignId: string;
  campaignName: string;
  itemsProcessed: number;
  itemsIncreased: number;
  itemsWithoutMetrics: number;  // diagnostico: items non trovati nel report
  dryRun: boolean;
  reportSample?: any;
  errors: string[];
  details?: Array<{
    itemId: string;
    itemName: string;
    currentBid: number;
    impressions: number;
    clicks: number;
    action: 'increased' | 'skipped' | 'no_bid' | 'no_data';
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
 * @param preloadedReportData - Report gia' scaricato (evita richieste duplicate)
 * @returns Risultato con statistiche esecuzione
 */
export async function executeFunc1(
  campaignId: string,
  campaignType: 1 | 2 | 3 | 4,
  campaignName: string,
  marketplace: string,
  apiService: any,
  config?: Partial<Func1Config>,
  preloadedReportData?: any[]
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
    maxClicks: config?.maxClicks || 0,
    dryRun: config?.dryRun || false
  };

  if (cfg.dryRun) {
    console.log('🔍 MODALITA\' DRY RUN - Nessun bid verra\' aggiornato');
  }

  const result: Func1Result = {
    campaignId,
    campaignName,
    itemsProcessed: 0,
    itemsIncreased: 0,
    itemsWithoutMetrics: 0,
    dryRun: cfg.dryRun!,
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

    // 2-3. Usa report pre-scaricato o richiedine uno nuovo
    let reportData: any[];
    if (preloadedReportData) {
      reportData = preloadedReportData;
      console.log(`📊 Usando report pre-scaricato (${reportData.length} righe)`);
    } else {
      const reportId = await apiService.requestReport(startDateStr, ['impressions', 'clicks', 'spend', 'sales']);
      reportData = await apiService.waitAndDownloadReport(reportId);
    }

    // Log campione del report per debug (mostra campi reali)
    if (reportData.length > 0) {
      result.reportSample = reportData[0];
      console.log(`📋 Report sample (campi):`, Object.keys(reportData[0]).join(', '));
    }

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
        // FIX bug 9: il report v3 spTargeting non contiene keywordId/targetId,
        // serve match via keywordText/expression usando l'helper condiviso.
        const metrics = findMetricsForItem(reportData, item, campaignId);
        if (!metrics) {
          // STRATEGIA FAST ACOS: se metrics undefined, l'item è quasi sempre un
          // target dormiente (0 impression in 28gg, escluso da Amazon dal report).
          // Verificato in console: su Product, dei 280 "missed" 288 hanno davvero
          // 0 impression. Strategia: alzare il bid è gratuito (paghi a click), e
          // F3 metterà eventualmente in pausa quelli che dopo i click non vendono.
          // Il fix A (match esatto) elimina i falsi positivi del vecchio includes
          // bidirezionale, quindi questo default è ora sicuro.
          result.itemsWithoutMetrics++;
        }

        // Se non ci sono dati nel report, considera 0 impressioni / 0 click
        // (Amazon include nel report solo items con almeno 1 impression in 28gg)
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

          if (!cfg.dryRun) {
            console.log(`   🔼 ${itemName}:`);
            console.log(`      Impressions: ${impressions}, Clicks: ${clicks}`);
            console.log(`      Bid: ${currentBid.toFixed(2)} → ${newBid.toFixed(2)}`);

            // Aggiorna il bid
            if (campaignType === 1 || campaignType === 3) {
              await apiService.updateKeywordBid(itemId, newBid);
            } else {
              await apiService.updateTargetBid(itemId, newBid);
            }
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
    console.log(`✅ Funzione 1 completata${cfg.dryRun ? ' (DRY RUN)' : ''}`);
    console.log(`   Items analizzati: ${result.itemsProcessed}`);
    console.log(`   Items senza match nel report: ${result.itemsWithoutMetrics}/${result.itemsProcessed}`);
    console.log(`   Bid ${cfg.dryRun ? 'da aumentare' : 'aumentati'}: ${result.itemsIncreased}`);
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
