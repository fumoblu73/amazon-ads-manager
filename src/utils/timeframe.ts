// ================================================
// TIMEFRAME DINAMICO
// ================================================
// Calcola il timeframe (finestra temporale) in base al volume di traffico
// della campagna. Più traffico ha, più breve è il timeframe per avere
// dati statisticamente significativi.

export interface TimeframeConfig {
  timeframeA: number; // Soglia bassa impressions giornaliere
  timeframeB: number; // Soglia media impressions giornaliere
  timeframeC: number; // Soglia alta impressions giornaliere
}

export interface TimeframeResult {
  timeframeDays: number;
  dailyImpressions: number;
  reason: string;
}

/**
 * Calcola il timeframe dinamico per Funzione 3 (Targeting Optimization)
 *
 * Logica:
 * - SE daily_impressions < timeframeA (2000): timeframe = 30 giorni
 * - ALTRIMENTI SE daily_impressions < timeframeB (3000): timeframe = 25 giorni
 * - ALTRIMENTI SE daily_impressions < timeframeC (5000): timeframe = 20 giorni
 * - ALTRIMENTI: timeframe = 15 giorni
 *
 * @param totalImpressions - Impressions totali della campagna negli ultimi 30 giorni
 * @param config - Configurazione soglie (opzionale, usa default da SPECIFICATIONS)
 * @returns Oggetto con timeframe in giorni e dettagli
 *
 * @example
 * const result = calculateTimeframeFunc3(50000);
 * // result.timeframeDays = 20 (circa 1666 impressions/giorno)
 */
export function calculateTimeframeFunc3(
  totalImpressions: number,
  config?: TimeframeConfig
): TimeframeResult {
  // Default values dalle SPECIFICATIONS.md
  const timeframeA = config?.timeframeA || 2000;
  const timeframeB = config?.timeframeB || 3000;
  const timeframeC = config?.timeframeC || 5000;

  // Calcola impressions giornaliere medie (ultimi 30 giorni)
  const dailyImpressions = totalImpressions / 30;

  if (dailyImpressions < timeframeA) {
    return {
      timeframeDays: 30,
      dailyImpressions: Math.round(dailyImpressions),
      reason: `Traffico basso (${Math.round(dailyImpressions)} imp/giorno < ${timeframeA})`
    };
  }

  if (dailyImpressions < timeframeB) {
    return {
      timeframeDays: 25,
      dailyImpressions: Math.round(dailyImpressions),
      reason: `Traffico medio-basso (${Math.round(dailyImpressions)} imp/giorno < ${timeframeB})`
    };
  }

  if (dailyImpressions < timeframeC) {
    return {
      timeframeDays: 20,
      dailyImpressions: Math.round(dailyImpressions),
      reason: `Traffico medio (${Math.round(dailyImpressions)} imp/giorno < ${timeframeC})`
    };
  }

  return {
    timeframeDays: 15,
    dailyImpressions: Math.round(dailyImpressions),
    reason: `Traffico alto (${Math.round(dailyImpressions)} imp/giorno >= ${timeframeC})`
  };
}

/**
 * Calcola il timeframe dinamico per Funzione 4 (Auto Ad Optimization)
 *
 * Logica (soglie diverse da Funzione 3):
 * - SE daily_impressions < 1000: timeframe = 30 giorni
 * - ALTRIMENTI SE daily_impressions < 3000: timeframe = 25 giorni
 * - ALTRIMENTI SE daily_impressions < 5000: timeframe = 20 giorni
 * - ALTRIMENTI: timeframe = 15 giorni
 *
 * @param totalImpressions - Impressions totali della campagna negli ultimi 30 giorni
 * @param config - Configurazione soglie (opzionale, usa default da SPECIFICATIONS)
 * @returns Oggetto con timeframe in giorni e dettagli
 *
 * @example
 * const result = calculateTimeframeFunc4(20000);
 * // result.timeframeDays = 30 (circa 666 impressions/giorno)
 */
