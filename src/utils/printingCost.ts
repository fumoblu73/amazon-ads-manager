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
 * The formula depends on page count and ink type:
 *
 * For LOW page counts (below threshold): Printing Cost = Fixed Cost only
 * For HIGH page counts (above threshold): Printing Cost = Fixed Cost + (Per-Page Cost × Page Count)
 *
 * ============================================================================
 * PAGE COUNT THRESHOLDS BY INK TYPE
 * ============================================================================
 *
 * BLACK INK:
 *   - 24-108 pages: Fixed cost only (no per-page cost)
 *   - 110-828 pages: Fixed cost + per-page cost
 *
 * PREMIUM COLOR:
 *   - 24-40 pages: Fixed cost only (no per-page cost)
 *   - 42-828 pages: Fixed cost + per-page cost
 *
 * STANDARD COLOR:
 *   - 72-600 pages: Fixed cost + per-page cost (no fixed-only tier)
 *   - Note: Standard color is ONLY available for 72-600 pages
 *
 * ============================================================================
 * TRIM SIZES
 * ============================================================================
 *
 * REGULAR TRIM SIZES (up to 6.12" width × 9" height):
 *   - 5" × 8", 5.06" × 7.81", 5.25" × 8", 5.5" × 8.5"
 *   - 6" × 9", 6.14" × 9.21", 6.69" × 9.61"
 *
 * LARGE TRIM SIZES (more than 6.12" width or more than 9" height):
 *   - 7" × 10", 7.5" × 9.25", 8" × 10", 8.25" × 6"
 *   - 8.25" × 8.25", 8.5" × 8.5", 8.5" × 11", 8.27" × 11.69" (A4)
 *
 * ============================================================================
 * PRICING TABLES
 * ============================================================================
 *
 * See detailed tables below in the code comments for each ink type.
 */

export type InkType = 'black_white' | 'standard_color' | 'premium_color';

// Specific trim size dimensions
export type TrimSize = '5x8' | '6x9' | '8x10' | '8.5x8.5' | '8.5x11';

// Internal pricing tier (regular = smaller dimensions, large = larger dimensions)
type PricingTier = 'regular' | 'large';

// Map specific dimensions to pricing tier
const TRIM_SIZE_TO_TIER: Record<TrimSize, PricingTier> = {
  '5x8': 'regular',
  '6x9': 'regular',
  '8x10': 'large',
  '8.5x8.5': 'large',
  '8.5x11': 'large',
};

/**
 * Get the pricing tier for a given trim size dimension
 * Regular: 5x8, 6x9 (up to 6.12" width x 9" height)
 * Large: 8x10, 8.5x8.5, 8.5x11 (larger dimensions)
 */
export function getTrimPricingTier(trimSize: TrimSize): PricingTier {
  return TRIM_SIZE_TO_TIER[trimSize] || 'regular';
}

interface TierPricing {
  fixedCost: number;
  perPageCost: number; // 0 for fixed-only tiers
}

interface TrimSizePricing {
  regular: TierPricing;
  large: TierPricing;
}

interface InkTypePricing {
  lowTier: TrimSizePricing;  // Fixed cost only (for black_white and premium_color)
  highTier: TrimSizePricing; // Fixed + per-page cost
}

// Page count thresholds for each ink type
const PAGE_THRESHOLDS = {
  black_white: { lowMax: 108, highMin: 110, highMax: 828 },
  premium_color: { lowMax: 40, highMin: 42, highMax: 828 },
  standard_color: { lowMax: 0, highMin: 72, highMax: 600 }, // No low tier for standard color
};

/**
 * ============================================================================
 * BLACK INK PRICING
 * ============================================================================
 *
 * 24-108 pages (fixed cost only):
 * | Marketplace | Regular    | Large      |
 * |-------------|------------|------------|
 * | US          | $2.30      | $2.84      |
 * | UK          | £1.93      | £2.15      |
 * | EU          | €2.05      | €2.48      |
 * | CA          | $2.99 CAD  | $3.53 CAD  |
 * | AU          | $4.74 AUD  | $5.28 AUD  |
 * | JP          | ¥422       | ¥530       |
 * | PL          | 9.58 PLN   | 11.61 PLN  |
 * | SE          | 22.84 SEK  | 27.67 SEK  |
 *
 * 110-828 pages (fixed + per-page):
 * | Marketplace | Regular Fixed | Regular/Page | Large Fixed | Large/Page |
 * |-------------|---------------|--------------|-------------|------------|
 * | US          | $1.00         | $0.012       | $1.00       | $0.017     |
 * | UK          | £0.85         | £0.010       | £0.85       | £0.012     |
 * | EU          | €0.75         | €0.012       | €0.75       | €0.016     |
 * | CA          | $1.26 CAD     | $0.016 CAD   | $1.26 CAD   | $0.021 CAD |
 * | AU          | $2.42 AUD     | $0.022 AUD   | $2.42 AUD   | $0.027 AUD |
 * | JP          | ¥206          | ¥2           | ¥206        | ¥3         |
 * | PL          | 3.51 PLN      | 0.056 PLN    | 3.51 PLN    | 0.075 PLN  |
 * | SE          | 8.37 SEK      | 0.134 SEK    | 8.37 SEK    | 0.179 SEK  |
 */
