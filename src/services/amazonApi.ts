// ================================================
// SERVIZIO API AMAZON ADVERTISING
// ================================================
// Questo file gestisce tutte le chiamate all'API di Amazon
// per recuperare e modificare dati delle campagne pubblicitarie

import axios, { AxiosInstance } from 'axios';
import { amazonConfig, getApiEndpoint } from '../config/amazon';

// Classe che gestisce tutte le interazioni con l'API Amazon
class AmazonApiService {
  private client: AxiosInstance;  // Client HTTP per fare richieste
  private accessToken: string = '';  // Token di accesso (si rinnova automaticamente)
  private tokenExpiry: number = 0;   // Timestamp scadenza token

  constructor() {
    // Crea un client axios configurato per Amazon API
    this.client = axios.create({
      baseURL: getApiEndpoint(),  // URL base dell'API
      headers: {
        'Content-Type': 'application/json',
        'Amazon-Advertising-API-ClientId': amazonConfig.clientId
      }
    });

    // Interceptor: modifica ogni richiesta prima di inviarla
    // Aggiunge automaticamente il token di autenticazione
    this.client.interceptors.request.use(async (config) => {
      // Controlla se il token è scaduto e lo rinnova
      await this.ensureValidToken();

      // Aggiunge il token all'header Authorization
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      config.headers['Amazon-Advertising-API-Scope'] = amazonConfig.profileId;

      return config;
    });
  }

  // ================================================
  // GESTIONE AUTENTICAZIONE
  // ================================================

  // Assicura che il token di accesso sia valido
  // Se è scaduto, ne richiede uno nuovo
  private async ensureValidToken(): Promise<void> {
    const now = Date.now();

    // Se il token è ancora valido, non fare nulla
    if (this.accessToken && this.tokenExpiry > now) {
      return;
    }

    // Altrimenti, rinnova il token
    await this.refreshAccessToken();
  }

  // Rinnova il token di accesso usando il refresh token
  private async refreshAccessToken(): Promise<void> {
    try {
      console.log('🔄 Rinnovo token di accesso Amazon...');

      // Chiamata all'endpoint di autenticazione Amazon
      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        refresh_token: amazonConfig.refreshToken,
        client_id: amazonConfig.clientId,
        client_secret: amazonConfig.clientSecret
      });

