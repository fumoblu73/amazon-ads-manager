// ================================================
// FUNZIONE 2: PLACEMENT OPTIMIZATION
// ================================================
// Ottimizza i placement bid adjustments in base all'ACoS della campagna
// confrontato con il FAST ACoS del libro
//
// Si applica a: Campagne 1, 2, 3, 4, 5 (TUTTE)
//
// Frequenza: Ogni 7 giorni

import { amazonApiService } from '../../services/amazonApi';
import { calculateFastAcos, determineFastAcosBand, calculateNewPlacement, calculateAcos } from '../../utils/fastAcos';
import { formatDateForAmazon } from '../../utils/timeframe';

export interface Func2Config {
  frequency: number;              // Default: 7 giorni
  placementTimeframeWeeks: number; // Default: 4 settimane
}

export interface Book {
  price: number;
  printingCost: number;
  royaltyPercentage?: number;
}

export interface Func2Result {
  campaignId: string;
  campaignName: string;
  campaignAcos: number;
  fastAcos: number;
  band: number;
  placementsUpdated: boolean;
  oldPlacements: {
    topOfSearch: number;
    restOfSearch: number;
    productPages: number;
  };
  newPlacements: {
    topOfSearch: number;
    restOfSearch: number;
    productPages: number;
  };
  errors: string[];
}

/**
 * Esegue la Funzione 2: Placement Optimization
 *
 * Logica:
 * 1. Calcola ACoS CAMPAGNA ultimi 28 giorni (4 settimane)
 * 2. Calcola FAST ACoS del libro
 * 3. Determina fascia FAST ACoS
 * 4. Applica adjustment a TUTTI e 3 i placement
 *
 * @param campaignId - ID della campagna Amazon
 * @param campaignName - Nome della campagna
 * @param book - Dati del libro per calcolare FAST ACoS
 * @param currentPlacements - Placement correnti
 * @param config - Configurazione parametri (opzionale)
 * @returns Risultato con statistiche esecuzione
 */
export async function executeFunc2(
  campaignId: string,
  campaignName: string,
  marketplace: string,
  book: Book,
  currentPlacements: {
    topOfSearch: number;
    restOfSearch: number;
    productPages: number;
  },
  config?: Partial<Func2Config>
): Promise<Func2Result> {
  console.log('\n════════════════════════════════════════');
  console.log('🎯 FUNZIONE 2: Placement Optimization');
  console.log(`   Campagna: ${campaignName}`);
  console.log('════════════════════════════════════════');

  // Configurazione default
  const cfg: Func2Config = {
    frequency: config?.frequency || 7,
    placementTimeframeWeeks: config?.placementTimeframeWeeks || 4
  };

  const result: Func2Result = {
    campaignId,
    campaignName,
    campaignAcos: 0,
    fastAcos: 0,
    band: 3,
    placementsUpdated: false,
    oldPlacements: { ...currentPlacements },
    newPlacements: { ...currentPlacements },
    errors: []
  };

  try {
    // 1. Calcola FAST ACoS del libro
    const fastAcosResult = calculateFastAcos(book);
    result.fastAcos = fastAcosResult.fastAcos;

    console.log(`📚 Libro: prezzo=${book.price}, costi stampa=${book.printingCost}`);
    console.log(`📊 FAST ACoS: ${result.fastAcos.toFixed(2)}%`);

    // 2. Calcola date per il timeframe (ultimi N settimane)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (cfg.placementTimeframeWeeks * 7));

    const startDateStr = formatDateForAmazon(startDate);
    const endDateStr = formatDateForAmazon(endDate);

    console.log(`📅 Periodo analisi ACoS: ${startDateStr} - ${endDateStr} (${cfg.placementTimeframeWeeks} settimane)`);

    // 3. Richiedi report della campagna
    const reportId = await amazonApiService.requestReport(marketplace, startDateStr, [
      'campaignId',
      'cost',
      'sales'
    ]);

    const reportData = await amazonApiService.waitAndDownloadReport(marketplace, reportId);

    // 4. Trova metriche della campagna
    const campaignMetrics = reportData.find((r: any) => r.campaignId === campaignId);

    if (!campaignMetrics) {
      throw new Error('Metriche campagna non trovate nel report');
    }

    const cost = campaignMetrics.cost || 0;
    const sales = campaignMetrics.sales || 0;

    // 5. Calcola ACoS della campagna
    result.campaignAcos = calculateAcos(cost, sales);

    console.log(`💰 Spesa: ${cost.toFixed(2)}, Vendite: ${sales.toFixed(2)}`);
    console.log(`📈 ACoS Campagna: ${result.campaignAcos.toFixed(2)}%`);

    // 6. Determina fascia FAST ACoS
    const band = determineFastAcosBand(result.campaignAcos, result.fastAcos);
    result.band = band.band;

    console.log(`🎚️  Fascia: ${band.band} - ${band.bandName}`);
    console.log(`   Adjustment: ${band.placementAdjustment > 0 ? '+' : ''}${band.placementAdjustment}%`);

    // 7. Calcola nuovi placement
    result.newPlacements = {
      topOfSearch: calculateNewPlacement(currentPlacements.topOfSearch, band.placementAdjustment),
      restOfSearch: calculateNewPlacement(currentPlacements.restOfSearch, band.placementAdjustment),
      productPages: calculateNewPlacement(currentPlacements.productPages, band.placementAdjustment)
    };

    console.log(`\n📍 Placement Updates:`);
    console.log(`   Top of Search: ${currentPlacements.topOfSearch}% → ${result.newPlacements.topOfSearch}%`);
    console.log(`   Rest of Search: ${currentPlacements.restOfSearch}% → ${result.newPlacements.restOfSearch}%`);
    console.log(`   Product Pages: ${currentPlacements.productPages}% → ${result.newPlacements.productPages}%`);

    // 8. Aggiorna i placement su Amazon
    await amazonApiService.updateCampaignPlacements(marketplace, campaignId, result.newPlacements);

    result.placementsUpdated = true;

    console.log('────────────────────────────────────────');
    console.log(`✅ Funzione 2 completata`);
    console.log(`   Placements aggiornati con successo`);
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Fatal error: ${errMsg}`);
    console.error('❌ Errore fatale Funzione 2:', error);
  }

  return result;
}

/**
 * Verifica se la Funzione 2 deve essere eseguita per una campagna
 *
 * @param campaignType - Tipo campagna (1-5)
 * @returns true se la funzione si applica
 */
export function shouldExecuteFunc2(campaignType: number): boolean {
  // Si applica a TUTTE le campagne (1-5)
  return campaignType >= 1 && campaignType <= 5;
}
