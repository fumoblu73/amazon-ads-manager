// ================================================
// SERVIZIO SYNC AD SPEND - Amazon Ads API → KdpDailyStats
// ================================================
// Sincronizza i dati di spesa pubblicitaria da Amazon Ads API
// al database KdpDailyStats per calcolare ROI/ACoS nella dashboard

import axios from 'axios';
import * as zlib from 'zlib';
import { AppDataSource } from '../config/database';
import { KdpDailyStats } from '../models/KdpDailyStats';
import {
  getProfileIdForMarketplace,
  getCredentialsForMarketplace,
  MARKETPLACE_TO_REGION
} from '../config/amazon';

interface DailySpendData {
  date: string;
  marketplace: string;
  totalSpend: number;
  totalSales: number;
  totalImpressions: number;
  totalClicks: number;
  totalOrders: number;
}

interface CampaignDailyData {
  date: string;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  sales: number;
  orders: number;
}

class AdsSpendSyncService {
  private accessTokens: Map<string, { token: string; expiry: number }> = new Map();

  /**
   * Ottiene un access token per una regione specifica
   */
  private async getAccessToken(marketplace: string): Promise<string> {
    const credentialsInfo = getCredentialsForMarketplace(marketplace);
    if (!credentialsInfo) {
      throw new Error(`Credenziali non trovate per marketplace ${marketplace}`);
    }

    const { credentials, region } = credentialsInfo;
    const cacheKey = region;

    // Check cache
    const cached = this.accessTokens.get(cacheKey);
    if (cached && cached.expiry > Date.now() + 60000) {
      return cached.token;
    }

    // Refresh token
    console.log(`🔄 [${region}] Rinnovo access token per sync ad spend...`);

    const response = await axios.post('https://api.amazon.com/auth/o2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const token = response.data.access_token;
    const expiry = Date.now() + (response.data.expires_in * 1000);

    this.accessTokens.set(cacheKey, { token, expiry });
    console.log(`✅ [${region}] Access token ottenuto`);

    return token;
  }

  /**
   * Richiede un report giornaliero delle performance per un marketplace
   */
  private async requestDailyReport(
    marketplace: string,
    startDate: string,
    endDate: string
  ): Promise<string | null> {
    const credentialsInfo = getCredentialsForMarketplace(marketplace);
    const profileId = getProfileIdForMarketplace(marketplace);

    if (!credentialsInfo || !profileId) {
      console.log(`⚠️ Marketplace ${marketplace} non configurato`);
      return null;
    }

    const { credentials, endpoint } = credentialsInfo;

    try {
      const accessToken = await this.getAccessToken(marketplace);

      console.log(`📊 [${marketplace}] Richiesta report giornaliero ${startDate} - ${endDate}...`);

      const response = await axios.post(`${endpoint}/reporting/reports`, {
        name: `Daily Performance Report - ${marketplace}`,
        startDate,
        endDate,
        configuration: {
          adProduct: 'SPONSORED_PRODUCTS',
          groupBy: ['campaign'],
          columns: [
            'date',
            'campaignId',
            'campaignName',
            'impressions',
            'clicks',
            'cost',
            'purchases30d',
            'sales30d'
          ],
          reportTypeId: 'spCampaigns',
          timeUnit: 'DAILY',  // IMPORTANTE: breakdown giornaliero
          format: 'GZIP_JSON'
        }
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Amazon-Advertising-API-ClientId': credentials.clientId,
          'Amazon-Advertising-API-Scope': profileId,
          'Content-Type': 'application/vnd.createasyncreportrequest.v3+json'
        }
      });

      console.log(`✅ [${marketplace}] Report richiesto: ${response.data.reportId}`);
      return response.data.reportId;
    } catch (error: any) {
      console.error(`❌ [${marketplace}] Errore richiesta report:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Controlla lo stato di un report e ritorna l'URL quando pronto
   */
  private async waitForReport(
    marketplace: string,
    reportId: string,
    maxAttempts: number = 30
  ): Promise<string | null> {
    const credentialsInfo = getCredentialsForMarketplace(marketplace);
    const profileId = getProfileIdForMarketplace(marketplace);

    if (!credentialsInfo || !profileId) return null;

    const { credentials, endpoint } = credentialsInfo;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const accessToken = await this.getAccessToken(marketplace);

        const response = await axios.get(`${endpoint}/reporting/reports/${reportId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Amazon-Advertising-API-ClientId': credentials.clientId,
            'Amazon-Advertising-API-Scope': profileId
          }
        });

        const status = response.data.status;

        if (status === 'COMPLETED' && response.data.url) {
          console.log(`✅ [${marketplace}] Report pronto`);
          return response.data.url;
        }

        if (status === 'FAILURE') {
          console.error(`❌ [${marketplace}] Report fallito`);
          return null;
        }

        console.log(`   [${marketplace}] Attesa report... (${attempt}/${maxAttempts}) - Status: ${status}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`❌ [${marketplace}] Errore controllo report:`, error.message);
      }
    }

    console.error(`❌ [${marketplace}] Timeout attesa report`);
    return null;
  }

  /**
   * Scarica e decomprime un report
   */
  private async downloadReport(url: string): Promise<CampaignDailyData[]> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer'
      });

      const decompressed = zlib.gunzipSync(response.data);
      const jsonData = JSON.parse(decompressed.toString());

      return jsonData;
    } catch (error: any) {
      console.error(`❌ Errore download report:`, error.message);
      return [];
    }
  }

  /**
   * Aggrega i dati delle campagne per giorno
   */
  private aggregateByDate(
    campaignData: CampaignDailyData[],
    marketplace: string
  ): DailySpendData[] {
    const byDate = new Map<string, DailySpendData>();

    for (const row of campaignData) {
      const date = row.date;

      if (!byDate.has(date)) {
        byDate.set(date, {
          date,
          marketplace,
          totalSpend: 0,
          totalSales: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalOrders: 0
        });
      }

      const daily = byDate.get(date)!;
      daily.totalSpend += parseFloat(String(row.cost)) || 0;
      daily.totalSales += parseFloat(String(row.sales)) || 0;
      daily.totalImpressions += parseInt(String(row.impressions)) || 0;
      daily.totalClicks += parseInt(String(row.clicks)) || 0;
      daily.totalOrders += parseInt(String(row.orders)) || 0;
    }

    return Array.from(byDate.values());
  }

  /**
   * Salva i dati di spend nel database KdpDailyStats
   */
  private async saveSpendData(
    userId: string,
    dailyData: DailySpendData[]
  ): Promise<number> {
    const statsRepo = AppDataSource.getRepository(KdpDailyStats);
    let saved = 0;

    for (const data of dailyData) {
      try {
        // Cerca record esistente per userId, date, marketplace
        // Nota: KdpDailyStats ha unique index su [userId, date, asin]
        // Per ad spend aggregato, usiamo un record speciale senza ASIN specifico
        let existing = await statsRepo.findOne({
          where: {
            userId,
            date: data.date,
            marketplace: data.marketplace,
            asin: '__AGGREGATE__'  // Marker per dati aggregati
          }
        });

        if (existing) {
          // Aggiorna record esistente
          existing.spending = data.totalSpend;
          // Non sovrascriviamo altri campi che potrebbero venire da KDP scraping
          await statsRepo.save(existing);
        } else {
          // Crea nuovo record
          const newStat = statsRepo.create({
            userId,
            date: data.date,
            marketplace: data.marketplace,
            asin: '__AGGREGATE__',
            spending: data.totalSpend,
            grossRoyalties: 0,
            netRoyalties: 0,
            paidUnits: 0,
            freeUnits: 0,
            kenpReads: 0
          });
          await statsRepo.save(newStat);
        }

        saved++;
      } catch (error: any) {
        console.error(`❌ Errore salvataggio spend ${data.date}/${data.marketplace}:`, error.message);
      }
    }

    return saved;
  }

  /**
   * Sincronizza ad spend per un singolo marketplace
   */
  async syncMarketplace(
    userId: string,
    marketplace: string,
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; recordsSaved: number }> {
    console.log(`\n📊 Sync ad spend per ${marketplace} (${startDate} - ${endDate})`);

    try {
      // 1. Richiedi report
      const reportId = await this.requestDailyReport(marketplace, startDate, endDate);
      if (!reportId) {
        return { success: false, recordsSaved: 0 };
      }

      // 2. Attendi completamento
      const reportUrl = await this.waitForReport(marketplace, reportId);
      if (!reportUrl) {
        return { success: false, recordsSaved: 0 };
      }

      // 3. Scarica dati
      const campaignData = await this.downloadReport(reportUrl);
      console.log(`📥 [${marketplace}] Scaricati ${campaignData.length} record campagne`);

      // 4. Aggrega per giorno
      const dailyData = this.aggregateByDate(campaignData, marketplace);
      console.log(`📊 [${marketplace}] Aggregati ${dailyData.length} giorni di dati`);

      // 5. Salva nel database
      const recordsSaved = await this.saveSpendData(userId, dailyData);
      console.log(`✅ [${marketplace}] Salvati ${recordsSaved} record`);

      return { success: true, recordsSaved };
    } catch (error: any) {
      console.error(`❌ [${marketplace}] Errore sync:`, error.message);
      return { success: false, recordsSaved: 0 };
    }
  }

  /**
   * Sincronizza ad spend per tutti i marketplace configurati
   */
  async syncAllMarketplaces(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalRecordsSaved: number;
    marketplaceResults: Array<{
      marketplace: string;
      success: boolean;
      recordsSaved: number;
    }>;
  }> {
    const marketplaces = ['US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'AU'];
    const results: Array<{ marketplace: string; success: boolean; recordsSaved: number }> = [];
    let totalRecordsSaved = 0;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 SYNC AD SPEND - Tutti i marketplace`);
    console.log(`📅 Periodo: ${startDate} - ${endDate}`);
    console.log(`${'='.repeat(60)}`);

    for (const marketplace of marketplaces) {
      const profileId = getProfileIdForMarketplace(marketplace);

      if (!profileId) {
        console.log(`⏭️  Skip ${marketplace} - non configurato`);
        results.push({ marketplace, success: false, recordsSaved: 0 });
        continue;
      }

      const result = await this.syncMarketplace(userId, marketplace, startDate, endDate);
      results.push({ marketplace, ...result });
      totalRecordsSaved += result.recordsSaved;

      // Delay tra marketplace per evitare rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RIEPILOGO SYNC AD SPEND`);
    console.log(`${'='.repeat(60)}`);
    results.forEach(r => {
      const status = r.success ? '✅' : '❌';
      console.log(`   ${status} ${r.marketplace}: ${r.recordsSaved} record`);
    });
    console.log(`   TOTALE: ${totalRecordsSaved} record salvati`);
    console.log(`${'='.repeat(60)}\n`);

    return { totalRecordsSaved, marketplaceResults: results };
  }
}

// Export singleton
export const adsSpendSyncService = new AdsSpendSyncService();
