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
  marketplace: string;
  name: string;
  state: 'enabled' | 'paused' | 'archived';
  dailyBudget: number;
  campaignType: string;
  biddingStrategy: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  profileId: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  accountName: string;
  marketplaceId: string;
  type: string;
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
