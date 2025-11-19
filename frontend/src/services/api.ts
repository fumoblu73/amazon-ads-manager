import axios from 'axios';
import type {
  ApiResponse,
  Book,
  Campaign,
  Profile,
  AutomationLog,
  CampaignStats,
  LogStats,
  AutomationStatus
} from '../types';

// Base API URL - cambia in produzione
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://amazon-ads-manager.onrender.com';

// Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
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
  getAll: async (filters?: {
    state?: string;
    campaignType?: string;
    marketplace?: string;
    minAcos?: number;
    maxAcos?: number;
    includeConfig?: boolean;
  }) => {
    const response = await apiClient.get<ApiResponse<Campaign[]>>('/api/campaigns', {
      params: {
        ...filters,
        includeConfig: filters?.includeConfig ? 'true' : undefined,
      },
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

  syncFromAmazon: async (token: string, profileId?: string) => {
    const response = await apiClient.post<ApiResponse<{ total: number; created: number; updated: number; errors: number }>>(
      '/api/campaigns/sync-from-amazon',
      profileId ? { profileId } : {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  },

  getProfiles: async (token: string) => {
    const response = await apiClient.get<ApiResponse<Profile[]>>(
      '/api/campaigns/profiles',
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
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
};

// ================================================
// AUTOMATION CONFIG API
// ================================================

export interface AutomationConfig {
  id: string;
  campaignId: string;
  bookId: string | null;

  // Function 1
  func1Enabled: boolean;
  func1BidIncrease: number;
  func1Frequency: number;
  func1Impressions: number;
  func1Clicks: number;

  // Function 2
  func2Enabled: boolean;
  func2Frequency: number;
  func2TimeframeWeeks: number;

  // Function 3
  func3Enabled: boolean;
  func3Frequency: number;
  func3TimeframeA: number;
  func3TimeframeB: number;
  func3TimeframeC: number;
  func3ClicksPause: number;
  func3Clicks65days: number;

  // Function 4
  func4Enabled: boolean;
  func4Frequency: number;
  func4TimeframeA: number;
  func4TimeframeB: number;
  func4TimeframeC: number;
  func4ClicksNegative: number;
  func4SpendNegative: number;

  // Function 5
  func5Enabled: boolean;
  func5Frequency: number;
  func5MinOrders: number;
  func5BidBroad: number;
  func5BidExact: number;
  func5BidPhrase: number;
  func5BidExpanded: number;

  createdAt: string;
  updatedAt: string;
}

export const automationConfigApi = {
  getByCampaignId: async (campaignId: string) => {
    const response = await apiClient.get<ApiResponse<AutomationConfig>>(`/api/automation-config/${campaignId}`);
    return response.data;
  },

  create: async (config: Partial<AutomationConfig>, token: string) => {
    const response = await apiClient.post<ApiResponse<AutomationConfig>>('/api/automation-config', config, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  update: async (campaignId: string, config: Partial<AutomationConfig>, token: string) => {
    const response = await apiClient.put<ApiResponse<AutomationConfig>>(
      `/api/automation-config/${campaignId}`,
      config,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  },

  toggleFunction: async (campaignId: string, functionNumber: number, enabled: boolean, token: string) => {
    const response = await apiClient.patch<ApiResponse<AutomationConfig>>(
      `/api/automation-config/${campaignId}/toggle/${functionNumber}`,
      { enabled },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  },

  delete: async (campaignId: string, token: string) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/automation-config/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};

export default apiClient;
