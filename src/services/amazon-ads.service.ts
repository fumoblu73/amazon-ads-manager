// ================================================
// SERVIZIO AMAZON ADS API - MULTI-REGION
// ================================================
// Gestisce le chiamate alle API di Amazon Advertising
// per recuperare dati su campagne, spese e performance

import axios, { AxiosInstance } from 'axios';
import {
  API_ENDPOINTS,
  MARKETPLACE_TO_REGION,
  getRegionCredentials,
  getProfileIdForMarketplace
} from '../config/amazon';

// Interfacce per i tipi di dati
export interface AmazonProfile {
  profileId: number;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  accountInfo: {
    marketplaceStringId: string;
    id: string;
    type: string;
    name: string;
    subType?: string;
    validPaymentMethod: boolean;
  };
}

export interface Campaign {
  campaignId: string;
  name: string;
  state: 'ENABLED' | 'PAUSED' | 'ARCHIVED';
  budget: {
    budget: number;
    budgetType: string;
  };
  startDate?: string;
  endDate?: string;
  targetingType?: string;
  dynamicBidding?: any;
}

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  sales: number;
  orders: number;
  acos: number; // Advertising Cost of Sale (cost/sales * 100)
  roas: number; // Return on Ad Spend (sales/cost)
  ctr: number;  // Click-through rate (clicks/impressions * 100)
  cpc: number;  // Cost per click (cost/clicks)
}

export interface MarketplacePerformance {
  marketplace: string;
  currency: string;
  totalSpend: number;
  totalSales: number;
  totalImpressions: number;
  totalClicks: number;
  totalOrders: number;
  acos: number;
  roas: number;
  campaigns: CampaignPerformance[];
}

export interface AsinSpendRow {
  marketplace: string;
  asin: string;
  adType: string; // 'SP' | 'SD' | 'SB'
  spend7d: number;
  sales7d: number;
  impressions7d: number;
  clicks7d: number;
}

// Classe per gestire le API di un singolo region
class RegionApiClient {
  private client: AxiosInstance;
  private accessToken: string = '';
  private tokenExpiry: number = 0;
  private region: 'EU' | 'NA' | 'FE';
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;