      // Salva il nuovo token e calcola quando scadrà
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      console.log('✅ Token rinnovato con successo');
    } catch (error) {
      console.error('❌ Errore rinnovo token:', error);
      throw new Error('Impossibile autenticarsi con Amazon API');
    }
  }

  // ================================================
  // METODI PER PROFILI
  // ================================================

  // Recupera tutti i profili disponibili per l'account
  async getProfiles(): Promise<any[]> {
    try {
      console.log('📥 Recupero profili disponibili...');

      const response = await this.client.get('/v2/profiles');

      console.log(`✅ Trovati ${response.data.length} profili`);
      response.data.forEach((profile: any) => {
        console.log(`   - ${profile.accountInfo?.marketplaceStringId} (${profile.countryCode}): Profile ID ${profile.profileId} - ${profile.accountInfo?.name || 'N/A'}`);
      });

      return response.data;
    } catch (error) {
      console.error('❌ Errore recupero profili:', error);
      throw error;
    }
  }

  // ================================================
  // METODI PER CAMPAGNE
  // ================================================

  // Recupera tutte le campagne del profilo
  async getCampaigns(): Promise<any[]> {
    try {
      console.log('📥 Recupero campagne...');

      // Amazon API v3 richiede Content-Type e Accept specifici
      const response = await this.client.post('/sp/campaigns/list', {
        maxResults: 1000,
        stateFilter: {
          include: ['ENABLED', 'PAUSED', 'ARCHIVED']
        }
      }, {
        headers: {
          'Content-Type': 'application/vnd.spcampaign.v3+json',
          'Accept': 'application/vnd.spcampaign.v3+json'
        }
      });

      const campaigns = response.data.campaigns || [];
      console.log(`✅ Trovate ${campaigns.length} campagne`);
      return campaigns;
    } catch (error) {
      console.error('❌ Errore recupero campagne:', error);
      throw error;
    }
  }

  // Recupera i dettagli di una singola campagna
  async getCampaign(campaignId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/sp/campaigns/${campaignId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore recupero campagna ${campaignId}:`, error);
      throw error;
    }
  }

  // ================================================
  // METODI PER KEYWORD
  // ================================================

  // Recupera tutte le keyword di una campagna
  async getKeywords(campaignId?: string): Promise<any[]> {
    try {
      console.log('📥 Recupero keywords...');

      // Se specificato un campaignId, filtra per quella campagna
      const params = campaignId ? { campaignIdFilter: campaignId } : {};

      const response = await this.client.get('/v2/sp/keywords', { params });

      console.log(`✅ Trovate ${response.data.length} keywords`);
      return response.data;
    } catch (error) {
      console.error('❌ Errore recupero keywords:', error);
      throw error;
    }
  }

  // Aggiorna il bid di una keyword
  async updateKeywordBid(keywordId: string, newBid: number): Promise<any> {
    try {
      console.log(`🔧 Aggiorno bid keyword ${keywordId} a ${newBid}...`);

      const response = await this.client.put(`/v2/sp/keywords/${keywordId}`, {
        bid: newBid
      });

      console.log(`✅ Bid aggiornato con successo`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore aggiornamento bid keyword ${keywordId}:`, error);
      throw error;
    }
  }

  // Mette in pausa o attiva una keyword
  async updateKeywordState(keywordId: string, state: 'enabled' | 'paused'): Promise<any> {
    try {
      console.log(`🔧 Imposto keyword ${keywordId} a ${state}...`);

      const response = await this.client.put(`/v2/sp/keywords/${keywordId}`, {
        state: state
      });

      console.log(`✅ Stato keyword aggiornato`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore aggiornamento stato keyword ${keywordId}:`, error);
      throw error;
    }
  }

  // ================================================
  // METODI PER REPORT E METRICHE
  // ================================================

  // Richiede un report delle performance
  // Amazon genera il report in modo asincrono
  async requestReport(reportDate: string, metrics: string[]): Promise<string> {
    try {
      console.log(`📊 Richiesta report per ${reportDate}...`);

      const response = await this.client.post('/v2/sp/keywords/report', {
        reportDate: reportDate,  // Formato: YYYYMMDD
        metrics: metrics  // Es: ['impressions', 'clicks', 'cost', 'sales']
      });

      // Ritorna l'ID del report (da usare per scaricarlo dopo)
      const reportId = response.data.reportId;
      console.log(`✅ Report richiesto. ID: ${reportId}`);

      return reportId;
    } catch (error) {
      console.error('❌ Errore richiesta report:', error);
      throw error;
    }
  }

  // Controlla lo stato di un report
  async getReportStatus(reportId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/reports/${reportId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore controllo stato report ${reportId}:`, error);
      throw error;
    }
  }

  // Scarica un report completato
  async downloadReport(reportId: string): Promise<any> {
    try {
      // Prima controlla lo stato
      const status = await this.getReportStatus(reportId);

      if (status.status !== 'SUCCESS') {
        throw new Error(`Report non pronto. Stato: ${status.status}`);
      }

      // Scarica il report dall'URL fornito
      const reportData = await axios.get(status.location);

      console.log(`✅ Report scaricato`);
      return reportData.data;
    } catch (error) {
      console.error(`❌ Errore download report ${reportId}:`, error);
      throw error;
    }
  }

  // ================================================
  // METODI PER PLACEMENT BIDDING (Funzione 2)
  // ================================================

  /**
   * Aggiorna i placement bid adjustments di una campagna
   * I placement sono: Top of Search, Rest of Search, Product Pages
   */
  async updateCampaignPlacements(
    campaignId: string,
    placements: {
      topOfSearch?: number;
      restOfSearch?: number;
      productPages?: number;
    }
  ): Promise<any> {
    try {
      console.log(`🔧 Aggiorno placements campagna ${campaignId}...`);

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

      console.log(`✅ Placements aggiornati`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore aggiornamento placements campagna ${campaignId}:`, error);
      throw error;
    }
  }

  // ================================================
  // METODI PER TARGET (Product Targeting)
  // ================================================

  /**
   * Recupera tutti i target (prodotti) di una campagna
   */
  async getTargets(campaignId?: string): Promise<any[]> {
    try {
      console.log('📥 Recupero targets...');

      const params = campaignId ? { campaignIdFilter: campaignId } : {};
      const response = await this.client.get('/v2/sp/targets', { params });

      console.log(`✅ Trovati ${response.data.length} targets`);
      return response.data;
    } catch (error) {
      console.error('❌ Errore recupero targets:', error);
      throw error;
    }
  }

  /**
   * Aggiorna il bid di un target
   */
  async updateTargetBid(targetId: string, newBid: number): Promise<any> {
    try {
      console.log(`🔧 Aggiorno bid target ${targetId} a ${newBid}...`);

      const response = await this.client.put(`/v2/sp/targets/${targetId}`, {
        bid: newBid
      });

      console.log(`✅ Bid target aggiornato`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore aggiornamento bid target ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Mette in pausa o attiva un target
   */
  async updateTargetState(targetId: string, state: 'enabled' | 'paused'): Promise<any> {
    try {
      console.log(`🔧 Imposto target ${targetId} a ${state}...`);

      const response = await this.client.put(`/v2/sp/targets/${targetId}`, {
        state: state
      });

      console.log(`✅ Stato target aggiornato`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore aggiornamento stato target ${targetId}:`, error);
      throw error;
    }
  }

  // ================================================
  // METODI PER AUTO ADS (Funzione 4)
  // ================================================

  /**
   * Recupera i targeting groups di una campagna automatica
   * Groups: complements, loose match, close match, substitutes
   */
  async getAutoTargetingGroups(campaignId: string): Promise<any[]> {
    try {
      console.log(`📥 Recupero auto targeting groups per campagna ${campaignId}...`);

      const response = await this.client.get('/v2/sp/targets', {
        params: {
          campaignIdFilter: campaignId,
          expressionType: 'AUTO'
        }
      });

      console.log(`✅ Trovati ${response.data.length} auto targeting groups`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore recupero auto targeting groups:`, error);
      throw error;
    }
  }

  /**
   * Aggiunge una negative keyword
   */
  async addNegativeKeyword(
    campaignId: string,
    adGroupId: string,
    keyword: string,
    matchType: 'negativeExact' | 'negativePhrase'
  ): Promise<any> {
    try {
      console.log(`➖ Aggiungo negative keyword "${keyword}" (${matchType})...`);

      const response = await this.client.post('/v2/sp/negativeKeywords', [{
        campaignId,
        adGroupId,
        keywordText: keyword,
        matchType,
        state: 'enabled'
      }]);

      console.log(`✅ Negative keyword aggiunta`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore aggiunta negative keyword:`, error);
      throw error;
    }
  }

  /**
   * Aggiunge un negative target (ASIN)
   */
  async addNegativeTarget(
    campaignId: string,
    adGroupId: string,
    asin: string
  ): Promise<any> {
    try {
      console.log(`➖ Aggiungo negative target ASIN ${asin}...`);

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

      console.log(`✅ Negative target aggiunto`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore aggiunta negative target:`, error);
      throw error;
    }
  }

  // ================================================
  // METODI PER SEARCH TERMS (Funzione 5 - Campaign Feeding)
  // ================================================

  /**
   * Richiede un report dei search terms
   */
  async requestSearchTermsReport(
    startDate: string,
    endDate: string,
    campaignIdFilter?: string
  ): Promise<string> {
    try {
      console.log(`📊 Richiesta report search terms ${startDate} - ${endDate}...`);

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
      console.log(`✅ Report search terms richiesto. ID: ${reportId}`);

      return reportId;
    } catch (error) {
      console.error('❌ Errore richiesta report search terms:', error);
      throw error;
    }
  }

  /**
   * Aggiunge keyword a una campagna
   */
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
      console.log(`➕ Aggiungo ${keywords.length} keywords alla campagna ${campaignId}...`);

      const keywordsData = keywords.map(kw => ({
        campaignId,
        adGroupId,
        keywordText: kw.keywordText,
        matchType: kw.matchType,
        bid: kw.bid,
        state: 'enabled'
      }));

      const response = await this.client.post('/v2/sp/keywords', keywordsData);

      console.log(`✅ Keywords aggiunte`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore aggiunta keywords:`, error);
      throw error;
    }
  }

  /**
   * Aggiunge target (ASIN) a una campagna
   */
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
      console.log(`➕ Aggiungo ${targets.length} targets alla campagna ${campaignId}...`);

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

      console.log(`✅ Targets aggiunti`);
      return response.data;
    } catch (error) {
      console.error(`❌ Errore aggiunta targets:`, error);
      throw error;
    }
  }

  // ================================================
  // METODI PER RECUPERARE METRICHE DA REPORT
  // ================================================

  /**
   * Recupera le performance di keyword/target da un report
   * Aspetta che il report sia pronto e lo scarica
   */
  async waitAndDownloadReport(reportId: string, maxAttempts: number = 10): Promise<any> {
    try {
      console.log(`⏳ Attendo completamento report ${reportId}...`);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const status = await this.getReportStatus(reportId);

        if (status.status === 'SUCCESS') {
          console.log(`✅ Report pronto, scarico...`);
          const reportData = await axios.get(status.location);
          return reportData.data;
        }

        if (status.status === 'FAILURE') {
          throw new Error(`Report fallito: ${status.statusDetails || 'Unknown error'}`);
        }

        // Aspetta 5 secondi prima di riprovare
        console.log(`   Tentativo ${attempt}/${maxAttempts}: status=${status.status}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      throw new Error(`Report non pronto dopo ${maxAttempts} tentativi`);
    } catch (error) {
      console.error(`❌ Errore attesa/download report:`, error);
      throw error;
    }
  }
}

// Esporta un'istanza unica del servizio (Singleton pattern)
// In questo modo usi sempre lo stesso client con lo stesso token
export const amazonApiService = new AmazonApiService();
