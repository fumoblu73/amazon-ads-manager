// ================================================
// SERVIZIO API AMAZON ADVERTISING
// ================================================
// Questo file gestisce tutte le chiamate all'API di Amazon
// per recuperare e modificare dati delle campagne pubblicitarie

import axios, { AxiosInstance } from 'axios';
import { amazonConfig, getApiEndpoint } from '../config/amazon';

// Interfaccia per configurazione custom
export interface AmazonApiConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  profileId: string;
  endpoint: string;
  marketplace?: string;
}

// Classe che gestisce tutte le interazioni con l'API Amazon
class AmazonApiService {
  private client: AxiosInstance;  // Client HTTP per fare richieste
  private accessToken: string = '';  // Token di accesso (si rinnova automaticamente)
  private tokenExpiry: number = 0;   // Timestamp scadenza token
  private config: AmazonApiConfig;   // Configurazione (custom o default)
  private marketplace: string;       // Marketplace per logging

  constructor(customConfig?: AmazonApiConfig) {
    // Usa configurazione custom se fornita, altrimenti fallback a config globale
    if (customConfig) {
      this.config = customConfig;
      this.marketplace = customConfig.marketplace || 'CUSTOM';
    } else {
      // Fallback alla configurazione globale legacy
      this.config = {
        clientId: amazonConfig.clientId,
        clientSecret: amazonConfig.clientSecret,
        refreshToken: amazonConfig.refreshToken,
        profileId: amazonConfig.profileId,
        endpoint: getApiEndpoint()
      };
      this.marketplace = 'DEFAULT';
    }

    // Crea un client axios configurato per Amazon API
    this.client = axios.create({
      baseURL: this.config.endpoint,
      headers: {
        'Content-Type': 'application/json',
        'Amazon-Advertising-API-ClientId': this.config.clientId
      }
    });

    // Interceptor: modifica ogni richiesta prima di inviarla
    // Aggiunge automaticamente il token di autenticazione
    this.client.interceptors.request.use(async (config) => {
      // Controlla se il token è scaduto e lo rinnova
      await this.ensureValidToken();

      // Aggiunge il token all'header Authorization
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      config.headers['Amazon-Advertising-API-Scope'] = this.config.profileId;

      return config;
    });
  }

  // Getter per il marketplace
  getMarketplace(): string {
    return this.marketplace;
  }

