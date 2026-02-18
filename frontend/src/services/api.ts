import axios from 'axios';
import type {
  ApiResponse,
  Book,
  Campaign,
  AutomationLog,
  CampaignStats,
  LogStats,
  AutomationStatus,
  AmazonAdsSummary,
  KdpBook,
  JournalEvent,
  EventCategoryMeta,
  RoiAnalytics,
  BsrAnalysis,
  KdpDashboardSummary,
  HistoricalStatsData,
  BookStatsData,
  CountryStatsData,
  MonthComparisonData,
  BookshelfFilters
} from '../types';

// In production, use relative paths (same domain). In development, use localhost backend
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

// Debug log
console.log('🔗 API Base URL:', API_BASE_URL);
console.log('🔧 Production mode:', import.meta.env.PROD);

// Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
  withCredentials: true, // Include cookies for authentication
});

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
    } else if (error.response) {
      console.error('Server error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network error - no response received:', error.message);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// ================================================
// BOOKS API
// ================================================

export const booksApi = {
  getAll: async () => {
    const response = await apiClient.get<ApiResponse<Book[]>>('/api/books');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<ApiResponse<Book>>(`/api/books/${id}`);
    return response.data;
  },

  getByAsin: async (asin: string) => {
    const response = await apiClient.get<ApiResponse<Book>>(`/api/books/asin/${asin}`);
    return response.data;
  },

  create: async (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'fastAcos'>, token: string) => {
    const response = await apiClient.post<ApiResponse<Book>>('/api/books', book, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  update: async (id: string, book: Partial<Book>, token: string) => {
    const response = await apiClient.put<ApiResponse<Book>>(`/api/books/${id}`, book, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  delete: async (id: string, token: string) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/books/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};

// ================================================
// CAMPAIGNS API
// ================================================

export const campaignsApi = {
  getAll: async (filters?: { state?: string; campaignType?: string }) => {
    const response = await apiClient.get<ApiResponse<Campaign[]>>('/api/campaigns', {
      params: filters,
    });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<ApiResponse<Campaign>>(`/api/campaigns/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get<ApiResponse<CampaignStats>>('/api/campaigns/stats/summary');
    return response.data;
  },

  syncFromAmazon: async () => {
    const response = await apiClient.post<ApiResponse<any>>('/api/campaigns/sync-from-amazon', {});
    return response.data;
  },
};

// ================================================
// LOGS API
// ================================================

export const logsApi = {
  getAll: async (filters?: {
    action?: string;
    ruleName?: string;
    status?: string;
    targetId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) => {
    const response = await apiClient.get<ApiResponse<AutomationLog[]>>('/api/logs', {
      params: filters,
    });
    return response.data;
  },

  getRecent: async (limit = 50) => {
    const response = await apiClient.get<ApiResponse<AutomationLog[]>>('/api/logs/recent', {
      params: { limit },
    });
    return response.data;
  },

  getErrors: async (limit = 100) => {
    const response = await apiClient.get<ApiResponse<AutomationLog[]>>('/api/logs/errors', {
      params: { limit },
    });
    return response.data;
  },

  getStats: async (filters?: { dateFrom?: string; dateTo?: string }) => {
    const response = await apiClient.get<ApiResponse<LogStats>>('/api/logs/stats/summary', {
      params: filters,
    });
    return response.data;
  },

  getDistinctActions: async () => {
    const response = await apiClient.get<ApiResponse<string[]>>('/api/logs/actions/distinct');
    return response.data;
  },

  getDistinctRules: async () => {
    const response = await apiClient.get<ApiResponse<string[]>>('/api/logs/rules/distinct');
    return response.data;
  },
};

// ================================================
// AUTOMATION API
// ================================================

export const automationApi = {
  getStatus: async () => {
    const response = await apiClient.get<AutomationStatus>('/api/automation/status');
    return response.data;
  },

  triggerManual: async (token: string) => {
    const response = await apiClient.post<ApiResponse<void>>('/api/automation/trigger-manual', {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  // Trigger automations for current user (uses cookie auth)
  triggerUser: async () => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/api/automation/trigger-user', {});
    return response.data;
  },

  // Test bid increase (real API verification)
  testBidIncrease: async (campaignId: string, marketplace: string, bidIncrease: number = 0.02, dryRun: boolean = true) => {
    const response = await apiClient.post<any>('/api/automation/test-bid-increase', {
      campaignId,
      marketplace,
      bidIncrease,
      dryRun
    });
    return response.data;
  },

  // Test automation functions (F1-F5)
  testFunction: async (asin: string, functionNumber: number, marketplace: string, dryRun: boolean = true, configOverrides?: any) => {
    const response = await apiClient.post<any>('/api/automation/test-function', {
      asin,
      functionNumber,
      marketplace,
      dryRun,
      configOverrides
    });
    return response.data;
  },

  // Test email notification
  testEmail: async () => {
    const response = await apiClient.post<any>('/api/automation/test-email');
    return response.data;
  },
};

// ================================================
// KDP BOOKS API
// ================================================

export const kdpBooksApi = {
  getAll: async (filters?: BookshelfFilters) => {
    const response = await apiClient.get<ApiResponse<KdpBook[]>>('/api/kdp/books', {
      params: filters,
    });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<ApiResponse<KdpBook>>(`/api/kdp/books/${id}`);
    return response.data;
  },

  sync: async (token: string) => {
    const response = await apiClient.post<ApiResponse<{ message: string; booksSynced: number }>>(
      '/api/kdp/books/sync',
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  },

  syncHistorical: async (token: string) => {
    const response = await apiClient.post<ApiResponse<{ monthsImported: number; message: string }>>(
      '/api/kdp/books/sync-historical',
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  },

  create: async (book: Omit<KdpBook, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, token: string) => {
    const response = await apiClient.post<ApiResponse<KdpBook>>('/api/kdp/books', book, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  update: async (id: string, book: Partial<KdpBook>, _token?: string) => {
    // Auth handled by cookies (withCredentials: true)
    const response = await apiClient.put<ApiResponse<KdpBook>>(`/api/kdp/books/${id}`, book);
    return response.data;
  },

  delete: async (id: string, token: string) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/kdp/books/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  getCookieStatus: async (token: string) => {
    const response = await apiClient.get<ApiResponse<{
      syncEnabled: boolean;
      cookiesUpdatedAt: string | null;
      lastSyncAt: string | null;
      marketplace: string;
      cookieAge: number | null;
      cookiesExpired: boolean;
      needsRefresh: boolean;
      daysUntilExpiration: number;
    }>>('/api/kdp-sync/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};

// ================================================
// KDP ANALYTICS API
// ================================================

export const kdpAnalyticsApi = {
  getRoiAnalytics: async (bookId: string, startDate?: string, endDate?: string, token?: string) => {
    const response = await apiClient.get<RoiAnalytics>(`/api/kdp/analytics/${bookId}`, {
      params: { startDate, endDate },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data;
  },

  getDashboardSummary: async (startDate?: string, endDate?: string, token?: string) => {
    const response = await apiClient.get<KdpDashboardSummary>('/api/kdp/dashboard/summary', {
      params: { startDate, endDate },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data;
  },

  getHistoricalStats: async (filters?: {
    startDate?: string;
    endDate?: string;
    bookId?: string;
    marketplace?: string;
  }) => {
    const response = await apiClient.get<HistoricalStatsData>('/api/kdp/analytics/historical', {
      params: filters,
    });
    return response.data;
  },

  getBookStats: async (filters?: {
    startDate?: string;
    endDate?: string;
    metric?: string;
  }) => {
    const response = await apiClient.get<BookStatsData>('/api/kdp/analytics/book-stats', {
      params: filters,
    });
    return response.data;
  },

  getCountryStats: async (startDate?: string, endDate?: string) => {
    const response = await apiClient.get<CountryStatsData>('/api/kdp/analytics/country', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getMonthComparison: async (month1: string, month2: string) => {
    const response = await apiClient.get<MonthComparisonData>('/api/kdp/analytics/month-comparison', {
      params: { month1, month2 },
    });
    return response.data;
  },
};

// ================================================
// BSR API
// ================================================

export const bsrApi = {
  getAnalysis: async (bookId: string, startDate?: string, endDate?: string) => {
    const response = await apiClient.get<BsrAnalysis>(`/api/kdp/bsr/${bookId}`, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getTrend: async (bookId: string, startDate?: string, endDate?: string) => {
    const response = await apiClient.get<Omit<BsrAnalysis, 'history'>>(`/api/kdp/bsr/${bookId}/trend`, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  compareBooks: async (bookIds: string[], startDate?: string, endDate?: string) => {
    const response = await apiClient.get<{ books: Array<{
      bookId: string;
      bookTitle: string;
      asin: string;
      statistics: BsrAnalysis['statistics'];
    }> }>('/api/kdp/bsr/comparison/books', {
      params: {
        bookIds: bookIds.join(','),
        startDate,
        endDate,
      },
    });
    return response.data;
  },

  getAlert: async (bookId: string, days = 7, threshold = 20) => {
    const response = await apiClient.get<{
      bookId: string;
      bookTitle: string;
      hasAlert: boolean;
      alertType: 'improvement' | 'decline' | 'none';
      message: string;
      currentBsr: number | null;
      trendPercentage: number | null;
      period: {
        days: number;
        startDate: string;
        endDate: string;
      };
    }>(`/api/kdp/bsr/${bookId}/alert`, {
      params: { days, threshold },
    });
    return response.data;
  },
};

// ================================================
// JOURNAL EVENTS API
// ================================================

export const journalEventsApi = {
  getAll: async (filters?: {
    bookId?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
  }) => {
    const response = await apiClient.get<{ count: number; events: JournalEvent[] }>('/api/kdp/journal-events', {
      params: filters,
    });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<{ event: JournalEvent }>(`/api/kdp/journal-events/${id}`);
    return response.data;
  },

  getTimeline: async (bookId: string, startDate?: string, endDate?: string) => {
    const response = await apiClient.get<{
      bookId: string;
      bookTitle: string;
      period: {
        startDate: string | null;
        endDate: string | null;
      };
      eventsCount: number;
      timeline: Array<{
        date: string;
        title: string;
        category: string;
        description: string;
        icon: string;
      }>;
    }>(`/api/kdp/journal-events/book/${bookId}/timeline`, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getCategories: async () => {
    const response = await apiClient.get<{ categories: EventCategoryMeta[] }>('/api/kdp/journal-events/meta/categories');
    return response.data;
  },

  create: async (event: {
    title: string;
    eventDate: string;
    description?: string;
    category?: string;
    bookId?: string;
  }, token: string) => {
    const response = await apiClient.post<{ message: string; event: JournalEvent }>(
      '/api/kdp/journal-events',
      event,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  },

  update: async (id: string, event: Partial<{
    title: string;
    eventDate: string;
    description: string;
    category: string;
    bookId: string;
  }>, token: string) => {
    const response = await apiClient.patch<{ message: string; event: JournalEvent }>(
      `/api/kdp/journal-events/${id}`,
      event,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  },

  delete: async (id: string, token: string) => {
    const response = await apiClient.delete<{ message: string }>(`/api/kdp/journal-events/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};

// ================================================
// AMAZON ADS API
// ================================================

export const amazonAdsApi = {
  getSummary: async (startDate: string, endDate: string) => {
    const response = await apiClient.get<{ success: boolean; data: AmazonAdsSummary }>('/api/amazon-ads/summary', {
      params: { startDate, endDate }
    });
    return response.data.data; // endpoint ritorna { success, dateRange, data: {...} }
  },
};

// ================================================
// AUTOMATION SETTINGS
// ================================================
export const settingsApi = {
  get: async () => {
    const response = await apiClient.get<ApiResponse<any>>('/api/settings', {
      withCredentials: true
    });
    return response.data;
  },

  update: async (settings: any) => {
    const response = await apiClient.put<ApiResponse<any>>('/api/settings', settings, {
      withCredentials: true
    });
    return response.data;
  }
};

export default apiClient;