const BLACK_WHITE_PRICING: Record<string, InkTypePricing> = {
  US: {
    lowTier: {
      regular: { fixedCost: 2.30, perPageCost: 0 },
      large: { fixedCost: 2.84, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 1.00, perPageCost: 0.012 },
      large: { fixedCost: 1.00, perPageCost: 0.017 },
    },
  },
  UK: {
    lowTier: {
      regular: { fixedCost: 1.93, perPageCost: 0 },
      large: { fixedCost: 2.15, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 0.85, perPageCost: 0.010 },
      large: { fixedCost: 0.85, perPageCost: 0.012 },
    },
  },
  // EU marketplaces (DE, ES, FR, IT, NL, IE, BE)
  DE: {
    lowTier: {
      regular: { fixedCost: 2.05, perPageCost: 0 },
      large: { fixedCost: 2.48, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 0.75, perPageCost: 0.012 },
      large: { fixedCost: 0.75, perPageCost: 0.016 },
    },
  },
  CA: {
    lowTier: {
      regular: { fixedCost: 2.99, perPageCost: 0 },
      large: { fixedCost: 3.53, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 1.26, perPageCost: 0.016 },
      large: { fixedCost: 1.26, perPageCost: 0.021 },
    },
  },
  AU: {
    lowTier: {
      regular: { fixedCost: 4.74, perPageCost: 0 },
      large: { fixedCost: 5.28, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 2.42, perPageCost: 0.022 },
      large: { fixedCost: 2.42, perPageCost: 0.027 },
    },
  },
  JP: {
    lowTier: {
      regular: { fixedCost: 422, perPageCost: 0 },
      large: { fixedCost: 530, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 206, perPageCost: 2 },
      large: { fixedCost: 206, perPageCost: 3 },
    },
  },
  PL: {
    lowTier: {
      regular: { fixedCost: 9.58, perPageCost: 0 },
      large: { fixedCost: 11.61, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 3.51, perPageCost: 0.056 },
      large: { fixedCost: 3.51, perPageCost: 0.075 },
    },
  },
  SE: {
    lowTier: {
      regular: { fixedCost: 22.84, perPageCost: 0 },
      large: { fixedCost: 27.67, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 8.37, perPageCost: 0.134 },
      large: { fixedCost: 8.37, perPageCost: 0.179 },
    },
  },
};

// Copy EU pricing to all EU marketplaces
BLACK_WHITE_PRICING.ES = BLACK_WHITE_PRICING.DE;
BLACK_WHITE_PRICING.FR = BLACK_WHITE_PRICING.DE;
BLACK_WHITE_PRICING.IT = BLACK_WHITE_PRICING.DE;
BLACK_WHITE_PRICING.NL = BLACK_WHITE_PRICING.DE;
BLACK_WHITE_PRICING.BE = BLACK_WHITE_PRICING.DE;
BLACK_WHITE_PRICING.IE = BLACK_WHITE_PRICING.DE;

