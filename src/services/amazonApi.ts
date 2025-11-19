// ================================================
// SERVIZIO MULTI-REGION AMAZON ADVERTISING API
// ================================================
// Gestisce chiamate API per tutte le regioni (EU, NA, FE)

import axios, { AxiosInstance } from 'axios';
import {
  API_ENDPOINTS,
  getConfiguredRegions,
  getRegionCredentials,
  MARKETPLACE_TO_REGION
} from '../config/amazon';

// Gestisce una singola regione Amazon API
class RegionApiClient {
  private client: AxiosInstance;
  private accessToken: string = '';
  private tokenExpiry: number = 0;
  private region: 'EU' | 'NA' | 'FE';
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;

  constructor(region: 'EU' | 'NA' | 'FE') {
    const credentials = getRegionCredentials(region);

    if (!credentials) {
      throw new Error(`Credenziali mancanti per regione ${region}`);
    }

    this.region = region;
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    this.refreshToken = credentials.refreshToken;

    // Crea client axios con endpoint corretto per la regione
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

  // Assicura che il token sia valido
  private async ensureValidToken(): Promise<void> {
    const now = Date.now();

    if (this.accessToken && this.tokenExpiry > now) {
      return;
    }

    await this.refreshAccessToken();
  }

  // Rinnova il token di accesso
  private async refreshAccessToken(): Promise<void> {
    try {
      console.log(`🔄 Rinnovo token per regione ${this.region}...`);

      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      console.log(`✅ Token rinnovato per regione ${this.region}`);
    } catch (error) {
      console.error(`❌ Errore rinnovo token ${this.region}:`, error);
      throw new Error(`Impossibile autenticarsi con Amazon API (${this.region})`);
    }
  }

  // Recupera profili per questa regione
  async getProfiles(): Promise<any[]> {
    try {
      const response = await this.client.get('/v2/profiles');
      return response.data;
    } catch (error) {
      console.error(`❌ Errore recupero profili (${this.region}):`, error);
      throw error;
    }
  }

  // Recupera campagne per un profilo specifico
  async getCampaignsForProfile(profileId: string): Promise<any[]> {
    try {
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

      // LOG DETTAGLIATO per debug
      if (campaigns.length === 0) {
        console.log(`   🔍 DEBUG: Risposta Amazon API (${this.region}) per profilo ${profileId}:`);
        console.log(`   📄 Status: ${response.status}`);
        console.log(`   📄 Data:`, JSON.stringify(response.data, null, 2));
      }

      return campaigns;
    } catch (error) {
      console.error(`❌ Errore recupero campagne (${this.region}, profilo ${profileId}):`, error);
      throw error;
    }
  }

  // Tutti gli altri metodi rimangono disponibili tramite il client
  getClient(): AxiosInstance {
    return this.client;
  }

  getRegion(): 'EU' | 'NA' | 'FE' {
    return this.region;
  }
}

// ================================================
// SERVIZIO PRINCIPALE MULTI-REGION
// ================================================
class MultiRegionAmazonApiService {
  private regionClients: Map<'EU' | 'NA' | 'FE', RegionApiClient> = new Map();

  constructor() {
    const configuredRegions = getConfiguredRegions();

    console.log(`🌍 Inizializzazione Amazon API Service per ${configuredRegions.length} regioni: ${configuredRegions.join(', ')}`);

    for (const region of configuredRegions) {
      try {
        const client = new RegionApiClient(region);
        this.regionClients.set(region, client);
        console.log(`  ✅ Client ${region} inizializzato (${API_ENDPOINTS[region]})`);
      } catch (error: any) {
        console.error(`  ❌ Errore inizializzazione client ${region}:`, error.message);
      }
    }

    if (this.regionClients.size === 0) {
      console.error('❌ ERRORE CRITICO: Nessun client Amazon inizializzato');
    }
  }

  // Ottieni client per una regione specifica
  private getClientForRegion(region: 'EU' | 'NA' | 'FE'): RegionApiClient | null {
    return this.regionClients.get(region) || null;
  }

  // Ottieni client per un marketplace specifico
  private getClientForMarketplace(marketplace: string): RegionApiClient | null {
    const region = MARKETPLACE_TO_REGION[marketplace.toUpperCase()];

    if (!region) {
      console.warn(`⚠️  Marketplace ${marketplace} non mappato a una regione`);
      return null;
    }

    const client = this.getClientForRegion(region);

    if (!client) {
      console.warn(`⚠️  Client non disponibile per regione ${region} (marketplace ${marketplace})`);
    }

    return client;
  }

  // ================================================
  // METODI PUBBLICI - PROFILI
  // ================================================

