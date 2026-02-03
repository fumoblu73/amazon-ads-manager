/**
 * ============================================================================
 * KDP PRINTING COST CALCULATOR
 * ============================================================================
 *
 * Official Amazon KDP pricing documentation:
 * https://kdp.amazon.com/en_US/help/topic/G201834340
 *
 * ============================================================================
 * FORMULA
 * ============================================================================
 *
 * Printing Cost = Fixed Cost + (Per-Page Cost × Page Count)
 *
 * Example: US marketplace, black & white ink, 200 pages
 *   $0.85 + ($0.012 × 200) = $0.85 + $2.40 = $3.25
 *
 * ============================================================================
 * FACTORS AFFECTING PRINTING COST
 * ============================================================================
 *
 * 1. INK TYPE
 *    - Black & white (interior): White paper or cream paper
 *    - Standard color: Available only for 72-600 pages
 *    - Premium color: Higher quality color printing
 *
 * 2. TRIM SIZE (Book dimensions)
 *    Regular trim sizes have lower costs than large trim sizes.
 *
 *    REGULAR TRIM SIZES (inches):
 *    - 5" × 8"      (min 24 pages, max 828 pages)
 *    - 5.06" × 7.81" (min 24 pages, max 828 pages)
 *    - 5.25" × 8"   (min 24 pages, max 828 pages)
 *    - 5.5" × 8.5"  (min 24 pages, max 828 pages)
 *    - 6" × 9"      (min 24 pages, max 828 pages)
 *    - 6.14" × 9.21" (min 24 pages, max 828 pages)
 *    - 6.69" × 9.61" (min 24 pages, max 600 pages) - Standard color only
 *
 *    LARGE TRIM SIZES (inches):
 *    - 7" × 10"     (min 24 pages, max 500 pages)
 *    - 7.5" × 9.25" (min 24 pages, max 500 pages)
 *    - 8" × 10"     (min 24 pages, max 500 pages)
 *    - 8.25" × 6"   (min 24 pages, max 500 pages)
 *    - 8.25" × 8.25" (min 24 pages, max 500 pages)
 *    - 8.5" × 8.5"  (min 24 pages, max 500 pages)
 *    - 8.5" × 11"   (min 24 pages, max 500 pages)
 *    - 8.27" × 11.69" (A4) (min 24 pages, max 500 pages)
 *
 * 3. PAGE COUNT
 *    - Minimum: 24 pages (all formats)
 *    - Maximum varies by trim size and ink type (see above)
 *    - Standard color: ONLY available for 72-600 pages
 *
 * 4. MARKETPLACE
 *    Different Amazon marketplaces have different printing costs.
 *    Prices below are in local currency.
 *
 * ============================================================================
 * COMPLETE PRICING TABLES BY MARKETPLACE
 * ============================================================================
 *
 * AMAZON.COM (US) - USD
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ $0.85+$0.012│ $0.85+$0.036  │ $0.85+$0.065  │
 * │ Large           │ $0.85+$0.012│ $0.85+$0.036  │ $0.85+$0.065  │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.CO.UK (UK) - GBP
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ £0.70+£0.010│ £0.70+£0.030  │ £0.70+£0.055  │
 * │ Large           │ £0.85+£0.012│ £0.85+£0.036  │ £0.85+£0.070  │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.DE (Germany) - EUR
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ €0.60+€0.012│ €0.60+€0.036  │ €0.60+€0.065  │
 * │ Large           │ €0.75+€0.014│ €0.75+€0.042  │ €0.75+€0.075  │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.FR (France) - EUR
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ €0.60+€0.012│ €0.60+€0.036  │ €0.60+€0.065  │
 * │ Large           │ €0.75+€0.014│ €0.75+€0.042  │ €0.75+€0.075  │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.ES (Spain) - EUR
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ €0.60+€0.012│ €0.60+€0.036  │ €0.60+€0.065  │
 * │ Large           │ €0.75+€0.014│ €0.75+€0.042  │ €0.75+€0.075  │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.IT (Italy) - EUR
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ €0.60+€0.012│ €0.60+€0.036  │ €0.60+€0.065  │
 * │ Large           │ €0.75+€0.014│ €0.75+€0.042  │ €0.75+€0.075  │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.NL (Netherlands) - EUR
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ €0.60+€0.012│ €0.60+€0.036  │ €0.60+€0.065  │
 * │ Large           │ €0.75+€0.014│ €0.75+€0.042  │ €0.75+€0.075  │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.PL (Poland) - PLN
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ 2.90+0.05zł │ 2.90+0.15zł   │ 2.90+0.26zł   │
 * │ Large           │ 3.50+0.06zł │ 3.50+0.18zł   │ 3.50+0.32zł   │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.SE (Sweden) - SEK
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ 7.00+0.12kr │ 7.00+0.37kr   │ 7.00+0.66kr   │
 * │ Large           │ 8.50+0.15kr │ 8.50+0.44kr   │ 8.50+0.80kr   │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.CO.JP (Japan) - JPY
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ ¥114+¥1.5   │ ¥114+¥4.5     │ ¥114+¥8.0     │
 * │ Large           │ ¥140+¥1.8   │ ¥140+¥5.5     │ ¥140+¥10.0    │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.CA (Canada) - CAD
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ $1.10+$0.016│ $1.10+$0.046  │ $1.10+$0.085  │
 * │ Large           │ $1.35+$0.019│ $1.35+$0.055  │ $1.35+$0.100  │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * AMAZON.COM.AU (Australia) - AUD
 * ┌─────────────────┬─────────────┬───────────────┬───────────────┐
 * │ Trim Size       │ Black/White │ Standard Color│ Premium Color │
 * ├─────────────────┼─────────────┼───────────────┼───────────────┤
 * │ Regular         │ $1.30+$0.018│ $1.30+$0.054  │ $1.30+$0.100  │
 * │ Large           │ $1.60+$0.022│ $1.60+$0.065  │ $1.60+$0.120  │
 * └─────────────────┴─────────────┴───────────────┴───────────────┘
 *
 * ============================================================================
 * ROYALTY CALCULATION
 * ============================================================================
 *
 * Royalty = (Royalty Rate × List Price) - Printing Cost
 *
 * Royalty rates:
 * - 60% for most territories (US, UK, DE, FR, ES, IT, etc.)
 * - 40% for expanded distribution
 *
 * ============================================================================
 * FAST ACOS CALCULATION
 * ============================================================================
 *
 * FAST ACOS = (Royalty / Price) × 100
 *
 * With VAT consideration (for European markets):
 * FAST ACOS = (Royalty / (Price × (1 + VAT/100))) × 100
 *
 * Example: €15 book, 100 pages, Italy (22% VAT)
 *   Printing Cost = €0.60 + (€0.012 × 100) = €1.80
 *   Royalty = (60% × €15) - €1.80 = €9.00 - €1.80 = €7.20
 *   FAST ACOS (with VAT) = (€7.20 / (€15 × 1.22)) × 100 = 39.34%
 *   FAST ACOS (no VAT) = (€7.20 / €15) × 100 = 48%
 *
 * ============================================================================
 * NOTES FOR THIS APPLICATION
 * ============================================================================
 *
 * Current implementation uses REGULAR trim size rates as default.
 * KDP books scraped from bookshelf don't include trim size information,
 * so we assume regular trim (most common for KDP authors).
 *
 * Future enhancement: Add trim size to KdpBook entity if needed for
 * more accurate calculations with large-format books.
 */