/**
 * ============================================================================
 * PREMIUM COLOR PRICING
 * ============================================================================
 *
 * 24-40 pages (fixed cost only):
 * | Marketplace | Regular    | Large      |
 * |-------------|------------|------------|
 * | US          | $3.60      | $4.20      |
 * | UK          | £2.59      | £3.24      |
 * | EU          | €2.85      | €3.61      |
 * | CA          | $4.66 CAD  | $5.26 CAD  |
 * | AU          | $5.82 AUD  | $6.42 AUD  |
 * | JP          | ¥475       | ¥475       |
 * | PL          | 12.86 PLN  | 15.32 PLN  |
 * | SE          | 30.65 SEK  | 36.51 SEK  |
 *
 * 42-828 pages (fixed + per-page):
 * | Marketplace | Regular Fixed | Regular/Page | Large Fixed | Large/Page |
 * |-------------|---------------|--------------|-------------|------------|
 * | US          | $1.00         | $0.065       | $1.00       | $0.08      |
 * | UK          | £0.85         | £0.0435      | £0.85       | £0.0598    |
 * | EU          | €0.75         | €0.0525      | €0.75       | €0.0715    |
 * | CA          | $1.26 CAD     | $0.085 CAD   | $1.26 CAD   | $0.10 CAD  |
 * | AU          | $2.42 AUD     | $0.085 AUD   | $2.42 AUD   | $0.100 AUD |
 * | JP          | ¥206          | ¥4           | ¥206        | ¥5         |
 * | PL          | 3.51 PLN      | 0.267 PLN    | 3.51 PLN    | 0.337 PLN  |
 * | SE          | 8.37 SEK      | 0.636 SEK    | 8.37 SEK    | 0.804 SEK  |
 */
const PREMIUM_COLOR_PRICING: Record<string, InkTypePricing> = {
  US: {
    lowTier: {
      regular: { fixedCost: 3.60, perPageCost: 0 },
      large: { fixedCost: 4.20, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 1.00, perPageCost: 0.065 },
      large: { fixedCost: 1.00, perPageCost: 0.08 },
    },
  },
  UK: {
    lowTier: {
      regular: { fixedCost: 2.59, perPageCost: 0 },
      large: { fixedCost: 3.24, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 0.85, perPageCost: 0.0435 },
      large: { fixedCost: 0.85, perPageCost: 0.0598 },
    },
  },
  DE: {
    lowTier: {
      regular: { fixedCost: 2.85, perPageCost: 0 },
      large: { fixedCost: 3.61, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 0.75, perPageCost: 0.0525 },
      large: { fixedCost: 0.75, perPageCost: 0.0715 },
    },
  },
  CA: {
    lowTier: {
      regular: { fixedCost: 4.66, perPageCost: 0 },
      large: { fixedCost: 5.26, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 1.26, perPageCost: 0.085 },
      large: { fixedCost: 1.26, perPageCost: 0.10 },
    },
  },
  AU: {
    lowTier: {
      regular: { fixedCost: 5.82, perPageCost: 0 },
      large: { fixedCost: 6.42, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 2.42, perPageCost: 0.085 },
      large: { fixedCost: 2.42, perPageCost: 0.100 },
    },
  },
  JP: {
    lowTier: {
      regular: { fixedCost: 475, perPageCost: 0 },
      large: { fixedCost: 475, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 206, perPageCost: 4 },
      large: { fixedCost: 206, perPageCost: 5 },
    },
  },
  PL: {
    lowTier: {
      regular: { fixedCost: 12.86, perPageCost: 0 },
      large: { fixedCost: 15.32, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 3.51, perPageCost: 0.267 },
      large: { fixedCost: 3.51, perPageCost: 0.337 },
    },
  },
  SE: {
    lowTier: {
      regular: { fixedCost: 30.65, perPageCost: 0 },
      large: { fixedCost: 36.51, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 8.37, perPageCost: 0.636 },
      large: { fixedCost: 8.37, perPageCost: 0.804 },
    },
  },
};

// Copy EU pricing to all EU marketplaces
PREMIUM_COLOR_PRICING.ES = PREMIUM_COLOR_PRICING.DE;
PREMIUM_COLOR_PRICING.FR = PREMIUM_COLOR_PRICING.DE;
PREMIUM_COLOR_PRICING.IT = PREMIUM_COLOR_PRICING.DE;
PREMIUM_COLOR_PRICING.NL = PREMIUM_COLOR_PRICING.DE;
PREMIUM_COLOR_PRICING.BE = PREMIUM_COLOR_PRICING.DE;
PREMIUM_COLOR_PRICING.IE = PREMIUM_COLOR_PRICING.DE;

/**
 * ============================================================================
 * STANDARD COLOR PRICING
 * ============================================================================
 *
 * Note: Standard color has NO low tier (fixed-only).
 * It's only available for 72-600 pages with fixed + per-page cost.
 *
 * 72-600 pages (fixed + per-page):
 * | Marketplace | Regular Fixed | Regular/Page | Large Fixed | Large/Page |
 * |-------------|---------------|--------------|-------------|------------|
 * | US          | $1.00         | $0.0255      | $1.00       | $0.0402    |
 * | UK          | £0.85         | £0.020       | £0.85       | £0.027     |
 * | EU          | €0.75         | €0.024       | €0.75       | €0.035     |
 * | CA          | $1.26 CAD     | $0.037 CAD   | $1.26 CAD   | $0.052 CAD |
 * | PL          | 3.51 PLN      | 0.112 PLN    | 3.51 PLN    | 0.164 PLN  |
 * | SE          | 8.37 SEK      | 0.268 SEK    | 8.37 SEK    | 0.3691 SEK |
 *
 * Note: JP and AU are not listed for standard color in KDP tables
 */
