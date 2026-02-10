// ================================================
// USER AMAZON API SERVICE - Per-User OAuth-Based
// ================================================
// This service provides Amazon Ads API access on a per-user basis,
// using each user's OAuth tokens instead of a global refresh token.

import axios, { AxiosInstance } from 'axios';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { AmazonAuthService } from './amazon-auth.service';
import { API_ENDPOINTS, MARKETPLACE_TO_REGION } from '../config/amazon';

/**
 * Per-user Amazon Ads API service
 * Each instance is tied to a specific user and uses their OAuth tokens
 */
export class UserAmazonApiService {
  private client: AxiosInstance;
  private userId: string;
  private user: User | null = null;
  private accessToken: string = '';
  private clientId: string;
  private marketplace?: string; // Se specificato, usa questo per determinare endpoint/regione
  private profileIdOverride?: string; // Se specificato, usa questo profileId invece di quello dal DB

  constructor(userId: string, marketplace?: string, profileId?: string) {
    this.userId = userId;
    this.marketplace = marketplace;
    this.profileIdOverride = profileId;
    this.clientId = process.env.AMAZON_ADS_CLIENT_ID || '';

    // Create HTTP client
    this.client = axios.create({
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor: ensure valid token before each request
    this.client.interceptors.request.use(async (config) => {
      await this.ensureValidToken();

      // Set dynamic base URL: marketplace (se specificato) ha priorita' su countryCode utente
      // Un utente italiano puo' avere campagne su marketplace US → serve endpoint NA, non EU
      const regionSource = this.marketplace || this.user?.countryCode || 'US';
      const region = MARKETPLACE_TO_REGION[regionSource.toUpperCase()] || 'NA';
      const endpoint = API_ENDPOINTS[region];
      config.baseURL = endpoint;

      // Set auth headers
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      config.headers['Amazon-Advertising-API-ClientId'] = this.clientId;

      // Set profile scope: override ha priorita' su DB (supporta multi-marketplace)
      const profileId = this.profileIdOverride || this.user?.profileId;
      if (profileId) {
        config.headers['Amazon-Advertising-API-Scope'] = profileId.toString();
      }

      return config;
    });
  }

  // ================================================
  // TOKEN MANAGEMENT
  // ================================================

  private async loadUser(): Promise<User> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: this.userId } });

    if (!user) {
      throw new Error(`User not found: ${this.userId}`);
    }

    if (!user.amazonUserId || !user.refreshToken) {
      throw new Error('User not connected to Amazon. Please complete OAuth authentication.');
    }

    return user;
  }

  private async ensureValidToken(): Promise<void> {
    // Load user if not yet loaded
    if (!this.user) {
      this.user = await this.loadUser();
    }

    // Check if token expired
    if (AmazonAuthService.isTokenExpired(this.user.tokenExpiresAt)) {
      await this.refreshAccessToken();
    } else {
      this.accessToken = this.user.accessToken!;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    console.log(`🔄 Refreshing access token for user ${this.userId}...`);

    try {
      const tokens = await AmazonAuthService.refreshAccessToken(this.user!.refreshToken!);

      // Update database
      const userRepo = AppDataSource.getRepository(User);
      this.user!.accessToken = tokens.access_token;
      this.user!.refreshToken = tokens.refresh_token;
      this.user!.tokenExpiresAt = AmazonAuthService.calculateTokenExpiry(tokens.expires_in);
      await userRepo.save(this.user!);

      this.accessToken = tokens.access_token;
      console.log('✅ Token refreshed successfully');
    } catch (error: any) {
      console.error(`❌ Token refresh failed for user ${this.userId}:`, error);

      // Mark user as inactive if token refresh fails
      const userRepo = AppDataSource.getRepository(User);
      this.user!.isActive = false;
      await userRepo.save(this.user!);

      throw new Error('Amazon token refresh failed. Please re-authenticate.');
    }
  }

  // ================================================
  // PROFILE METHODS
  // ================================================

  async getProfiles(): Promise<any[]> {
    try {
      console.log(`📥 Fetching profiles for user ${this.userId}...`);

      const response = await this.client.get('/v2/profiles');

      console.log(`✅ Found ${response.data.length} profiles`);
      response.data.forEach((profile: any) => {
        console.log(`   - ${profile.accountInfo?.marketplaceStringId} (${profile.countryCode}): Profile ID ${profile.profileId} - ${profile.accountInfo?.name || 'N/A'}`);
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error fetching profiles:', error);
      throw error;
    }
  }

  // ================================================
  // CAMPAIGN METHODS
  // ================================================

  async getCampaigns(): Promise<any[]> {
    return this.getCampaignsForProfile(this.user!.profileId!.toString());
  }

  async getCampaignsForProfile(profileId: string): Promise<any[]> {
    try {
      console.log(`📥 Fetching campaigns for profile ${profileId}...`);

      const response = await this.client.post('/sp/campaigns/list', {
        maxResults: 1000,
        stateFilter: {
          include: ['ENABLED', 'PAUSED', 'ARCHIVED']
        }
      }, {
        headers: {
          'Content-Type': 'application/vnd.spcampaign.v3+json',
          'Accept': 'application/vnd.spcampaign.v3+json',
          'Amazon-Advertising-API-Scope': profileId
        }
      });

      const campaigns = response.data.campaigns || [];
      console.log(`✅ Found ${campaigns.length} campaigns for profile ${profileId}`);
      return campaigns;
    } catch (error) {
      console.error(`❌ Error fetching campaigns for profile ${profileId}:`, error);
      throw error;
    }
  }

  async getCampaign(campaignId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/sp/campaigns/${campaignId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching campaign ${campaignId}:`, error);
      throw error;
    }
  }

  // ================================================
  // KEYWORD METHODS
  // ================================================

  async getKeywords(campaignId?: string): Promise<any[]> {
    try {
      console.log('📥 Fetching keywords...');

      const params = campaignId ? { campaignIdFilter: campaignId } : {};
      const response = await this.client.get('/v2/sp/keywords', { params });

      console.log(`✅ Found ${response.data.length} keywords`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching keywords:', error);
      throw error;
    }
  }

  async updateKeywordBid(keywordId: string, newBid: number): Promise<any> {
    try {
      console.log(`🔧 Updating keyword ${keywordId} bid to ${newBid}...`);

      const response = await this.client.put(`/v2/sp/keywords/${keywordId}`, {
        bid: newBid
      });

      console.log(`✅ Bid updated successfully`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error updating keyword bid ${keywordId}:`, error);
      throw error;
    }
  }

  async updateKeywordState(keywordId: string, state: 'enabled' | 'paused'): Promise<any> {
    try {
      console.log(`🔧 Setting keyword ${keywordId} to ${state}...`);

      const response = await this.client.put(`/v2/sp/keywords/${keywordId}`, {
        state: state
      });

      console.log(`✅ Keyword state updated`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error updating keyword state ${keywordId}:`, error);
      throw error;
    }
  }

  // ================================================
  // REPORT METHODS (API v3)
  // ================================================

  /**
   * Richiede un report delle performance usando l'API v3
   * @param startDate - Data inizio (formato: YYYY-MM-DD)
   * @param endDate - Data fine (formato: YYYY-MM-DD)
   * @param reportType - Tipo report: 'spTargeting' | 'spCampaigns' | 'spSearchTerm'
   * @param columns - Colonne da includere
   */
  async requestReportV3(
    startDate: string,
    endDate: string,
    reportType: 'spTargeting' | 'spCampaigns' | 'spSearchTerm' | 'spAdvertisedProduct' = 'spTargeting',
    columns: string[] = ['impressions', 'clicks', 'cost', 'purchases14d']
  ): Promise<string> {
    try {
      console.log(`📊 [API v3] Requesting ${reportType} report from ${startDate} to ${endDate}...`);

      // Mappa colonne legacy → nomi API v3
      const v3Columns = columns.map(col => {
        const mapping: Record<string, string> = {
          'sales': 'sales14d',
          'orders': 'purchases14d',
          'orders14d': 'purchases14d',
          'spend': 'cost',
          'targetId': 'targeting',
          'bid': 'keywordBid'
        };
        return mapping[col] || col;
      });

      // Colonne obbligatorie e groupBy dipendono dal tipo di report
      let requiredCols: string[];
      let groupBy: string[];

      if (reportType === 'spAdvertisedProduct') {
        // Per spAdvertisedProduct: raggruppa per ASIN, include productName e productCategory
        requiredCols = ['advertisedAsin'];
        groupBy = ['advertiserProduct'];
      } else if (reportType === 'spSearchTerm') {
        requiredCols = ['campaignId', 'adGroupId', 'keywordId', 'keyword', 'searchTerm'];
        groupBy = ['searchTerm'];
      } else {
        // spTargeting, spCampaigns
        requiredCols = ['campaignId', 'adGroupId', 'keywordId', 'keyword'];
        groupBy = ['targeting'];
      }

      const allColumns = [...new Set([...requiredCols, ...v3Columns])];

      // Rimuovi solo colonne sicuramente non valide
      const invalidColumns = ['targetId', 'bid', 'orders14d', 'spend'];
      const validColumns = allColumns.filter(col => !invalidColumns.includes(col));

      const requestBody = {
        startDate: startDate,
        endDate: endDate,
        configuration: {
          adProduct: 'SPONSORED_PRODUCTS',
          groupBy: groupBy,
          columns: validColumns,
          reportTypeId: reportType,
          timeUnit: 'SUMMARY',
          format: 'GZIP_JSON'
        }
      };

      console.log(`📋 [API v3] Request body:`, JSON.stringify(requestBody, null, 2));

      // Content-Type v3 RICHIESTO da Amazon (da documentazione ufficiale)
      const response = await this.client.post('/reporting/reports', requestBody, {
        headers: {
          'Content-Type': 'application/vnd.createasyncreportrequest.v3+json'
        }
      });

      const reportId = response.data.reportId;
      console.log(`✅ [API v3] Report requested. ID: ${reportId}`);

      return reportId;
    } catch (error: any) {
      console.error('❌ [API v3] Error requesting report:', error.response?.data || error.message);
      throw error;
    }
  }

  // Richiede report con date range: startDate → endDate (default: oggi)
  // startDate in formato YYYYMMDD (come restituito da formatDateForAmazon)
  async requestReport(startDateStr: string, metrics: string[], endDateStr?: string): Promise<string> {
    // Converte startDate da YYYYMMDD a YYYY-MM-DD
    const startDate = `${startDateStr.substring(0, 4)}-${startDateStr.substring(4, 6)}-${startDateStr.substring(6, 8)}`;

    // Se endDate non fornita, usa oggi
    let endDate: string;
    if (endDateStr) {
      endDate = `${endDateStr.substring(0, 4)}-${endDateStr.substring(4, 6)}-${endDateStr.substring(6, 8)}`;
    } else {
      endDate = new Date().toISOString().split('T')[0];
    }

    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const days = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    console.log(`📅 [API v3] Date range: ${startDate} to ${endDate} (${days} giorni)`);

    return this.requestReportV3(startDate, endDate, 'spTargeting', metrics);
  }

  async getReportStatus(reportId: string): Promise<any> {
    try {
      const response = await this.client.get(`/reporting/reports/${reportId}`);
      // Non loggare ogni check per evitare spam nei log
      return response.data;
    } catch (error: any) {
      console.error(`❌ [API v3] Error checking report status ${reportId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async downloadReport(reportId: string): Promise<any[]> {
    try {
      const status = await this.getReportStatus(reportId);

      if (status.status !== 'COMPLETED') {
        throw new Error(`Report not ready. Status: ${status.status}`);
      }

      if (!status.url) {
        throw new Error('Download URL not available');
      }

      console.log(`📥 [API v3] Downloading report from: ${status.url.substring(0, 100)}...`);

      // Scarica il file GZIP
      const reportResponse = await axios.get(status.url, {
        responseType: 'arraybuffer',
        decompress: true
      });

      // Decomprimi e parse JSON
      const zlib = require('zlib');
      const decompressed = zlib.gunzipSync(reportResponse.data);
      const jsonData = JSON.parse(decompressed.toString('utf-8'));

      console.log(`✅ [API v3] Report downloaded: ${Array.isArray(jsonData) ? jsonData.length : 0} rows`);
      return Array.isArray(jsonData) ? jsonData : [];
    } catch (error: any) {
      console.error(`❌ [API v3] Error downloading report ${reportId}:`, error.message);
      throw error;
    }
  }

  // ================================================
  // PLACEMENT BIDDING METHODS (Function 2)
  // ================================================

  async updateCampaignPlacements(
    campaignId: string,
    placements: {
      topOfSearch?: number;
      restOfSearch?: number;
      productPages?: number;
    }
  ): Promise<any> {
    try {
      console.log(`🔧 Updating placements for campaign ${campaignId}...`);

      const bidding = {
        placementBidding: []
      } as any;

      if (placements.topOfSearch !== undefined) {
        bidding.placementBidding.push({
          placement: 'PLACEMENT_TOP',
          percentage: placements.topOfSearch
        });
      }

      if (placements.restOfSearch !== undefined) {
        bidding.placementBidding.push({
          placement: 'PLACEMENT_PRODUCT_PAGE',
          percentage: placements.restOfSearch
        });
      }

      if (placements.productPages !== undefined) {
        bidding.placementBidding.push({
          placement: 'PLACEMENT_REST_OF_SEARCH',
          percentage: placements.productPages
        });
      }

      const response = await this.client.put(`/v2/sp/campaigns/${campaignId}`, {
        bidding
      });

      console.log(`✅ Placements updated`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error updating placements for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  // ================================================
  // TARGET METHODS (Product Targeting)
  // ================================================

  async getTargets(campaignId?: string): Promise<any[]> {
    try {
      console.log('📥 Fetching targets...');

      const params = campaignId ? { campaignIdFilter: campaignId } : {};
      const response = await this.client.get('/v2/sp/targets', { params });

      console.log(`✅ Found ${response.data.length} targets`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching targets:', error);
      throw error;
    }
  }

  async updateTargetBid(targetId: string, newBid: number): Promise<any> {
    try {
      console.log(`🔧 Updating target ${targetId} bid to ${newBid}...`);

      const response = await this.client.put(`/v2/sp/targets/${targetId}`, {
        bid: newBid
      });

      console.log(`✅ Target bid updated`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error updating target bid ${targetId}:`, error);
      throw error;
    }
  }

  async updateTargetState(targetId: string, state: 'enabled' | 'paused'): Promise<any> {
    try {
      console.log(`🔧 Setting target ${targetId} to ${state}...`);

      const response = await this.client.put(`/v2/sp/targets/${targetId}`, {
        state: state
      });

      console.log(`✅ Target state updated`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error updating target state ${targetId}:`, error);
      throw error;
    }
  }

  // ================================================
  // AUTO ADS METHODS (Function 4)
  // ================================================

  async getAutoTargetingGroups(campaignId: string): Promise<any[]> {
    try {
      console.log(`📥 Fetching auto targeting groups for campaign ${campaignId}...`);

      const response = await this.client.get('/v2/sp/targets', {
        params: {
          campaignIdFilter: campaignId,
          expressionType: 'AUTO'
        }
      });

      console.log(`✅ Found ${response.data.length} auto targeting groups`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching auto targeting groups:`, error);
      throw error;
    }
  }

  async addNegativeKeyword(
    campaignId: string,
    adGroupId: string,
    keyword: string,
    matchType: 'negativeExact' | 'negativePhrase'
  ): Promise<any> {
    try {
      console.log(`➖ Adding negative keyword "${keyword}" (${matchType})...`);

      const response = await this.client.post('/v2/sp/negativeKeywords', [{
        campaignId,
        adGroupId,
        keywordText: keyword,
        matchType,
        state: 'enabled'
      }]);

      console.log(`✅ Negative keyword added`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error adding negative keyword:`, error);
      throw error;
    }
  }

  async addNegativeTarget(
    campaignId: string,
    adGroupId: string,
    asin: string
  ): Promise<any> {
    try {
      console.log(`➖ Adding negative target ASIN ${asin}...`);

      const response = await this.client.post('/v2/sp/negativeTargets', [{
        campaignId,
        adGroupId,
        expression: [{
          type: 'asinSameAs',
          value: asin
        }],
        expressionType: 'manual',
        state: 'enabled'
      }]);

      console.log(`✅ Negative target added`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error adding negative target:`, error);
      throw error;
    }
  }

  // ================================================
  // ADVERTISED PRODUCT REPORT (V3 - productName, productCategory)
  // ================================================

  /**
   * Richiede un report spAdvertisedProduct per ottenere productName e productCategory per ASIN.
   * Questo report fornisce metadati aggiuntivi sui prodotti pubblicizzati.
   */
  async requestAdvertisedProductReport(
    startDate: string,
    endDate: string
  ): Promise<string> {
    try {
      console.log(`📊 [API v3] Requesting advertised product report ${startDate} - ${endDate}...`);

      // Colonne disponibili per spAdvertisedProduct
      const columns = [
        'advertisedAsin',
        'advertisedSku',
        'campaignId',
        'campaignName',
        'adGroupId',
        'adGroupName',
        'productName',
        'productCategory',
        'impressions',
        'clicks',
        'cost',
        'purchases14d',
        'sales14d'
      ];

      return this.requestReportV3(startDate, endDate, 'spAdvertisedProduct', columns);
    } catch (error: any) {
      console.error('❌ [API v3] Error requesting advertised product report:', error.response?.data || error.message);
      throw error;
    }
  }

  // ================================================
  // SEARCH TERMS METHODS (Function 5 - Campaign Feeding)
  // ================================================

  async requestSearchTermsReport(
    startDate: string,
    endDate: string,
    campaignIdFilter?: string
  ): Promise<string> {
    try {
      console.log(`📊 [API v3] Requesting search terms report ${startDate} - ${endDate}...`);

      // Colonne valide per API v3 spSearchTerm
      const columns = [
        'campaignId',
        'adGroupId',
        'keywordId',
        'keyword',
        'searchTerm',
        'impressions',
        'clicks',
        'cost',
        'purchases14d'
      ];

      const requestBody: any = {
        startDate: startDate,
        endDate: endDate,
        configuration: {
          adProduct: 'SPONSORED_PRODUCTS',
          groupBy: ['searchTerm'],
          columns: columns,
          reportTypeId: 'spSearchTerm',
          timeUnit: 'SUMMARY',
          format: 'GZIP_JSON'
        }
      };

      if (campaignIdFilter) {
        console.log(`   [API v3] Campaign filter: ${campaignIdFilter} (applied post-download)`);
      }

      console.log(`📋 [API v3] Request body:`, JSON.stringify(requestBody, null, 2));

      // Content-Type v3 RICHIESTO da Amazon
      const response = await this.client.post('/reporting/reports', requestBody, {
        headers: {
          'Content-Type': 'application/vnd.createasyncreportrequest.v3+json'
        }
      });

      const reportId = response.data.reportId;
      console.log(`✅ [API v3] Search terms report requested. ID: ${reportId}`);

      return reportId;
    } catch (error: any) {
      console.error('❌ [API v3] Error requesting search terms report:', error.response?.data || error.message);
      throw error;
    }
  }

  async addKeywords(
    campaignId: string,
    adGroupId: string,
    keywords: Array<{
      keywordText: string;
      matchType: 'broad' | 'phrase' | 'exact';
      bid: number;
    }>
  ): Promise<any> {
    try {
      console.log(`➕ Adding ${keywords.length} keywords to campaign ${campaignId}...`);

      const keywordsData = keywords.map(kw => ({
        campaignId,
        adGroupId,
        keywordText: kw.keywordText,
        matchType: kw.matchType,
        bid: kw.bid,
        state: 'enabled'
      }));

      const response = await this.client.post('/v2/sp/keywords', keywordsData);

      console.log(`✅ Keywords added`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error adding keywords:`, error);
      throw error;
    }
  }

  async addTargets(
    campaignId: string,
    adGroupId: string,
    targets: Array<{
      asin: string;
      bid: number;
      expressionType: 'manual' | 'auto';
    }>
  ): Promise<any> {
    try {
      console.log(`➕ Adding ${targets.length} targets to campaign ${campaignId}...`);

      const targetsData = targets.map(target => ({
        campaignId,
        adGroupId,
        expression: [{
          type: 'asinSameAs',
          value: target.asin
        }],
        expressionType: target.expressionType,
        bid: target.bid,
        state: 'enabled'
      }));

      const response = await this.client.post('/v2/sp/targets', targetsData);

      console.log(`✅ Targets added`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error adding targets:`, error);
      throw error;
    }
  }

  // ================================================
  // UTILITY METHODS
  // ================================================

  /**
   * Aspetta che il report sia pronto e lo scarica
   * Amazon API v3 può richiedere fino a 5-10 minuti per generare report
   */
  async waitAndDownloadReport(reportId: string, maxAttempts: number = 60): Promise<any[]> {
    try {
      console.log(`⏳ [API v3] Waiting for report ${reportId} to complete...`);
      console.log(`   [API v3] Max timeout: ${maxAttempts * 5} seconds (${(maxAttempts * 5 / 60).toFixed(1)} minutes)`);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const status = await this.getReportStatus(reportId);

        // Log risposta completa per i primi tentativi (debug)
        if (attempt <= 2) {
          console.log(`   [API v3] DEBUG - Full response:`, JSON.stringify(status, null, 2));
        }

        // API v3 usa 'COMPLETED' invece di 'SUCCESS'
        if (status.status === 'COMPLETED') {
          console.log(`✅ [API v3] Report ready after ${attempt} attempts, downloading...`);
          return await this.downloadReport(reportId);
        }

        if (status.status === 'FAILURE' || status.status === 'FAILED') {
          throw new Error(`Report failed: ${status.failureReason || status.statusDetails || 'Unknown error'}`);
        }

        // Log ogni 10 tentativi per non riempire i log
        if (attempt % 10 === 0 || attempt <= 3) {
          console.log(`   [API v3] Attempt ${attempt}/${maxAttempts}: status=${status.status}`);
        }

        // Aspetta 5 secondi prima di riprovare (Amazon API v3 può essere lento)
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      throw new Error(`Report not ready after ${maxAttempts} attempts (${(maxAttempts * 5 / 60).toFixed(1)} minutes)`);
    } catch (error: any) {
      console.error(`❌ [API v3] Error waiting/downloading report:`, error.message);
      throw error;
    }
  }

  /**
   * Get user info (for debugging/logging)
   */
  getUserInfo(): { userId: string; profileId: number | null; countryCode: string | null } {
    return {
      userId: this.userId,
      profileId: this.user?.profileId || null,
      countryCode: this.user?.countryCode || null
    };
  }
}