  constructor(region: 'EU' | 'NA' | 'FE') {
    this.region = region;
    const credentials = getRegionCredentials(region);

    if (!credentials) {
      throw new Error(`Credenziali non configurate per regione ${region}`);
    }

    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    this.refreshToken = credentials.refreshToken;

    this.client = axios.create({
      baseURL: API_ENDPOINTS[region],
      headers: {
        'Content-Type': 'application/json',
        'Amazon-Advertising-API-ClientId': this.clientId
      }
    });

    // Interceptor per aggiungere token automaticamente
    this.client.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      return config;
    });
  }

  private async ensureValidToken(): Promise<void> {
    const now = Date.now();
    if (this.accessToken && this.tokenExpiry > now + 60000) { // 1 minuto di margine
      return;
    }
    await this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      console.log(`🔄 [${this.region}] Rinnovo token di accesso...`);

      const response = await axios.post('https://api.amazon.com/auth/o2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      console.log(`✅ [${this.region}] Token rinnovato`);
    } catch (error: any) {
      console.error(`❌ [${this.region}] Errore rinnovo token:`, error.response?.data || error.message);
      throw new Error(`Impossibile rinnovare token per regione ${this.region}`);
    }
  }

  // Recupera tutti i profili della regione
  async getProfiles(): Promise<AmazonProfile[]> {
    try {
      const response = await this.client.get('/v2/profiles');
      return response.data;
    } catch (error: any) {
      console.error(`❌ [${this.region}] Errore recupero profili:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Recupera le campagne per un profilo specifico
  async getCampaigns(profileId: string): Promise<Campaign[]> {
    try {
      console.log(`📥 [${this.region}] Recupero campagne per profilo ${profileId}...`);

      // Prima prova con l'API v3
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

      console.log(`📊 [${this.region}] Response:`, JSON.stringify(response.data).substring(0, 500));
      const campaigns = response.data.campaigns || [];
      console.log(`✅ [${this.region}] Trovate ${campaigns.length} campagne`);
      return campaigns;
    } catch (error: any) {
      console.error(`❌ [${this.region}] Errore recupero campagne:`, JSON.stringify(error.response?.data || error.message));

      // Fallback: prova con API v2
      try {
        console.log(`🔄 [${this.region}] Provo con API v2...`);
        const response = await this.client.get('/v2/sp/campaigns', {
          headers: {
            'Amazon-Advertising-API-Scope': profileId
          }
        });
        console.log(`✅ [${this.region}] API v2 - Trovate ${response.data?.length || 0} campagne`);
        return response.data || [];
      } catch (error2: any) {
        console.error(`❌ [${this.region}] Anche API v2 fallita:`, error2.response?.data || error2.message);
        return [];
      }
    }
  }

  // Richiede un report delle performance
  async requestPerformanceReport(
    profileId: string,
    startDate: string,
    endDate: string
  ): Promise<string | null> {
    try {
      console.log(`📊 [${this.region}] Richiesta report ${startDate} - ${endDate}...`);

      const response = await this.client.post('/reporting/reports', {
        name: `Campaign Performance Report`,
        startDate,
        endDate,
        configuration: {
          adProduct: 'SPONSORED_PRODUCTS',
          groupBy: ['campaign'],
          columns: [
            'campaignId',
            'campaignName',
            'impressions',
            'clicks',
            'cost',
            'purchases30d',
            'sales30d'
          ],
          reportTypeId: 'spCampaigns',
          timeUnit: 'SUMMARY',
          format: 'GZIP_JSON'
        }
      }, {
        headers: {
          'Amazon-Advertising-API-Scope': profileId,
          'Content-Type': 'application/vnd.createasyncreportrequest.v3+json'
        }
      });

      console.log(`✅ [${this.region}] Report richiesto: ${response.data.reportId}`);
      return response.data.reportId;
    } catch (error: any) {
      console.error(`❌ [${this.region}] Errore richiesta report:`, error.response?.data || error.message);
      return null;
    }
  }

  // Richiede un report spAdvertisedProduct (o sdAdvertisedProduct) per spesa per ASIN
  async requestAdvertisedProductReport(
    profileId: string,
    startDate: string,
    endDate: string,
    adType: 'SP' | 'SD' = 'SP'
  ): Promise<string | null> {
    try {
      const adProduct = adType === 'SP' ? 'SPONSORED_PRODUCTS' : 'SPONSORED_DISPLAY';
      const reportTypeId = adType === 'SP' ? 'spAdvertisedProduct' : 'sdAdvertisedProduct';
      console.log(`📊 [${this.region}] Richiesta report ${adType}/ASIN ${startDate} - ${endDate}...`);

      const response = await this.client.post('/reporting/reports', {
        name: `${adType} Advertised Product Report`,
        startDate,
        endDate,
        configuration: {
          adProduct,
          groupBy: ['advertiser'],
          columns: ['advertisedAsin', 'cost', 'sales14d', 'impressions', 'clicks', 'purchases14d'],
          reportTypeId,
          timeUnit: 'SUMMARY',
          format: 'GZIP_JSON'
        }
      }, {
        headers: {
          'Amazon-Advertising-API-Scope': profileId,
          'Content-Type': 'application/vnd.createasyncreportrequest.v3+json'
        }
      });

      console.log(`✅ [${this.region}] Report ${adType} richiesto: ${response.data.reportId}`);
      return response.data.reportId;
    } catch (error: any) {
      console.error(`❌ [${this.region}] Errore richiesta report ${adType}:`, error.response?.data || error.message);
      return null;
    }
  }

  // Controlla lo stato di un report
  async getReportStatus(profileId: string, reportId: string): Promise<{ status: string; url?: string }> {
    try {
      const response = await this.client.get(`/reporting/reports/${reportId}`, {
        headers: {
          'Amazon-Advertising-API-Scope': profileId
        }
      });

      return {
        status: response.data.status,
        url: response.data.url
      };
    } catch (error: any) {
      console.error(`❌ [${this.region}] Errore controllo report:`, error.response?.data || error.message);
      return { status: 'ERROR' };
    }
  }

  // Scarica e decomprime un report
  async downloadReport(url: string): Promise<any[]> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer'
      });

      // Decomprime GZIP
      const zlib = require('zlib');
      const decompressed = zlib.gunzipSync(response.data);
      const jsonData = JSON.parse(decompressed.toString());

      return jsonData;
    } catch (error: any) {
      console.error(`❌ [${this.region}] Errore download report:`, error.message);
      return [];
    }
  }

  // Attende e scarica un report
  async waitAndDownloadReport(
    profileId: string,
    reportId: string,
    maxAttempts: number = 30
  ): Promise<any[]> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { status, url } = await this.getReportStatus(profileId, reportId);

      if (status === 'COMPLETED' && url) {
        console.log(`✅ [${this.region}] Report pronto, scarico...`);
        return await this.downloadReport(url);
      }

      if (status === 'FAILURE') {
        console.error(`❌ [${this.region}] Report fallito`);
        return [];
      }

      console.log(`   [${this.region}] Attesa report... (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.error(`❌ [${this.region}] Timeout attesa report`);
    return [];
  }
}

// Servizio principale multi-region
class AmazonAdsService {
  private clients: Map<string, RegionApiClient> = new Map();

  private getClient(region: 'EU' | 'NA' | 'FE'): RegionApiClient {
    if (!this.clients.has(region)) {
      try {
        this.clients.set(region, new RegionApiClient(region));
      } catch (error) {
        throw new Error(`Impossibile creare client per regione ${region}`);
      }
    }
    return this.clients.get(region)!;
  }

  // Recupera tutti i profili da tutte le regioni
  async getAllProfiles(): Promise<{ region: string; profiles: AmazonProfile[] }[]> {
    const results: { region: string; profiles: AmazonProfile[] }[] = [];
    const regions: ('EU' | 'NA' | 'FE')[] = ['EU', 'NA', 'FE'];

    for (const region of regions) {
      try {
        const client = this.getClient(region);
        const profiles = await client.getProfiles();
        results.push({ region, profiles });
      } catch (error) {
        console.log(`⚠️  Regione ${region} non configurata o errore`);
      }
    }

    return results;
  }

  // Recupera le campagne per un marketplace specifico
  async getCampaignsForMarketplace(marketplace: string): Promise<Campaign[]> {
    const region = MARKETPLACE_TO_REGION[marketplace.toUpperCase()];
    const profileId = getProfileIdForMarketplace(marketplace);

    if (!region || !profileId) {
      console.error(`❌ Marketplace ${marketplace} non configurato`);
      return [];
    }

    const client = this.getClient(region);
    return await client.getCampaigns(profileId);
  }

  // Recupera le performance per un marketplace
  async getPerformanceForMarketplace(
    marketplace: string,
    startDate: string,
    endDate: string
  ): Promise<MarketplacePerformance | null> {
    const region = MARKETPLACE_TO_REGION[marketplace.toUpperCase()];
    const profileId = getProfileIdForMarketplace(marketplace);

    if (!region || !profileId) {
      console.error(`❌ Marketplace ${marketplace} non configurato`);
      return null;
    }

    try {
      const client = this.getClient(region);

      // Richiedi il report
      const reportId = await client.requestPerformanceReport(profileId, startDate, endDate);
      if (!reportId) return null;

      // Attendi e scarica
      const reportData = await client.waitAndDownloadReport(profileId, reportId);

      // Calcola le metriche aggregate
      let totalSpend = 0;
      let totalSales = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalOrders = 0;

      const campaigns: CampaignPerformance[] = reportData.map((row: any) => {
        const cost = parseFloat(row.cost) || 0;
        const sales = parseFloat(row.sales30d) || 0;
        const impressions = parseInt(row.impressions) || 0;
        const clicks = parseInt(row.clicks) || 0;
        const orders = parseInt(row.purchases30d) || 0;

        totalSpend += cost;
        totalSales += sales;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalOrders += orders;

        return {
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          impressions,
          clicks,
          cost,
          sales,
          orders,
          acos: sales > 0 ? (cost / sales) * 100 : 0,
          roas: cost > 0 ? sales / cost : 0,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? cost / clicks : 0
        };
      });

      // Determina la valuta dal profilo
      const profiles = await client.getProfiles();
      const profile = profiles.find(p => p.profileId.toString() === profileId);
      const currency = profile?.currencyCode || 'USD';

      return {
        marketplace: marketplace.toUpperCase(),
        currency,
        totalSpend,
        totalSales,
        totalImpressions,
        totalClicks,
        totalOrders,
        acos: totalSales > 0 ? (totalSpend / totalSales) * 100 : 0,
        roas: totalSpend > 0 ? totalSales / totalSpend : 0,
        campaigns
      };
    } catch (error: any) {
      console.error(`❌ Errore recupero performance ${marketplace}:`, error.message);
      return null;
    }
  }

  // Recupera le performance per tutti i marketplace configurati
  async getAllMarketplacesPerformance(
    startDate: string,
    endDate: string
  ): Promise<MarketplacePerformance[]> {
    const marketplaces = ['US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'AU'];
    const results: MarketplacePerformance[] = [];

    for (const marketplace of marketplaces) {
      const profileId = getProfileIdForMarketplace(marketplace);
      if (!profileId) continue;

      console.log(`📊 Recupero performance per ${marketplace}...`);
      const performance = await this.getPerformanceForMarketplace(marketplace, startDate, endDate);
      if (performance) {
        results.push(performance);
      }
    }

    return results;
  }

  // Riepilogo spesa totale per tutti i marketplace
  async getTotalSpendSummary(
    startDate: string,
    endDate: string
  ): Promise<{
    totalSpendUSD: number;
    totalSalesUSD: number;
    overallAcos: number;
    overallRoas: number;
    byMarketplace: { marketplace: string; spend: number; sales: number; currency: string }[]
  }> {
    const performances = await this.getAllMarketplacesPerformance(startDate, endDate);

    // Nota: per una conversione accurata servirebbe un servizio di cambio valuta
    // Per ora assumiamo valori approssimativi o la stessa valuta
    let totalSpend = 0;
    let totalSales = 0;

    const byMarketplace = performances.map(p => {
      totalSpend += p.totalSpend;
      totalSales += p.totalSales;
      return {
        marketplace: p.marketplace,
        spend: p.totalSpend,
        sales: p.totalSales,
        currency: p.currency
      };
    });

    return {
      totalSpendUSD: totalSpend,
      totalSalesUSD: totalSales,
      overallAcos: totalSales > 0 ? (totalSpend / totalSales) * 100 : 0,
      overallRoas: totalSpend > 0 ? totalSales / totalSpend : 0,
      byMarketplace
    };
  }

  // Recupera spesa per ASIN su tutti i marketplace configurati (SP ora, SD/SB in futuro)
  async getAllAsinSpend(startDate: string, endDate: string): Promise<AsinSpendRow[]> {
    const marketplaces = ['US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'AU'];
    const results: AsinSpendRow[] = [];

    // Richiedi tutti i report SP in parallelo (uno per marketplace)
    const tasks = marketplaces
      .filter(mp => !!getProfileIdForMarketplace(mp))
      .map(marketplace => (async () => {
        const profileId = getProfileIdForMarketplace(marketplace);
        const regionStr = MARKETPLACE_TO_REGION[marketplace.toUpperCase()];
        if (!profileId || !regionStr) return;

        try {
          const client = this.getClient(regionStr as 'EU' | 'NA' | 'FE');

          // Report SP per ASIN
          const reportId = await client.requestAdvertisedProductReport(profileId, startDate, endDate, 'SP');
          if (!reportId) return;

          // Polling fino a ~7 minuti (210 tentativi × 2s)
          const data = await client.waitAndDownloadReport(profileId, reportId, 210);
          for (const row of data) {
            if (!row.advertisedAsin) continue;
            results.push({
              marketplace,
              asin: row.advertisedAsin,
              adType: 'SP',
              spend7d: parseFloat(row.cost) || 0,
              sales7d: parseFloat(row.sales14d) || 0,
              impressions7d: parseInt(row.impressions) || 0,
              clicks7d: parseInt(row.clicks) || 0,
            });
          }
          console.log(`✅ [getAllAsinSpend] ${marketplace} SP: ${data.length} ASIN trovati`);
        } catch (e: any) {
          console.error(`❌ [getAllAsinSpend] ${marketplace} SP fallito:`, e.message);
        }
      })());

    await Promise.allSettled(tasks);
    return results;
  }
}

// Esporta istanza singleton
export const amazonAdsService = new AmazonAdsService();