  // Getter per il profileId
  getProfileId(): string {
    return this.config.profileId;
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
      console.log(`🔄 [${this.marketplace}] Rinnovo token di accesso Amazon...`);

      // Chiamata all'endpoint di autenticazione Amazon
      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      // Salva il nuovo token e calcola quando scadrà
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      console.log(`✅ [${this.marketplace}] Token rinnovato con successo`);
    } catch (error) {
      console.error(`❌ [${this.marketplace}] Errore rinnovo token:`, error);
      throw new Error(`Impossibile autenticarsi con Amazon API per ${this.marketplace}`);
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

  // Recupera tutte le campagne del profilo dell'istanza
  async getCampaigns(): Promise<any[]> {
    // Usa il profileId dell'istanza (non della config globale)
    return this.getCampaignsForProfile(this.config.profileId);
  }

  // Recupera tutte le campagne per un profilo specifico
  async getCampaignsForProfile(profileId: string): Promise<any[]> {
    try {
      console.log(`📥 Recupero campagne per profilo ${profileId}...`);

      // Amazon API v3 richiede Content-Type e Accept specifici
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
      console.log(`✅ Trovate ${campaigns.length} campagne per profilo ${profileId}`);
      return campaigns;
    } catch (error) {
      console.error(`❌ Errore recupero campagne per profilo ${profileId}:`, error);
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
  // METODI PER REPORT E METRICHE (API v3)
  // ================================================

  /**
   * Richiede un report delle performance usando l'API v3
   * Amazon genera il report in modo asincrono
   * @param startDate - Data inizio (formato: YYYY-MM-DD)
   * @param endDate - Data fine (formato: YYYY-MM-DD)
   * @param reportType - Tipo report: 'spTargeting' | 'spCampaigns' | 'spSearchTerm'
   * @param columns - Colonne da includere
   */
  async requestReportV3(
    startDate: string,
    endDate: string,
    reportType: 'spTargeting' | 'spCampaigns' | 'spSearchTerm' = 'spTargeting',
    columns: string[] = ['impressions', 'clicks', 'cost', 'sales14d', 'purchases14d']
  ): Promise<string> {
    try {
      console.log(`📊 [API v3] Richiesta report ${reportType} dal ${startDate} al ${endDate}...`);

      // Mappa le colonne per API v3 (alcune hanno nomi diversi)
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

      // Aggiungi colonne obbligatorie per l'identificazione (nomi corretti API v3)
      const requiredCols = ['campaignId', 'adGroupId'];
      if (reportType === 'spTargeting') {
        requiredCols.push('keywordId', 'targeting');
      }
      if (reportType === 'spSearchTerm') {
        requiredCols.push('keyword');
      }

      const allColumns = [...new Set([...requiredCols, ...v3Columns])];

      const requestBody = {
        name: `Automation Report ${new Date().toISOString()}`,
        startDate: startDate,
        endDate: endDate,
        configuration: {
          adProduct: 'SPONSORED_PRODUCTS',
          groupBy: reportType === 'spSearchTerm' ? ['searchTerm'] : ['targeting'],
          columns: allColumns,
          reportTypeId: reportType,
          timeUnit: 'SUMMARY',
          format: 'GZIP_JSON'
        }
      };

      console.log(`📋 Request body:`, JSON.stringify(requestBody, null, 2));

      const response = await this.client.post('/reporting/reports', requestBody);

      const reportId = response.data.reportId;
      console.log(`✅ [API v3] Report richiesto. ID: ${reportId}`);

      return reportId;
    } catch (error: any) {
      console.error('❌ [API v3] Errore richiesta report:', error.response?.data || error.message);
      throw error;
    }
  }

  // Metodo legacy per compatibilità - converte al nuovo formato
  async requestReport(reportDate: string, metrics: string[]): Promise<string> {
    // Converte da formato YYYYMMDD a YYYY-MM-DD
    const year = reportDate.substring(0, 4);
    const month = reportDate.substring(4, 6);
    const day = reportDate.substring(6, 8);
    const formattedDate = `${year}-${month}-${day}`;

    // Usa lo stesso giorno come start e end per report giornaliero
    return this.requestReportV3(formattedDate, formattedDate, 'spTargeting', metrics);
  }

  // Controlla lo stato di un report (API v3)
  async getReportStatus(reportId: string): Promise<any> {
    try {
      const response = await this.client.get(`/reporting/reports/${reportId}`);
      console.log(`📊 [API v3] Stato report ${reportId}: ${response.data.status}`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [API v3] Errore controllo stato report ${reportId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Scarica un report completato (API v3)
  async downloadReport(reportId: string): Promise<any[]> {
    try {
      // Prima controlla lo stato
      const status = await this.getReportStatus(reportId);

      if (status.status !== 'COMPLETED') {
        throw new Error(`Report non pronto. Stato: ${status.status}`);
      }

      if (!status.url) {
        throw new Error('URL download non disponibile');
      }

      console.log(`📥 [API v3] Scaricamento report da: ${status.url.substring(0, 100)}...`);

      // Scarica il file GZIP
      const reportResponse = await axios.get(status.url, {
        responseType: 'arraybuffer',
        decompress: true
      });

      // Decomprimi e parse JSON
      const zlib = require('zlib');
      const decompressed = zlib.gunzipSync(reportResponse.data);
      const jsonData = JSON.parse(decompressed.toString('utf-8'));

      console.log(`✅ [API v3] Report scaricato: ${Array.isArray(jsonData) ? jsonData.length : 0} righe`);
      return Array.isArray(jsonData) ? jsonData : [];
    } catch (error: any) {
      console.error(`❌ [API v3] Errore download report ${reportId}:`, error.message);
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
   * Richiede un report dei search terms (API v3)
   */
  async requestSearchTermsReport(
    startDate: string,
    endDate: string,
    campaignIdFilter?: string
  ): Promise<string> {
    try {
      console.log(`📊 [API v3] Richiesta report search terms ${startDate} - ${endDate}...`);

      const columns = [
        'campaignId',
        'adGroupId',
        'keywordId',
        'targeting',
        'keyword',
        'impressions',
        'clicks',
        'cost',
        'sales14d',
        'purchases14d'
      ];

      const requestBody: any = {
        name: `Search Terms Report ${new Date().toISOString()}`,
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

      // Nota: API v3 non supporta campaignIdFilter nel corpo, filtrare dopo il download
      if (campaignIdFilter) {
        console.log(`   [API v3] Filtro campagna: ${campaignIdFilter} (applicato post-download)`);
      }

      const response = await this.client.post('/reporting/reports', requestBody);

      const reportId = response.data.reportId;
      console.log(`✅ [API v3] Report search terms richiesto. ID: ${reportId}`);

      return reportId;
    } catch (error: any) {
      console.error('❌ [API v3] Errore richiesta report search terms:', error.response?.data || error.message);
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
   * Recupera le performance di keyword/target da un report (API v3)
   * Aspetta che il report sia pronto e lo scarica
   */
  async waitAndDownloadReport(reportId: string, maxAttempts: number = 30): Promise<any[]> {
    try {
      console.log(`⏳ [API v3] Attendo completamento report ${reportId}...`);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const status = await this.getReportStatus(reportId);

        // API v3 usa 'COMPLETED' invece di 'SUCCESS'
        if (status.status === 'COMPLETED') {
          console.log(`✅ [API v3] Report pronto, scarico...`);
          return await this.downloadReport(reportId);
        }

        if (status.status === 'FAILURE' || status.status === 'FAILED') {
          throw new Error(`Report fallito: ${status.failureReason || status.statusDetails || 'Unknown error'}`);
        }

        // Aspetta 3 secondi prima di riprovare (ridotto per API v3 che è più veloce)
        console.log(`   [API v3] Tentativo ${attempt}/${maxAttempts}: status=${status.status}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      throw new Error(`Report non pronto dopo ${maxAttempts} tentativi`);
    } catch (error: any) {
      console.error(`❌ [API v3] Errore attesa/download report:`, error.message);
      throw error;
    }
  }
}

// Esporta la classe per permettere la creazione di istanze custom
export { AmazonApiService };

// Esporta un'istanza unica del servizio (Singleton pattern)
// Usata per backward compatibility con codice esistente
export const amazonApiService = new AmazonApiService();