export type InkType = 'black_white' | 'standard_color' | 'premium_color';
export type TrimSize = 'regular' | 'large';

interface PrintingCostRate {
  fixedCost: number;
  perPageCost: number;
}

interface MarketplacePricing {
  regular: Record<InkType, PrintingCostRate>;
  large: Record<InkType, PrintingCostRate>;
}

// Complete KDP printing cost tables per marketplace, trim size, and ink type
// Source: https://kdp.amazon.com/en_US/help/topic/G201834340
const PRINTING_COSTS: Record<string, MarketplacePricing> = {
  // Amazon.com (US) - USD
  US: {
    regular: {
      black_white:    { fixedCost: 0.85, perPageCost: 0.012 },
      standard_color: { fixedCost: 0.85, perPageCost: 0.036 },
      premium_color:  { fixedCost: 0.85, perPageCost: 0.065 },
    },
    large: {
      black_white:    { fixedCost: 0.85, perPageCost: 0.012 },
      standard_color: { fixedCost: 0.85, perPageCost: 0.036 },
      premium_color:  { fixedCost: 0.85, perPageCost: 0.065 },
    },
  },
  // Amazon.co.uk (UK) - GBP
  UK: {
    regular: {
      black_white:    { fixedCost: 0.70, perPageCost: 0.010 },
      standard_color: { fixedCost: 0.70, perPageCost: 0.030 },
      premium_color:  { fixedCost: 0.70, perPageCost: 0.055 },
    },
    large: {
      black_white:    { fixedCost: 0.85, perPageCost: 0.012 },
      standard_color: { fixedCost: 0.85, perPageCost: 0.036 },
      premium_color:  { fixedCost: 0.85, perPageCost: 0.070 },
    },
  },
  // Amazon.de (Germany) - EUR
  DE: {
    regular: {
      black_white:    { fixedCost: 0.60, perPageCost: 0.012 },
      standard_color: { fixedCost: 0.60, perPageCost: 0.036 },
      premium_color:  { fixedCost: 0.60, perPageCost: 0.065 },
    },
    large: {
      black_white:    { fixedCost: 0.75, perPageCost: 0.014 },
      standard_color: { fixedCost: 0.75, perPageCost: 0.042 },
      premium_color:  { fixedCost: 0.75, perPageCost: 0.075 },
    },
  },
  // Amazon.fr (France) - EUR
  FR: {
    regular: {
      black_white:    { fixedCost: 0.60, perPageCost: 0.012 },
      standard_color: { fixedCost: 0.60, perPageCost: 0.036 },
      premium_color:  { fixedCost: 0.60, perPageCost: 0.065 },
    },
    large: {
      black_white:    { fixedCost: 0.75, perPageCost: 0.014 },
      standard_color: { fixedCost: 0.75, perPageCost: 0.042 },
      premium_color:  { fixedCost: 0.75, perPageCost: 0.075 },
    },
  },
  // Amazon.es (Spain) - EUR
  ES: {
    regular: {
      black_white:    { fixedCost: 0.60, perPageCost: 0.012 },
      standard_color: { fixedCost: 0.60, perPageCost: 0.036 },
      premium_color:  { fixedCost: 0.60, perPageCost: 0.065 },
    },
    large: {
      black_white:    { fixedCost: 0.75, perPageCost: 0.014 },
      standard_color: { fixedCost: 0.75, perPageCost: 0.042 },
      premium_color:  { fixedCost: 0.75, perPageCost: 0.075 },
    },
  },
  // Amazon.it (Italy) - EUR
  IT: {
    regular: {
      black_white:    { fixedCost: 0.60, perPageCost: 0.012 },
      standard_color: { fixedCost: 0.60, perPageCost: 0.036 },
      premium_color:  { fixedCost: 0.60, perPageCost: 0.065 },
    },
    large: {
      black_white:    { fixedCost: 0.75, perPageCost: 0.014 },
      standard_color: { fixedCost: 0.75, perPageCost: 0.042 },
      premium_color:  { fixedCost: 0.75, perPageCost: 0.075 },
    },
  },
  // Amazon.nl (Netherlands) - EUR
  NL: {
    regular: {
      black_white:    { fixedCost: 0.60, perPageCost: 0.012 },
      standard_color: { fixedCost: 0.60, perPageCost: 0.036 },
      premium_color:  { fixedCost: 0.60, perPageCost: 0.065 },
    },
    large: {
      black_white:    { fixedCost: 0.75, perPageCost: 0.014 },
      standard_color: { fixedCost: 0.75, perPageCost: 0.042 },
      premium_color:  { fixedCost: 0.75, perPageCost: 0.075 },
    },
  },
  // Amazon.pl (Poland) - PLN
  PL: {
    regular: {
      black_white:    { fixedCost: 2.90, perPageCost: 0.05 },
      standard_color: { fixedCost: 2.90, perPageCost: 0.15 },
      premium_color:  { fixedCost: 2.90, perPageCost: 0.26 },
    },
    large: {
      black_white:    { fixedCost: 3.50, perPageCost: 0.06 },
      standard_color: { fixedCost: 3.50, perPageCost: 0.18 },
      premium_color:  { fixedCost: 3.50, perPageCost: 0.32 },
    },
  },
  // Amazon.se (Sweden) - SEK
  SE: {
    regular: {
      black_white:    { fixedCost: 7.00, perPageCost: 0.12 },
      standard_color: { fixedCost: 7.00, perPageCost: 0.37 },
      premium_color:  { fixedCost: 7.00, perPageCost: 0.66 },
    },
    large: {
      black_white:    { fixedCost: 8.50, perPageCost: 0.15 },
      standard_color: { fixedCost: 8.50, perPageCost: 0.44 },
      premium_color:  { fixedCost: 8.50, perPageCost: 0.80 },
    },
  },
  // Amazon.co.jp (Japan) - JPY
  JP: {
    regular: {
      black_white:    { fixedCost: 114, perPageCost: 1.5 },
      standard_color: { fixedCost: 114, perPageCost: 4.5 },
      premium_color:  { fixedCost: 114, perPageCost: 8.0 },
    },
    large: {
      black_white:    { fixedCost: 140, perPageCost: 1.8 },
      standard_color: { fixedCost: 140, perPageCost: 5.5 },
      premium_color:  { fixedCost: 140, perPageCost: 10.0 },
    },
  },
  // Amazon.ca (Canada) - CAD
  CA: {
    regular: {
      black_white:    { fixedCost: 1.10, perPageCost: 0.016 },
      standard_color: { fixedCost: 1.10, perPageCost: 0.046 },
      premium_color:  { fixedCost: 1.10, perPageCost: 0.085 },
    },
    large: {
      black_white:    { fixedCost: 1.35, perPageCost: 0.019 },
      standard_color: { fixedCost: 1.35, perPageCost: 0.055 },
      premium_color:  { fixedCost: 1.35, perPageCost: 0.100 },
    },
  },
  // Amazon.com.au (Australia) - AUD
  AU: {
    regular: {
      black_white:    { fixedCost: 1.30, perPageCost: 0.018 },
      standard_color: { fixedCost: 1.30, perPageCost: 0.054 },
      premium_color:  { fixedCost: 1.30, perPageCost: 0.100 },
    },
    large: {
      black_white:    { fixedCost: 1.60, perPageCost: 0.022 },
      standard_color: { fixedCost: 1.60, perPageCost: 0.065 },
      premium_color:  { fixedCost: 1.60, perPageCost: 0.120 },
    },
  },
};

