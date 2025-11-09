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
  // METODI PER CAMPAGNE
  // ================================================

  // Recupera tutte le campagne del profilo
  async getCampaigns(): Promise<any[]> {
    try {
      console.log('📥 Recupero campagne...');

      const response = await this.client.get('/v2/sp/campaigns');

      console.log(`✅ Trovate ${response.data.length} campagne`);
      return response.data;
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
}

// Esporta un'istanza unica del servizio (Singleton pattern)
// In questo modo usi sempre lo stesso client con lo stesso token
export const amazonApiService = new AmazonApiService();
