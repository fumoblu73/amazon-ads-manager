// ================================================
// TYPES - Amazon Ads Manager Frontend
// ================================================

export interface Book {
  id: string;
  asin: string;
  title: string;
  price: number;
  printingCost: number;
  royaltyPercentage: number;
  fastAcos: number;
  marketplace: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  amazonCampaignId: string;
  name: string;
  state: 'enabled' | 'paused' | 'archived';
  dailyBudget: number;
  campaignType: string;
  biddingStrategy: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id: string;
  action: string;
  targetId: string;
  targetName: string;
  oldValue?: number;
  newValue?: number;
  reason?: string;
  ruleName: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  bookAsin?: string | null;
  bookTitle?: string | null;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  total?: number;
  page?: number;
  totalPages?: number;
  error?: string;
  details?: string;
}

export interface CampaignStats {
  total: number;
  byState: {
    enabled: number;
    paused: number;
    archived: number;
  };
  totalDailyBudget: number;
}

export interface LogStats {
  total: number;
  byStatus: {
    success: number;
    failed: number;
    successRate: number;
  };
  byAction: Record<string, number>;
  byRule: Record<string, number>;
  period: {
    from: string;
    to: string;
  };
}

export interface AutomationStatus {
  scheduler: {
    isRunning: boolean;
    activeTasks: number;
    triggerMethod: string;
    config: {
      func1and3_schedule: string;
      func1and3_enabled: boolean;
      func2and4and5_schedule: string;
      func2and4and5_enabled: boolean;
    };
    lastExecutionTimes: Record<string, string>;
    nextScheduledRuns: Record<string, string>;
  };
  lastExecution: {
    startedAt: string | null;
    completedAt: string | null;
    status: string;
    error: string | null;
    isRunning: boolean;
    duration: number | null;
  };
  currentTime: string;
}

// ================================================
// KDP ANALYTICS TYPES
// ================================================

export type InkType = 'black_white' | 'standard_color' | 'premium_color';
export type TrimSize = '5x8' | '6x9' | '8x10' | '8.5x8.5' | '8.5x11';

export interface KdpBook {
  id: string;
  userId: string;
  asin: string;
  title: string;
  marketplace: string;
  format?: string;
  author?: string;
  publishDate?: string;
  price?: string;
  coverUrl?: string;
  bsrRank?: number;
  bsrCategory?: string;
  pageCount?: number;
  inkType?: InkType;
  trimSize?: TrimSize;
  royaltyPercentage?: number;
  kenpc?: number;
  lastSyncDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KdpDailyStats {
  id: string;
  bookId: string;
  date: string;
  // Sales data
  ebookSales?: number;
  paperbackSales?: number;
  hardcoverSales?: number;
  // Royalties
  ebookRoyalties?: number;
  paperbackRoyalties?: number;
  hardcoverRoyalties?: number;
  // KENP data
  kenpReads?: number;
  kenpRoyalties?: number;
  // Ad data
  adSpend?: number;
  adClicks?: number;
  adImpressions?: number;
  // BSR
  bsr?: number;
  // Free units
  freeUnits?: number;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEvent {
  id: string;
  userId: string;
  bookId?: string;
  eventDate: string;
  title: string;
  description?: string;
  category: EventCategory;
  createdAt: string;
  updatedAt: string;
}

export type EventCategory =
  | 'price_change'
  | 'ad_launch'
  | 'ad_pause'
  | 'promo'
  | 'republish'
  | 'milestone'
  | 'review'
  | 'other';

export interface EventCategoryMeta {
  value: EventCategory;
  label: string;
  icon: string;
  color: string;
}

// KDP Analytics Responses

export interface RoiAnalytics {
  bookId: string;
  bookTitle: string;
  asin: string;
  marketplace: string;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalRoyalties: number;
    totalAdSpend: number;
    netProfit: number;
    averageROI: number | null;
    averageACoS: number | null;
    totalSales: number;
    totalKenpReads: number;
    averageBSR: number | null;
  };
  dailyData: Array<{
    date: string;
    royalties: number;
    adSpend: number;
    netProfit: number;
    roi: number | null;
    acos: number | null;
    sales: number;
    kenpReads: number;
    bsr: number | null;
  }>;
}

export interface BsrStatistics {
  currentBsr: number | null;
  lowestBsr: number | null;
  highestBsr: number | null;
  averageBsr: number | null;
  medianBsr: number | null;
  trend: 'improving' | 'declining' | 'stable' | 'no_data';
  trendPercentage: number | null;
  daysTracked: number;
  daysWithoutData: number;
}

export interface BsrCorrelation {
  correlation: number;
  interpretation: string;
  adSpendImpact: 'positive' | 'negative' | 'neutral' | 'insufficient_data';
  averageAdSpend: number;
  averageBsrWhenSpending: number | null;
  averageBsrWhenNotSpending: number | null;
}

export interface BsrDataPoint {
  date: string;
  bsr: number | null;
  adSpend: number;
  sales: number;
}

export interface BsrAnalysis {
  bookId: string;
  bookTitle: string;
  asin: string;
  marketplace: string;
  period: {
    startDate: string;
    endDate: string;
  };
  statistics: BsrStatistics;
  correlation: BsrCorrelation;
  history: BsrDataPoint[];
}

// KDP Dashboard Types (Publisher Champ style)

interface MonthStats {
  label: string;
  adOrders: number;
  paperbacks: number;
  reads: number;
  grossRoyalties: number;
  spending: number;
  netRoyalties: number;
  overallROI: number | null;
  amsROI: number | null;
  amsACoS: number | null;
}

interface DayStats {
  label: string;
  adOrders: number;
  paperbacks: number;
  reads: number;
  grossRoyalties: number;
  spending: number;
  netRoyalties: number;
  overallROI: number | null;
  amsROI: number | null;
  amsACoS: number | null;
}

interface StatsChange {
  adOrders: number | null;
  paperbacks: number | null;
  reads: number | null;
  grossRoyalties: number | null;
  spending: number | null;
  netRoyalties: number | null;
}

interface TopEarner {
  bookId: string;
  title: string;
  asin: string;
  royalties: number;
  spending?: number;
  coverUrl?: string | null;
  bsrRank?: number | null;
}

interface MonthlyChartDataPoint {
  month: string;
  label: string;
  royalties: number;
  spending: number;
}

interface DailyChartDataPoint {
  date: string;
  label: string;
  royalties: number;
  spending: number;
}

export interface KdpDashboardSummary {
  period: {
    startDate: string;
    endDate: string;
    label?: string;
  };
  overall: {
    monthlyStats: {
      previousMonth: MonthStats;
      currentMonth: MonthStats;
      change: StatsChange;
    };
    dailyStats: {
      yesterday: DayStats;
      today: DayStats;
      change: StatsChange;
    };
  };
  widgets: {
    grossRoyaltiesEstimator: number;
    netRoyaltiesThisMonth: number;
    todayNetRoyalties: number;
    yesterdayNetRoyalties: number;
    kenpReadsThisMonth: number;
    totalLiveBooks: number;
    dailyAvgGrossRoyalties: number;
    dailyAvgNetRoyalties: number;
    estimatedProjection: number;
    bookSalesThisMonth: number;
    organicOrders: number;
    inorganicOrders: number;
    preOrders: number;
    royaltiesChange?: number | null;
    ordersChange?: number | null;
  };
  topEarners: {
    previousMonth: TopEarner[];
    currentMonth: TopEarner[];
  };
  charts?: {
    monthly: {
      label: string;
      data: MonthlyChartDataPoint[];
    };
    daily?: {
      label: string;
      data: DailyChartDataPoint[];
    };
  };
  snapshotInfo?: {
    id: string;
    createdAt: string;
    source: string;
    currency: string;
    totalRoyalties: number;
    printOrders: number;
    digitalOrders: number;
  } | null;
}

// Historical Stats Types

export interface HistoricalStatsData {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalGrossRoyalties: number;
    totalSpending: number;
    totalNetRoyalties: number;
    totalFreeUnits: number;
    totalPaidUnits: number;
    totalReads: number;
  };
  bestMonth: string | null;
  chartData: Array<{
    date: string;
    spending: number;
    royalties: number;
  }>;
  books: Array<{
    id: string;
    image?: string;
    title: string;
    asin: string;
    grossRoyalties: number;
    spending: number;
    netRoyalties: number;
  }>;
}