  // Recupera profili da TUTTE le regioni configurate
  async getProfiles(): Promise<any[]> {
    console.log('📥 Recupero profili da tutte le regioni...');

    const allProfiles: any[] = [];

    for (const [region, client] of this.regionClients) {
      try {
        const profiles = await client.getProfiles();
        console.log(`   ✅ ${region}: ${profiles.length} profili`);

        profiles.forEach(profile => {
          console.log(`      - ${profile.accountInfo?.marketplaceStringId || 'N/A'} (${profile.countryCode}): Profile ID ${profile.profileId}`);
        });

        allProfiles.push(...profiles);
      } catch (error: any) {
        console.error(`   ❌ ${region}: Errore recupero profili - ${error.message}`);
      }
    }

    console.log(`✅ Totale profili da tutte le regioni: ${allProfiles.length}`);
    return allProfiles;
  }

  // ================================================
  // METODI PUBBLICI - CAMPAGNE
  // ================================================

  // Recupera campagne da tutti i profili di tutte le regioni
  async getAllCampaignsFromAllProfiles(): Promise<Array<{ campaign: any, profileId: string, countryCode: string }>> {
    try {
      console.log('🌍 Recupero campagne da TUTTE le regioni e profili...');

      // 1. Ottieni tutti i profili da tutte le regioni
      const profiles = await this.getProfiles();
      console.log(`📋 Trovati ${profiles.length} profili totali`);

      const allCampaigns: Array<{ campaign: any, profileId: string, countryCode: string }> = [];

      // 2. Per ogni profilo, recupera le campagne usando il client corretto per marketplace
      for (const profile of profiles) {
        try {
          const profileId = profile.profileId.toString();
          const countryCode = profile.countryCode;

          console.log(`   📥 Profilo ${countryCode} (${profileId})...`);

          const client = this.getClientForMarketplace(countryCode);

          if (!client) {
            console.warn(`      ⚠️  Nessun client disponibile per marketplace ${countryCode}, salto`);
            continue;
          }

          const campaigns = await client.getCampaignsForProfile(profileId);

          // Aggiungi metadata del profilo a ogni campagna
          campaigns.forEach(campaign => {
            allCampaigns.push({
              campaign,
              profileId,
              countryCode
            });
          });

          console.log(`      ✅ ${campaigns.length} campagne trovate`);
        } catch (error: any) {
          console.error(`      ❌ Errore recupero campagne per profilo ${profile.countryCode}:`, error.message);
          // Continua con il prossimo profilo
        }
      }

      console.log(`✅ Totale: ${allCampaigns.length} campagne da ${profiles.length} profili`);
      return allCampaigns;
    } catch (error) {
      console.error('❌ Errore recupero campagne multi-region:', error);
      throw error;
    }
  }

  // Recupera campagne per un profilo specifico
  async getCampaignsForProfile(profileId: string, marketplace?: string): Promise<any[]> {
    console.log(`📥 Recupero campagne per profilo ${profileId}...`);

    // Se marketplace è specificato, usa il client corretto
    if (marketplace) {
      const client = this.getClientForMarketplace(marketplace);

      if (!client) {
        throw new Error(`Client non disponibile per marketplace ${marketplace}`);
      }

      return await client.getCampaignsForProfile(profileId);
    }

    // Altrimenti, prova tutti i client disponibili (backward compatibility)
    for (const [region, client] of this.regionClients) {
      try {
        const campaigns = await client.getCampaignsForProfile(profileId);
        console.log(`✅ Trovate ${campaigns.length} campagne per profilo ${profileId} (${region})`);
        return campaigns;
      } catch (error) {
        console.log(`   ⚠️  Tentativo fallito con regione ${region}, provo la prossima...`);
      }
    }

    console.warn(`⚠️  Profilo ${profileId} non trovato in nessuna regione`);
    return [];
  }

  // Backward compatibility: usa la prima regione disponibile
  async getCampaigns(): Promise<any[]> {
    const firstClient = Array.from(this.regionClients.values())[0];

    if (!firstClient) {
      console.error('❌ Nessun client Amazon disponibile');
      return [];
    }

    const profiles = await firstClient.getProfiles();

    if (profiles.length === 0) {
      return [];
    }

    return await firstClient.getCampaignsForProfile(profiles[0].profileId.toString());
  }

  // ================================================
  // METODI PER AUTOMATION FUNCTIONS
  // ================================================
  // Questi metodi accettano solo marketplace e ricavano automaticamente
  // il profileId corretto chiamando l'API

  // Cache dei profili per marketplace
  private profileCache: Map<string, string> = new Map();

  // Ottieni profileId per un marketplace specifico
  private async getProfileIdForMarketplace(marketplace: string): Promise<string> {
    // Controlla cache
    if (this.profileCache.has(marketplace)) {
      return this.profileCache.get(marketplace)!;
    }

    const client = this.getClientForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    // Ottieni profili per questo client
    const profiles = await client.getProfiles();

    // Trova il profilo che corrisponde al marketplace
    const profile = profiles.find(p => p.countryCode.toUpperCase() === marketplace.toUpperCase());

    if (!profile) {
      throw new Error(`Profilo non trovato per marketplace ${marketplace}`);
    }

    const profileId = profile.profileId.toString();

    // Salva in cache
    this.profileCache.set(marketplace, profileId);

    return profileId;
  }

