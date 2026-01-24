// ================================================
// ROUTES AMAZON ADS API
// ================================================
// Endpoints per recuperare dati dalle Amazon Advertising API

import { Router, Request, Response } from 'express';
import { amazonAdsService } from '../services/amazon-ads.service';
import { adsSpendSyncService } from '../services/ads-spend-sync.service';

const router = Router();

// GET /api/amazon-ads/profiles
// Recupera tutti i profili da tutte le regioni
router.get('/profiles', async (req: Request, res: Response) => {
  try {
    console.log('📥 GET /api/amazon-ads/profiles');
    const profiles = await amazonAdsService.getAllProfiles();
    res.json({
      success: true,
      data: profiles
    });
  } catch (error: any) {
    console.error('❌ Errore recupero profili:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/amazon-ads/campaigns/:marketplace
// Recupera le campagne per un marketplace specifico
router.get('/campaigns/:marketplace', async (req: Request, res: Response) => {
  try {
    const { marketplace } = req.params;
    console.log(`📥 GET /api/amazon-ads/campaigns/${marketplace}`);

    // Import per verificare il profile ID
    const { getProfileIdForMarketplace, MARKETPLACE_TO_REGION } = await import('../config/amazon');
    const profileId = getProfileIdForMarketplace(marketplace);
    const region = MARKETPLACE_TO_REGION[marketplace.toUpperCase()];

    console.log(`🔍 ProfileId: ${profileId}, Region: ${region}`);

    const campaigns = await amazonAdsService.getCampaignsForMarketplace(marketplace);
    res.json({
      success: true,
      marketplace: marketplace.toUpperCase(),
      profileId,
      region,
      count: campaigns.length,
      data: campaigns
    });
  } catch (error: any) {
    console.error('❌ Errore recupero campagne:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/amazon-ads/performance/:marketplace
// Recupera le performance per un marketplace specifico
// Query params: startDate, endDate (formato YYYY-MM-DD)
router.get('/performance/:marketplace', async (req: Request, res: Response) => {
  try {
    const { marketplace } = req.params;
    const { startDate, endDate } = req.query;

    // Default: ultimi 30 giorni
    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`📥 GET /api/amazon-ads/performance/${marketplace} (${start} - ${end})`);

    const performance = await amazonAdsService.getPerformanceForMarketplace(marketplace, start, end);

    if (!performance) {
      return res.status(404).json({
        success: false,
        error: `Nessun dato disponibile per ${marketplace}`
      });
    }

    res.json({
      success: true,
      dateRange: { startDate: start, endDate: end },
      data: performance
    });
  } catch (error: any) {
    console.error('❌ Errore recupero performance:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/amazon-ads/performance
// Recupera le performance per tutti i marketplace
// Query params: startDate, endDate (formato YYYY-MM-DD)
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Default: ultimi 30 giorni
    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`📥 GET /api/amazon-ads/performance (${start} - ${end})`);

    const performances = await amazonAdsService.getAllMarketplacesPerformance(start, end);

    res.json({
      success: true,
      dateRange: { startDate: start, endDate: end },
      marketplacesCount: performances.length,
      data: performances
    });
  } catch (error: any) {
    console.error('❌ Errore recupero performance:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/amazon-ads/summary
// Riepilogo totale spesa e vendite
// Query params: startDate, endDate (formato YYYY-MM-DD)
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Default: ultimi 30 giorni
    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`📥 GET /api/amazon-ads/summary (${start} - ${end})`);

    const summary = await amazonAdsService.getTotalSpendSummary(start, end);

    res.json({
      success: true,
      dateRange: { startDate: start, endDate: end },
      data: summary
    });
  } catch (error: any) {
    console.error('❌ Errore recupero summary:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/amazon-ads/health
// Verifica lo stato della connessione alle API
router.get('/health', async (req: Request, res: Response) => {
  try {
    console.log('📥 GET /api/amazon-ads/health');

    const profiles = await amazonAdsService.getAllProfiles();
    const configuredRegions = profiles.filter(p => p.profiles.length > 0).map(p => p.region);

    res.json({
      success: true,
      status: 'connected',
      configuredRegions,
      totalProfiles: profiles.reduce((sum, p) => sum + p.profiles.length, 0),
      details: profiles.map(p => ({
        region: p.region,
        profileCount: p.profiles.length,
        marketplaces: p.profiles.map(pr => pr.countryCode)
      }))
    });
  } catch (error: any) {
    console.error('❌ Errore health check:', error.message);
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

// ================================================
// SYNC AD SPEND TO DATABASE
// ================================================

// POST /api/amazon-ads/sync-spend
// Sincronizza i dati di spesa pubblicitaria nel database KdpDailyStats
// Body: { startDate, endDate, marketplace? }
router.post('/sync-spend', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, marketplace } = req.body;

    // Default: ultimi 30 giorni
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // TODO: In produzione, recuperare userId dal token JWT
    // Per ora usiamo un userId di test o dal body
    const userId = req.body.userId || 'default-user';

    console.log(`📥 POST /api/amazon-ads/sync-spend`);
    console.log(`   UserId: ${userId}`);
    console.log(`   Periodo: ${start} - ${end}`);
    console.log(`   Marketplace: ${marketplace || 'TUTTI'}`);

    let result;

    if (marketplace) {
      // Sync singolo marketplace
      const syncResult = await adsSpendSyncService.syncMarketplace(userId, marketplace, start, end);
      result = {
        totalRecordsSaved: syncResult.recordsSaved,
        marketplaceResults: [{
          marketplace,
          success: syncResult.success,
          recordsSaved: syncResult.recordsSaved
        }]
      };
    } else {
      // Sync tutti i marketplace
      result = await adsSpendSyncService.syncAllMarketplaces(userId, start, end);
    }

    res.json({
      success: true,
      message: `Sync completato: ${result.totalRecordsSaved} record salvati`,
      dateRange: { startDate: start, endDate: end },
      ...result
    });
  } catch (error: any) {
    console.error('❌ Errore sync ad spend:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/amazon-ads/sync-spend/:marketplace
// Sincronizza i dati di spesa per un singolo marketplace
router.post('/sync-spend/:marketplace', async (req: Request, res: Response) => {
  try {
    const { marketplace } = req.params;
    const { startDate, endDate } = req.body;

    // Default: ultimi 30 giorni
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const userId = req.body.userId || 'default-user';

    console.log(`📥 POST /api/amazon-ads/sync-spend/${marketplace}`);
    console.log(`   Periodo: ${start} - ${end}`);

    const result = await adsSpendSyncService.syncMarketplace(userId, marketplace, start, end);

    res.json({
      success: result.success,
      message: result.success
        ? `Sync ${marketplace} completato: ${result.recordsSaved} record salvati`
        : `Sync ${marketplace} fallito`,
      dateRange: { startDate: start, endDate: end },
      marketplace,
      recordsSaved: result.recordsSaved
    });
  } catch (error: any) {
    console.error('❌ Errore sync ad spend:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