const STANDARD_COLOR_PRICING: Record<string, InkTypePricing> = {
  US: {
    lowTier: {
      regular: { fixedCost: 0, perPageCost: 0 }, // Not applicable
      large: { fixedCost: 0, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 1.00, perPageCost: 0.0255 },
      large: { fixedCost: 1.00, perPageCost: 0.0402 },
    },
  },
  UK: {
    lowTier: {
      regular: { fixedCost: 0, perPageCost: 0 },
      large: { fixedCost: 0, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 0.85, perPageCost: 0.020 },
      large: { fixedCost: 0.85, perPageCost: 0.027 },
    },
  },
  DE: {
    lowTier: {
      regular: { fixedCost: 0, perPageCost: 0 },
      large: { fixedCost: 0, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 0.75, perPageCost: 0.024 },
      large: { fixedCost: 0.75, perPageCost: 0.035 },
    },
  },
  CA: {
    lowTier: {
      regular: { fixedCost: 0, perPageCost: 0 },
      large: { fixedCost: 0, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 1.26, perPageCost: 0.037 },
      large: { fixedCost: 1.26, perPageCost: 0.052 },
    },
  },
  PL: {
    lowTier: {
      regular: { fixedCost: 0, perPageCost: 0 },
      large: { fixedCost: 0, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 3.51, perPageCost: 0.112 },
      large: { fixedCost: 3.51, perPageCost: 0.164 },
    },
  },
  SE: {
    lowTier: {
      regular: { fixedCost: 0, perPageCost: 0 },
      large: { fixedCost: 0, perPageCost: 0 },
    },
    highTier: {
      regular: { fixedCost: 8.37, perPageCost: 0.268 },
      large: { fixedCost: 8.37, perPageCost: 0.3691 },
    },
  },
};

// Copy EU pricing to all EU marketplaces
STANDARD_COLOR_PRICING.ES = STANDARD_COLOR_PRICING.DE;
STANDARD_COLOR_PRICING.FR = STANDARD_COLOR_PRICING.DE;
STANDARD_COLOR_PRICING.IT = STANDARD_COLOR_PRICING.DE;
STANDARD_COLOR_PRICING.NL = STANDARD_COLOR_PRICING.DE;
STANDARD_COLOR_PRICING.BE = STANDARD_COLOR_PRICING.DE;
STANDARD_COLOR_PRICING.IE = STANDARD_COLOR_PRICING.DE;

// Get pricing table for ink type
function getPricingTable(inkType: InkType): Record<string, InkTypePricing> {
  switch (inkType) {
    case 'black_white':
      return BLACK_WHITE_PRICING;
    case 'premium_color':
      return PREMIUM_COLOR_PRICING;
    case 'standard_color':
      return STANDARD_COLOR_PRICING;
    default:
      return BLACK_WHITE_PRICING;
  }
}

/**
 * Calculate printing cost for a KDP paperback book.
 *
 * @param pageCount - Number of pages
 * @param marketplace - Marketplace code (US, UK, DE, FR, ES, IT, NL, PL, SE, JP, CA, AU)
 * @param inkType - Ink type (black_white, standard_color, premium_color)
 * @param trimSize - Trim size dimension (5x8, 6x9, 8x10, 8.5x8.5, 8.5x11). Defaults to '6x9'.
 * @returns Printing cost in local currency, or null if invalid parameters
 */