// Book Stats Types

export interface BookStatsData {
  period: {
    startDate: string;
    endDate: string;
  };
  totalNetRoyalties: number;
  bestDate: string | null;
  chartData: Array<{
    date: string;
    value: number;
  }>;
  books: Array<{
    cover?: string;
    title: string;
    asin: string;
    series?: string;
    paperbacks: number;
    distribution: string;
    hardcover: number;
    ebooksPaid: number;
    ebooksFree: number;
    audiobooks: number;
    adOrders: number;
    adClicks: number;
    reads: number;
    grossRoyalties: number;
    spending: number;
  }>;
}

// Country Stats Types

export interface CountryStatsData {
  period: {
    startDate: string;
    endDate: string;
  };
  totalGlobal: {
    gross: number;
    overallROI: number | null;
    overallROAS: number | null;
    amsROI: number | null;
    amsROAS: number | null;
  };
  chartData: Array<{
    date: string;
    [marketplace: string]: number | string;
  }>;
  countriesData: Array<{
    marketplace: string;
    countryName: string;
    royalties: number;
    spending: number;
    sales: number;
  }>;
}

// Month Comparison Types

export interface MonthComparisonData {
  month1: string;
  month2: string;
  chartData: Array<{
    day: number;
    month1Value: number;
    month2Value: number;
  }>;
  comparisonTable: {
    royaltyGross: {
      month1: number;
      month2: number;
      change: number;
    };
    spending: {
      month1: number;
      month2: number;
      change: number;
    };
    royaltyNet: {
      month1: number;
      month2: number;
      change: number;
    };
    overallROI: {
      month1: number | null;
      month2: number | null;
      change: number | null;
    };
    amsROI: {
      month1: number | null;
      month2: number | null;
      change: number | null;
    };
    amsACoS: {
      month1: number | null;
      month2: number | null;
      change: number | null;
    };
  };
}

// Amazon Ads Summary
export interface AmazonAdsSummary {
  totalSpendUSD: number;
  totalSalesUSD: number;
  overallAcos: number | null;
  overallRoas: number | null;
  marketplaces: Array<{
    marketplace: string;
    spend: number;
    sales: number;
    acos: number | null;
  }>;
}

// Filter Types

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
  timePeriod?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';
}

export interface BookshelfFilters {
  authors?: string[];
  tags?: string[];
  series?: string[];
  formats?: string[];
  status?: 'all' | 'active' | 'archived';
  search?: string;
  page?: number;
  limit?: number;
}
