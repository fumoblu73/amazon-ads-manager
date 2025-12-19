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

  constructor(userId: string) {
    this.userId = userId;
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

      // Set dynamic base URL based on user's region
      const region = this.user?.countryCode ? MARKETPLACE_TO_REGION[this.user.countryCode.toUpperCase()] || 'EU' : 'EU';
      const endpoint = API_ENDPOINTS[region];
      config.baseURL = endpoint;

      // Set auth headers
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      config.headers['Amazon-Advertising-API-ClientId'] = this.clientId;

      // Set profile scope if available
      if (this.user?.profileId) {
        config.headers['Amazon-Advertising-API-Scope'] = this.user.profileId.toString();
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
  // REPORT METHODS
  // ================================================

  async requestReport(reportDate: string, metrics: string[]): Promise<string> {
    try {
      console.log(`📊 Requesting report for ${reportDate}...`);

      const response = await this.client.post('/v2/sp/keywords/report', {
        reportDate: reportDate,
        metrics: metrics
      });

      const reportId = response.data.reportId;
      console.log(`✅ Report requested. ID: ${reportId}`);

      return reportId;
    } catch (error) {
      console.error('❌ Error requesting report:', error);
      throw error;
    }
  }

  async getReportStatus(reportId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/reports/${reportId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error checking report status ${reportId}:`, error);
      throw error;
    }
  }

  async downloadReport(reportId: string): Promise<any> {
    try {
      const status = await this.getReportStatus(reportId);

      if (status.status !== 'SUCCESS') {
        throw new Error(`Report not ready. Status: ${status.status}`);
      }

      const reportData = await axios.get(status.location);

      console.log(`✅ Report downloaded`);
      return reportData.data;
    } catch (error) {
      console.error(`❌ Error downloading report ${reportId}:`, error);
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
  // SEARCH TERMS METHODS (Function 5 - Campaign Feeding)
  // ================================================

  async requestSearchTermsReport(
    startDate: string,
    endDate: string,
    campaignIdFilter?: string
  ): Promise<string> {
    try {
      console.log(`📊 Requesting search terms report ${startDate} - ${endDate}...`);

      const body: any = {
        reportDate: startDate,
        metrics: [
          'campaignId',
          'adGroupId',
          'keywordId',
          'targetId',
          'searchTerm',
          'impressions',
          'clicks',
          'cost',
          'sales',
          'orders'
        ]
      };

      if (campaignIdFilter) {
        body.campaignIdFilter = campaignIdFilter;
      }

      const response = await this.client.post('/v2/sp/targets/report', body);

      const reportId = response.data.reportId;
      console.log(`✅ Search terms report requested. ID: ${reportId}`);

      return reportId;
    } catch (error) {
      console.error('❌ Error requesting search terms report:', error);
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

  async waitAndDownloadReport(reportId: string, maxAttempts: number = 10): Promise<any> {
    try {
      console.log(`⏳ Waiting for report ${reportId} to complete...`);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const status = await this.getReportStatus(reportId);

        if (status.status === 'SUCCESS') {
          console.log(`✅ Report ready, downloading...`);
          const reportData = await axios.get(status.location);
          return reportData.data;
        }

        if (status.status === 'FAILURE') {
          throw new Error(`Report failed: ${status.statusDetails || 'Unknown error'}`);
        }

        console.log(`   Attempt ${attempt}/${maxAttempts}: status=${status.status}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      throw new Error(`Report not ready after ${maxAttempts} attempts`);
    } catch (error) {
      console.error(`❌ Error waiting/downloading report:`, error);
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
