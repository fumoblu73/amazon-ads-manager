// ================================================
// FAST ACoS - Calcoli e Determinazione Fasce
// ================================================
// FAST ACoS = Royalty / (Prezzo × 1.22)
// Dove: Royalty = (60% × Prezzo) - Costi di stampa

export interface Book {
  price: number;
  printingCost: number;
  royaltyPercentage?: number; // Default 60%
}

export interface FastAcosResult {
  fastAcos: number;
  royalty: number;
  breakeven: number;
}

export interface FastAcosBand {
  band: 1 | 2 | 3 | 4 | 5;
  bandName: string;
  minAcos: number;
  maxAcos: number;
  placementAdjustment: number; // Percentuale da aggiungere/togliere
  bidAdjustment: number; // Valore da aggiungere/togliere al bid
}

/**
 * Calcola il FAST ACoS per un libro
 *
 * @param book - Dati del libro (prezzo, costi stampa, royalty %)
 * @returns Oggetto con FAST ACoS e altri valori
 *
 * @example
 * const book = { price: 15, printingCost: 3 };
 * const result = calculateFastAcos(book);
 * // result.fastAcos = 32.8 (circa)
 */
export function calculateFastAcos(book: Book): FastAcosResult {
  const royaltyPercentage = book.royaltyPercentage || 60;

  // Royalty = (60% × Prezzo) - Costi di stampa
  const royalty = (royaltyPercentage / 100 * book.price) - book.printingCost;

  // FAST ACoS = Royalty / (Prezzo × 1.22)
  const fastAcos = (royalty / (book.price * 1.22)) * 100;

  // Breakeven = prezzo × 1.22 (prezzo con IVA)
  const breakeven = book.price * 1.22;

  return {
    fastAcos: Math.round(fastAcos * 100) / 100, // Arrotonda a 2 decimali
    royalty: Math.round(royalty * 100) / 100,
    breakeven: Math.round(breakeven * 100) / 100
  };
}

/**
 * Determina in quale fascia FAST ACoS rientra un dato ACoS
 *
 * @param acos - ACoS corrente della campagna/keyword
 * @param fastAcos - FAST ACoS del libro
 * @returns Oggetto con fascia e adjustment da applicare
 *
 * @example
 * const band = determineFastAcosBand(25, 60);
 * // band.band = 2 (fascia 2)
 * // band.placementAdjustment = 5 (aumenta placement del 5%)
 * // band.bidAdjustment = 0.02 (aumenta bid di 0.02)
 */
export function determineFastAcosBand(acos: number, fastAcos: number): FastAcosBand {
  // Calcola i limiti delle fasce
  const band1Max = fastAcos / 3;
  const band2Max = (fastAcos * 2) / 3;
  const band3Max = fastAcos;
  const band4Max = (fastAcos * 4) / 3;
  // band5 va da band4Max a infinito (o fastAcos * 5/3)

  // Fascia 1: 0% → FAST/3 (ottima performance)
  if (acos <= band1Max) {
    return {
      band: 1,
      bandName: 'Ottima performance',
      minAcos: 0,
      maxAcos: band1Max,
      placementAdjustment: 10, // +10%
      bidAdjustment: 0.05 // +0.05
    };
  }

  // Fascia 2: FAST/3 → FAST×2/3 (buona performance)
  if (acos <= band2Max) {
    return {
      band: 2,
      bandName: 'Buona performance',
      minAcos: band1Max,
      maxAcos: band2Max,
      placementAdjustment: 5, // +5%
      bidAdjustment: 0.02 // +0.02
    };
  }

  // Fascia 3: FAST×2/3 → FAST (performance accettabile)
  if (acos <= band3Max) {
    return {
      band: 3,
      bandName: 'Performance accettabile',
      minAcos: band2Max,
      maxAcos: band3Max,
      placementAdjustment: 0, // nessuna modifica
      bidAdjustment: 0 // nessuna modifica
    };
  }

  // Fascia 4: FAST → FAST×4/3 (performance scarsa)
  if (acos <= band4Max) {
    return {
      band: 4,
      bandName: 'Performance scarsa',
      minAcos: band3Max,
      maxAcos: band4Max,
      placementAdjustment: -5, // -5%
      bidAdjustment: -0.02 // -0.02
    };
  }

  // Fascia 5: FAST×4/3 → ∞ (performance pessima)
  return {
    band: 5,
    bandName: 'Performance pessima',
    minAcos: band4Max,
    maxAcos: Infinity,
    placementAdjustment: -10, // -10%
    bidAdjustment: -0.05 // -0.05
  };
}

/**
 * Calcola il nuovo placement adjustment
 *
 * @param currentPlacement - Placement corrente (%)
 * @param adjustment - Adjustment da applicare (può essere negativo)
 * @returns Nuovo placement (minimo 0%)
 *
 * @example
 * const newPlacement = calculateNewPlacement(10, 5);
 * // newPlacement = 15 (10% + 5%)
 *
 * const newPlacement2 = calculateNewPlacement(3, -10);
 * // newPlacement2 = 0 (non può andare sotto 0%)
 */
export function calculateNewPlacement(currentPlacement: number, adjustment: number): number {
  const newPlacement = currentPlacement + adjustment;

  // Il placement non può essere negativo
  return Math.max(0, newPlacement);
}

/**
 * Calcola il nuovo bid
 *
 * @param currentBid - Bid corrente (in valuta locale)
 * @param adjustment - Adjustment da applicare (può essere negativo)
 * @returns Nuovo bid (minimo 0.00)
 *
 * @example
 * const newBid = calculateNewBid(0.50, 0.02);
 * // newBid = 0.52
 *
 * const newBid2 = calculateNewBid(0.01, -0.05);
 * // newBid2 = 0.00 (non può andare sotto 0)
 */
export function calculateNewBid(currentBid: number, adjustment: number): number {
  const newBid = currentBid + adjustment;

  // Il bid non può essere negativo
  return Math.max(0, Math.round(newBid * 100) / 100); // Arrotonda a 2 decimali
}

/**
 * Calcola ACoS da metriche
 *
 * @param cost - Spesa pubblicitaria
 * @param sales - Vendite generate
 * @returns ACoS in percentuale (0-100)
 *
 * @example
 * const acos = calculateAcos(10, 50);
 * // acos = 20 (spesi 10€ per generare 50€ di vendite = 20% ACoS)
 */
export function calculateAcos(cost: number, sales: number): number {
  if (sales === 0) {
    return Infinity; // Nessuna vendita = ACoS infinito
  }

  return (cost / sales) * 100;
}

/**
 * Gestisce il caso speciale: 1 ordine con 1 click
 * In questo caso l'aumento bid è ridotto (+0.02 invece di +0.05)
 *
 * @param orders - Numero di ordini
 * @param clicks - Numero di clicks
 * @param band - Fascia FAST ACoS
 * @returns Bid adjustment corretto
 */
export function getSpecialCaseBidAdjustment(orders: number, clicks: number, band: FastAcosBand): number {
  // Caso speciale: 1 vendita con 1 click nella fascia 1
  if (orders === 1 && clicks === 1 && band.band === 1) {
    return 0.02; // Invece di 0.05
  }

  return band.bidAdjustment;
}