export function calculateTimeframeFunc4(
  totalImpressions: number,
  config?: Partial<TimeframeConfig>
): TimeframeResult {
  // Default values per Funzione 4 (diverse da Funzione 3!)
  const timeframeA = config?.timeframeA || 1000; // Più bassa
  const timeframeB = config?.timeframeB || 3000;
  const timeframeC = config?.timeframeC || 5000;

  // Calcola impressions giornaliere medie (ultimi 30 giorni)
  const dailyImpressions = totalImpressions / 30;

  if (dailyImpressions < timeframeA) {
    return {
      timeframeDays: 30,
      dailyImpressions: Math.round(dailyImpressions),
      reason: `Traffico basso Auto Ads (${Math.round(dailyImpressions)} imp/giorno < ${timeframeA})`
    };
  }

  if (dailyImpressions < timeframeB) {
    return {
      timeframeDays: 25,
      dailyImpressions: Math.round(dailyImpressions),
      reason: `Traffico medio-basso Auto Ads (${Math.round(dailyImpressions)} imp/giorno < ${timeframeB})`
    };
  }

  if (dailyImpressions < timeframeC) {
    return {
      timeframeDays: 20,
      dailyImpressions: Math.round(dailyImpressions),
      reason: `Traffico medio Auto Ads (${Math.round(dailyImpressions)} imp/giorno < ${timeframeC})`
    };
  }

  return {
    timeframeDays: 15,
    dailyImpressions: Math.round(dailyImpressions),
    reason: `Traffico alto Auto Ads (${Math.round(dailyImpressions)} imp/giorno >= ${timeframeC})`
  };
}

/**
 * Calcola la data di inizio per il timeframe
 *
 * @param timeframeDays - Numero di giorni del timeframe
 * @param referenceDate - Data di riferimento (opzionale, default: oggi)
 * @returns Data di inizio del timeframe (YYYY-MM-DD)
 *
 * @example
 * const startDate = getTimeframeStartDate(30);
 * // startDate = "2025-10-12" (se oggi è 2025-11-11)
 */
export function getTimeframeStartDate(timeframeDays: number, referenceDate?: Date): string {
  const reference = referenceDate || new Date();
  const startDate = new Date(reference);
  startDate.setDate(startDate.getDate() - timeframeDays);

  return formatDateForAmazon(startDate);
}

/**
 * Calcola la data di fine per il timeframe
 *
 * @param referenceDate - Data di riferimento (opzionale, default: oggi)
 * @returns Data di fine del timeframe (YYYY-MM-DD)
 *
 * @example
 * const endDate = getTimeframeEndDate();
 * // endDate = "2025-11-11"
 */
export function getTimeframeEndDate(referenceDate?: Date): string {
  const reference = referenceDate || new Date();
  return formatDateForAmazon(reference);
}

/**
 * Formatta una data nel formato richiesto da Amazon API (YYYYMMDD)
 *
 * @param date - Data da formattare
 * @returns Stringa nel formato YYYYMMDD
 *
 * @example
 * const formatted = formatDateForAmazon(new Date('2025-11-11'));
 * // formatted = "20251111"
 */
export function formatDateForAmazon(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

/**
 * Verifica se una campagna è nel periodo di riscaldamento
 * Le automazioni partono 7 giorni dopo la creazione della campagna
 *
 * @param campaignCreatedAt - Data di creazione della campagna
 * @param warmupDays - Giorni di riscaldamento (default: 7)
 * @returns true se la campagna è ancora in riscaldamento
 *
 * @example
 * const isWarmup = isInWarmupPeriod(new Date('2025-11-05'));
 * // isWarmup = true (se oggi è 2025-11-11, sono passati solo 6 giorni)
 */
export function isInWarmupPeriod(campaignCreatedAt: Date, warmupDays: number = 7): boolean {
  const now = new Date();
  const daysSinceCreation = Math.floor((now.getTime() - campaignCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

  return daysSinceCreation < warmupDays;
}

/**
 * Calcola il giorno corrente dalla creazione della campagna
 *
 * @param campaignCreatedAt - Data di creazione della campagna
 * @returns Numero di giorni dalla creazione
 *
 * @example
 * const day = getDaysSinceCreation(new Date('2025-11-01'));
 * // day = 10 (se oggi è 2025-11-11)
 */
export function getDaysSinceCreation(campaignCreatedAt: Date): number {
  const now = new Date();
  return Math.floor((now.getTime() - campaignCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
}