// Page count limits per format
export const PAGE_COUNT_LIMITS = {
  standard_color: { min: 72, max: 600 }, // Standard color has restricted page range
  regular_trim: { min: 24, max: 828 },
  large_trim: { min: 24, max: 500 },
};

/**
 * Calculate printing cost for a KDP paperback book.
 *
 * @param pageCount - Number of pages
 * @param marketplace - Marketplace code (US, UK, DE, FR, ES, IT, NL, PL, SE, JP, CA, AU)
 * @param inkType - Ink type (black_white, standard_color, premium_color)
 * @param trimSize - Trim size (regular, large). Defaults to 'regular' as most KDP books use regular trim.
 * @returns Printing cost in local currency, or null if marketplace not found
 */
export function calculatePrintingCost(
  pageCount: number,
  marketplace: string,
  inkType: InkType = 'black_white',
  trimSize: TrimSize = 'regular'
): number | null {
  const marketplaceUpper = marketplace.toUpperCase();
  const marketplacePricing = PRINTING_COSTS[marketplaceUpper];

  if (!marketplacePricing) {
    console.warn(`[PrintingCost] Unknown marketplace: ${marketplace}, falling back to US rates`);
    const usRates = PRINTING_COSTS['US'][trimSize][inkType];
    return Math.round((usRates.fixedCost + usRates.perPageCost * pageCount) * 100) / 100;
  }

  const rates = marketplacePricing[trimSize];
  if (!rates) {
    console.warn(`[PrintingCost] Unknown trim size: ${trimSize}, falling back to regular`);
    const regularRates = marketplacePricing['regular'][inkType];
    return Math.round((regularRates.fixedCost + regularRates.perPageCost * pageCount) * 100) / 100;
  }

  const rate = rates[inkType];
  if (!rate) {
    console.warn(`[PrintingCost] Unknown ink type: ${inkType}, falling back to black_white`);
    const bwRate = rates['black_white'];
    return Math.round((bwRate.fixedCost + bwRate.perPageCost * pageCount) * 100) / 100;
  }

  // Validate page count for standard color
  if (inkType === 'standard_color') {
    const { min, max } = PAGE_COUNT_LIMITS.standard_color;
    if (pageCount < min || pageCount > max) {
      console.warn(`[PrintingCost] Standard color only available for ${min}-${max} pages, got ${pageCount}`);
    }
  }

  return Math.round((rate.fixedCost + rate.perPageCost * pageCount) * 100) / 100;
}

