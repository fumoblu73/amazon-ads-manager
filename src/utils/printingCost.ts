/**
 * KDP Printing Cost Calculator
 * Based on official Amazon KDP pricing tables:
 * https://kdp.amazon.com/en_US/help/topic/G201834340
 *
 * Formula: Printing Cost = Fixed Cost + (Per-Page Cost × Page Count)
 */

export type InkType = 'black_white' | 'standard_color' | 'premium_color';

interface PrintingCostRate {
  fixedCost: number;
  perPageCost: number;
}

// KDP printing cost tables per marketplace and ink type
// Source: https://kdp.amazon.com/en_US/help/topic/G201834340
const PRINTING_COSTS: Record<string, Record<InkType, PrintingCostRate>> = {
  // Amazon.com (US)
  US: {
    black_white:    { fixedCost: 0.85, perPageCost: 0.012 },
    standard_color: { fixedCost: 0.85, perPageCost: 0.036 },
    premium_color:  { fixedCost: 0.85, perPageCost: 0.065 },
  },
  // Amazon.co.uk (UK)
  UK: {
    black_white:    { fixedCost: 0.70, perPageCost: 0.010 },
    standard_color: { fixedCost: 0.70, perPageCost: 0.030 },
    premium_color:  { fixedCost: 0.70, perPageCost: 0.055 },
  },
  // Amazon.de (Germany)
  DE: {
    black_white:    { fixedCost: 0.60, perPageCost: 0.012 },
    standard_color: { fixedCost: 0.60, perPageCost: 0.036 },
    premium_color:  { fixedCost: 0.60, perPageCost: 0.065 },
  },
  // Amazon.fr (France)
  FR: {
    black_white:    { fixedCost: 0.60, perPageCost: 0.012 },
    standard_color: { fixedCost: 0.60, perPageCost: 0.036 },
    premium_color:  { fixedCost: 0.60, perPageCost: 0.065 },
  },
  // Amazon.es (Spain)
  ES: {
    black_white:    { fixedCost: 0.60, perPageCost: 0.012 },
    standard_color: { fixedCost: 0.60, perPageCost: 0.036 },
    premium_color:  { fixedCost: 0.60, perPageCost: 0.065 },
  },
  // Amazon.it (Italy)
  IT: {
    black_white:    { fixedCost: 0.60, perPageCost: 0.012 },
    standard_color: { fixedCost: 0.60, perPageCost: 0.036 },
    premium_color:  { fixedCost: 0.60, perPageCost: 0.065 },
  },
  // Amazon.co.jp (Japan)
  JP: {
    black_white:    { fixedCost: 114, perPageCost: 1.5 },
    standard_color: { fixedCost: 114, perPageCost: 4.5 },
    premium_color:  { fixedCost: 114, perPageCost: 8.0 },
  },
  // Amazon.ca (Canada)
  CA: {
    black_white:    { fixedCost: 1.10, perPageCost: 0.016 },
    standard_color: { fixedCost: 1.10, perPageCost: 0.046 },
    premium_color:  { fixedCost: 1.10, perPageCost: 0.085 },
  },
  // Amazon.com.au (Australia)
  AU: {
    black_white:    { fixedCost: 1.30, perPageCost: 0.018 },
    standard_color: { fixedCost: 1.30, perPageCost: 0.054 },
    premium_color:  { fixedCost: 1.30, perPageCost: 0.100 },
  },
};

/**
 * Calculate printing cost for a KDP paperback book.
 * @param pageCount - Number of pages
 * @param marketplace - Marketplace code (US, UK, DE, FR, ES, IT, JP, CA, AU)
 * @param inkType - Ink type (black_white, standard_color, premium_color)
 * @returns Printing cost in local currency, or null if marketplace not found
 */
export function calculatePrintingCost(
  pageCount: number,
  marketplace: string,
  inkType: InkType = 'black_white'
): number | null {
  const marketplaceUpper = marketplace.toUpperCase();
  const rates = PRINTING_COSTS[marketplaceUpper];

  if (!rates) {
    console.warn(`[PrintingCost] Unknown marketplace: ${marketplace}, falling back to US rates`);
    const usRates = PRINTING_COSTS['US'][inkType];
    return Math.round((usRates.fixedCost + usRates.perPageCost * pageCount) * 100) / 100;
  }

  const rate = rates[inkType];
  if (!rate) {
    console.warn(`[PrintingCost] Unknown ink type: ${inkType}, falling back to black_white`);
    const bwRate = rates['black_white'];
    return Math.round((bwRate.fixedCost + bwRate.perPageCost * pageCount) * 100) / 100;
  }

  return Math.round((rate.fixedCost + rate.perPageCost * pageCount) * 100) / 100;
}

/**
 * Parse a KDP price string like "$23.99 USD" or "€12.99 EUR" to a number.
 * Handles various formats: "$23.99", "23.99 USD", "€12,99", "¥1500"
 */
export function parseKdpPrice(priceStr: string | null | undefined): number | null {
  if (!priceStr) return null;

  // Remove currency symbols and codes
  const cleaned = priceStr
    .replace(/[£$€¥]/g, '')
    .replace(/\s*(USD|EUR|GBP|JPY|CAD|AUD)\s*/gi, '')
    .trim();

  // Handle European comma format (12,99) vs US dot format (12.99)
  // If both comma and dot exist, assume last separator is decimal
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // e.g., "1.234,56" → "1234.56"
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(normalized);
    return isNaN(val) ? null : val;
  }

  if (cleaned.includes(',') && !cleaned.includes('.')) {
    // e.g., "12,99" → "12.99"
    const normalized = cleaned.replace(',', '.');
    const val = parseFloat(normalized);
    return isNaN(val) ? null : val;
  }

  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

/**
 * Calculate FAST ACOS for a book given its data.
 * @returns { fastAcos, royalty, printingCost } or null if data insufficient
 */
export function calculateBookFastAcos(
  price: number,
  pageCount: number,
  marketplace: string,
  inkType: InkType = 'black_white',
  royaltyPercentage: number = 60
): { fastAcos: number; royalty: number; printingCost: number } | null {
  const printingCost = calculatePrintingCost(pageCount, marketplace, inkType);
  if (printingCost === null) return null;

  const royalty = (royaltyPercentage / 100 * price) - printingCost;
  if (royalty <= 0) return null;

  const fastAcos = (royalty / (price * 1.22)) * 100;

  return {
    fastAcos: Math.round(fastAcos * 100) / 100,
    royalty: Math.round(royalty * 100) / 100,
    printingCost,
  };
}