  // Richiede un report (per keywords, targets, search terms, ecc.)
  async requestReport(marketplace: string, reportType: string, params: any): Promise<string> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    const response = await client.getClient().post('/reporting/reports', {
      reportType,
      ...params
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });

    return response.data.reportId;
  }

  // Attende e scarica un report
  async waitAndDownloadReport(marketplace: string, reportId: string): Promise<any> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    // Attendi che il report sia pronto
    let status = 'IN_PROGRESS';
    let downloadUrl = '';

    for (let i = 0; i < 60; i++) {
      const statusResponse = await client.getClient().get(`/reporting/reports/${reportId}`, {
        headers: {
          'Amazon-Advertising-API-Scope': profileId
        }
      });

      status = statusResponse.data.status;

      if (status === 'SUCCESS') {
        downloadUrl = statusResponse.data.url;
        break;
      }

      if (status === 'FAILURE') {
        throw new Error('Report generation failed');
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    if (!downloadUrl) {
      throw new Error('Report timeout');
    }

    // Scarica il report
    const reportResponse = await client.getClient().get(downloadUrl);
    return reportResponse.data;
  }

  // Ottieni keywords per un ad group
  async getKeywords(marketplace: string, adGroupId: string): Promise<any[]> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    const response = await client.getClient().post('/sp/keywords/list', {
      adGroupIdFilter: {
        include: [adGroupId]
      }
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });

    return response.data.keywords || [];
  }

  // Ottieni targets per un ad group
  async getTargets(marketplace: string, adGroupId: string): Promise<any[]> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    const response = await client.getClient().post('/sp/targets/list', {
      adGroupIdFilter: {
        include: [adGroupId]
      }
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });

    return response.data.targets || [];
  }

  // Aggiorna bid di una keyword
  async updateKeywordBid(marketplace: string, keywordId: string, newBid: number): Promise<void> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    await client.getClient().put(`/sp/keywords/${keywordId}`, {
      bid: newBid
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });
  }

  // Aggiorna bid di un target
  async updateTargetBid(marketplace: string, targetId: string, newBid: number): Promise<void> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    await client.getClient().put(`/sp/targets/${targetId}`, {
      bid: newBid
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });
  }

  // Aggiorna stato di una keyword
  async updateKeywordState(marketplace: string, keywordId: string, state: string): Promise<void> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    await client.getClient().put(`/sp/keywords/${keywordId}`, {
      state
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });
  }

  // Aggiorna stato di un target
  async updateTargetState(marketplace: string, targetId: string, state: string): Promise<void> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    await client.getClient().put(`/sp/targets/${targetId}`, {
      state
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });
  }

  // Aggiorna placements di una campagna
  async updateCampaignPlacements(marketplace: string, campaignId: string, placements: any): Promise<void> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    await client.getClient().put(`/sp/campaigns/${campaignId}`, {
      dynamicBidding: {
        placementBidding: placements
      }
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });
  }

  // Ottieni ad groups auto-targeting
  async getAutoTargetingGroups(marketplace: string, campaignId: string): Promise<any[]> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    const response = await client.getClient().post('/sp/adGroups/list', {
      campaignIdFilter: {
        include: [campaignId]
      }
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });

    return response.data.adGroups || [];
  }

  // Richiedi search terms report
  async requestSearchTermsReport(marketplace: string, params: any): Promise<string> {
    return this.requestReport(marketplace, 'spSearchTerm', params);
  }

  // Aggiungi negative target
  async addNegativeTarget(marketplace: string, campaignId: string, adGroupId: string, expression: any): Promise<void> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    await client.getClient().post('/sp/negativeTargets', {
      campaignId,
      adGroupId,
      expression,
      expressionType: 'manual'
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });
  }

  // Aggiungi negative keyword
  async addNegativeKeyword(marketplace: string, campaignId: string, adGroupId: string, keywordText: string, matchType: string): Promise<void> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    await client.getClient().post('/sp/negativeKeywords', {
      campaignId,
      adGroupId,
      keywordText,
      matchType
    }, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });
  }

  // Aggiungi targets
  async addTargets(marketplace: string, targets: any[]): Promise<any> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    const response = await client.getClient().post('/sp/targets', targets, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });

    return response.data;
  }

  // Aggiungi keywords
  async addKeywords(marketplace: string, keywords: any[]): Promise<any> {
    const client = this.getClientForMarketplace(marketplace);
    const profileId = await this.getProfileIdForMarketplace(marketplace);

    if (!client) {
      throw new Error(`Client non disponibile per marketplace ${marketplace}`);
    }

    const response = await client.getClient().post('/sp/keywords', keywords, {
      headers: {
        'Amazon-Advertising-API-Scope': profileId
      }
    });

    return response.data;
  }
}

// Esporta istanza singleton
export const amazonApiService = new MultiRegionAmazonApiService();