/**
 * Get the printing cost breakdown for display/debugging.
 */
export function getPrintingCostBreakdown(
  pageCount: number,
  marketplace: string,
  inkType: InkType = 'black_white',
  trimSize: TrimSize = 'regular'
): { fixedCost: number; perPageCost: number; totalPerPage: number; total: number } | null {
  const marketplaceUpper = marketplace.toUpperCase();
  const marketplacePricing = PRINTING_COSTS[marketplaceUpper] ?? PRINTING_COSTS['US'];
  const rates = marketplacePricing[trimSize] ?? marketplacePricing['regular'];
  const rate = rates[inkType] ?? rates['black_white'];

  const totalPerPage = rate.perPageCost * pageCount;
  const total = Math.round((rate.fixedCost + totalPerPage) * 100) / 100;

  return {
    fixedCost: rate.fixedCost,
    perPageCost: rate.perPageCost,
    totalPerPage: Math.round(totalPerPage * 100) / 100,
    total,
  };
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
    .replace(/\s*(USD|EUR|GBP|JPY|CAD|AUD|PLN|SEK)\s*/gi, '')
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
 * VAT settings for FAST ACOS calculation
 */
export interface VatSettings {
  useVat: boolean;
  vatPercentage: number; // e.g., 22 for 22%
}

/**
 * Calculate FAST ACOS for a book given its data.
 *
 * Royalty = (Royalty% × Price) - Printing Cost
 *
 * With VAT:    FAST ACOS = (Royalty / (Price × (1 + VAT/100))) × 100
 * Without VAT: FAST ACOS = (Royalty / Price) × 100
 *
 * @param price - Book list price in local currency
 * @param pageCount - Number of pages
 * @param marketplace - Marketplace code (US, UK, DE, FR, ES, IT, JP, CA, AU, etc.)
 * @param inkType - Ink type (black_white, standard_color, premium_color)
 * @param royaltyPercentage - Royalty rate (default 60%)
 * @param vatSettings - VAT configuration for the calculation
 * @param trimSize - Trim size (regular, large). Defaults to 'regular'.
 * @returns { fastAcos, royalty, printingCost } or null if data insufficient
 */
export function calculateBookFastAcos(
  price: number,
  pageCount: number,
  marketplace: string,
  inkType: InkType = 'black_white',
  royaltyPercentage: number = 60,
  vatSettings: VatSettings = { useVat: true, vatPercentage: 22 },
  trimSize: TrimSize = 'regular'
): { fastAcos: number; royalty: number; printingCost: number } | null {
  const printingCost = calculatePrintingCost(pageCount, marketplace, inkType, trimSize);
  if (printingCost === null) return null;

  const royalty = (royaltyPercentage / 100 * price) - printingCost;
  if (royalty <= 0) return null;

  // Calculate FAST ACOS based on VAT settings
  let fastAcos: number;
  if (vatSettings.useVat) {
    // With VAT: FAST ACOS = (royalty / (price × (1 + VAT/100))) × 100
    const vatMultiplier = 1 + (vatSettings.vatPercentage / 100);
    fastAcos = (royalty / (price * vatMultiplier)) * 100;
  } else {
    // Without VAT: FAST ACOS = (royalty / price) × 100
    fastAcos = (royalty / price) * 100;
  }

  return {
    fastAcos: Math.round(fastAcos * 100) / 100,
    royalty: Math.round(royalty * 100) / 100,
    printingCost,
  };
}
