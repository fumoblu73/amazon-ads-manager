import axios from 'axios';
import type {
  ApiResponse,
  Book,
  Campaign,
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
});

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

export default apiClient;