export function calculatePrintingCost(
  pageCount: number,
  marketplace: string,
  inkType: InkType = 'black_white',
  trimSize: TrimSize = '6x9'
): number | null {
  const marketplaceUpper = marketplace.toUpperCase();
  const thresholds = PAGE_THRESHOLDS[inkType];
  const pricingTable = getPricingTable(inkType);

  // Convert specific dimension to pricing tier (regular/large)
  const pricingTier = getTrimPricingTier(trimSize);

  // Validate page count
  if (pageCount < 24) {
    console.warn(`[PrintingCost] Page count ${pageCount} is below minimum (24)`);
    return null;
  }

  if (pageCount > thresholds.highMax) {
    console.warn(`[PrintingCost] Page count ${pageCount} exceeds maximum (${thresholds.highMax}) for ${inkType}`);
    return null;
  }

  // Standard color has no low tier
  if (inkType === 'standard_color' && pageCount < thresholds.highMin) {
    console.warn(`[PrintingCost] Standard color requires minimum ${thresholds.highMin} pages, got ${pageCount}`);
    return null;
  }

  // Get marketplace pricing, fall back to US
  let marketplacePricing = pricingTable[marketplaceUpper];
  if (!marketplacePricing) {
    console.warn(`[PrintingCost] Unknown marketplace: ${marketplace}, falling back to US rates`);
    marketplacePricing = pricingTable['US'];
  }

  // Determine which tier to use
  const isLowTier = pageCount <= thresholds.lowMax;
  const tierPricing = isLowTier ? marketplacePricing.lowTier : marketplacePricing.highTier;
  const pricing = tierPricing[pricingTier];

  // Calculate cost
  let cost: number;
  if (isLowTier || pricing.perPageCost === 0) {
    // Fixed cost only
    cost = pricing.fixedCost;
  } else {
    // Fixed cost + per-page cost
    cost = pricing.fixedCost + (pricing.perPageCost * pageCount);
  }

  return Math.round(cost * 100) / 100;
}

/**
 * Get the printing cost breakdown for display/debugging.
 */
export function getPrintingCostBreakdown(
  pageCount: number,
  marketplace: string,
  inkType: InkType = 'black_white',
  trimSize: TrimSize = '6x9'
): {
  tier: 'low' | 'high';
  fixedCost: number;
  perPageCost: number;
  totalPerPage: number;
  total: number;
} | null {
  const marketplaceUpper = marketplace.toUpperCase();
  const thresholds = PAGE_THRESHOLDS[inkType];
  const pricingTable = getPricingTable(inkType);
  const pricingTier = getTrimPricingTier(trimSize);

  if (pageCount < 24 || pageCount > thresholds.highMax) return null;
  if (inkType === 'standard_color' && pageCount < thresholds.highMin) return null;

  let marketplacePricing = pricingTable[marketplaceUpper] ?? pricingTable['US'];
  const isLowTier = pageCount <= thresholds.lowMax;
  const tierPricing = isLowTier ? marketplacePricing.lowTier : marketplacePricing.highTier;
  const pricing = tierPricing[pricingTier];

  const totalPerPage = pricing.perPageCost * pageCount;
  const total = Math.round((pricing.fixedCost + totalPerPage) * 100) / 100;

  return {
    tier: isLowTier ? 'low' : 'high',
    fixedCost: pricing.fixedCost,
    perPageCost: pricing.perPageCost,
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
 * @param marketplace - Marketplace code
 * @param inkType - Ink type (black_white, standard_color, premium_color)
 * @param royaltyPercentage - Royalty rate (default 60%)
 * @param vatSettings - VAT configuration for the calculation
 * @param trimSize - Trim size dimension (5x8, 6x9, 8x10, 8.5x8.5, 8.5x11). Defaults to '6x9'.
 * @returns { fastAcos, royalty, printingCost } or null if data insufficient
 */
export function calculateBookFastAcos(
  price: number,
  pageCount: number,
  marketplace: string,
  inkType: InkType = 'black_white',
  royaltyPercentage: number = 60,
  vatSettings: VatSettings = { useVat: true, vatPercentage: 22 },
  trimSize: TrimSize = '6x9'
): { fastAcos: number; royalty: number; printingCost: number } | null {
  const printingCost = calculatePrintingCost(pageCount, marketplace, inkType, trimSize);
  if (printingCost === null) return null;

  const royalty = (royaltyPercentage / 100 * price) - printingCost;
  if (royalty <= 0) return null;

  // Calculate FAST ACOS based on VAT settings
  let fastAcos: number;
  if (vatSettings.useVat) {
    const vatMultiplier = 1 + (vatSettings.vatPercentage / 100);
    fastAcos = (royalty / (price * vatMultiplier)) * 100;
  } else {
    fastAcos = (royalty / price) * 100;
  }

  return {
    fastAcos: Math.round(fastAcos * 100) / 100,
    royalty: Math.round(royalty * 100) / 100,
    printingCost,
  };
}

// Export thresholds for reference
export const PAGE_COUNT_LIMITS = PAGE_THRESHOLDS;
