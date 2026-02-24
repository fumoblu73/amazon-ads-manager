// ================================================
// ROUTES AMAZON ADS API
// ================================================
// Endpoints per recuperare dati dalle Amazon Advertising API

import { Router, Request, Response } from 'express';
import { amazonAdsService, AsinSpendRow } from '../services/amazon-ads.service';
import { adsSpendSyncService } from '../services/ads-spend-sync.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { MonthlyAdsSpend } from '../entities/MonthlyAdsSpend';
import { createMarketplaceApiService, isMarketplaceConfigured } from '../services/MarketplaceApiFactory';

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

// ================================================
// GET /api/amazon-ads/spend-cache - Legge spesa 7gg dalla cache DB (istantaneo)
// ================================================
router.get('/spend-cache', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: req.userId! },
      select: ['spendCache7d', 'salesCache7d', 'spendCacheUpdatedAt']
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Breakdown per tipo di campagna (SP / SD / SB) da book_spend_cache
    const byAdTypeRows = await AppDataSource.query(`
      SELECT ad_type,
        COALESCE(SUM(spend_7d), 0)::float AS spend,
        COALESCE(SUM(sales_7d), 0)::float AS sales
      FROM book_spend_cache
      WHERE user_id = $1
      GROUP BY ad_type
    `, [req.userId]);

    const byAdType: Record<string, { spend7d: number; sales7d: number; avgDailySpend: number }> = {
      SP: { spend7d: 0, sales7d: 0, avgDailySpend: 0 },
      SD: { spend7d: 0, sales7d: 0, avgDailySpend: 0 },
      SB: { spend7d: 0, sales7d: 0, avgDailySpend: 0 }
    };
    for (const row of byAdTypeRows) {
      const spend = parseFloat(row.spend) || 0;
      const sales = parseFloat(row.sales) || 0;
      byAdType[row.ad_type] = { spend7d: spend, sales7d: sales, avgDailySpend: spend / 7 };
    }

    const totalSpend = user.spendCache7d ? parseFloat(user.spendCache7d.toString()) : null;
    const totalSales = user.salesCache7d ? parseFloat(user.salesCache7d.toString()) : null;

    res.json({
      success: true,
      data: {
        totalSpend7d: totalSpend,
        totalSales7d: totalSales,
        avgDailySpend: totalSpend !== null ? totalSpend / 7 : null,
        acos: totalSpend && totalSales && totalSales > 0
          ? (totalSpend / totalSales) * 100
          : null,
        byAdType,
        updatedAt: user.spendCacheUpdatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================
// POST /api/amazon-ads/refresh-spend - Aggiorna cache spesa (chiamato dallo scheduler, richiede ADMIN_TOKEN)
// Accetta: Authorization: Bearer <token>  OPPURE  ?adminToken=<token>
// Risponde immediatamente, esegue in background (compatibile con timeout cron-job.org)
// ================================================
router.post('/refresh-spend', async (req: Request, res: Response) => {
  try {
    const adminToken = process.env.ADMIN_TOKEN;
    const authHeader = req.headers.authorization;
    const queryToken = req.query.adminToken as string | undefined;
    const isAuthorized = (authHeader && authHeader === `Bearer ${adminToken}`)
      || (queryToken && queryToken === adminToken);

    if (!isAuthorized) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Risposta immediata al cron (evita timeout cron-job.org)
    res.json({ success: true, message: 'Refresh spend avviato in background' });

    // Esegue in background senza bloccare la risposta
    setImmediate(async () => {
      try {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        console.log(`💰 [Spend Cache] Aggiornamento cache spesa ${start} → ${end}`);

        const asinRows: AsinSpendRow[] = await amazonAdsService.getAllAsinSpend(start, end);

        const totalSpend = asinRows.reduce((sum, r) => sum + r.spend7d, 0);
        const totalSales = asinRows.reduce((sum, r) => sum + r.sales7d, 0);

        const userRepo = AppDataSource.getRepository(User);
        const users = await userRepo.find({ where: { isActive: true } });

        for (const user of users) {
          for (const row of asinRows) {
            await AppDataSource.query(`
              INSERT INTO book_spend_cache (user_id, marketplace, asin, ad_type, spend_7d, sales_7d, impressions_7d, clicks_7d, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
              ON CONFLICT (user_id, marketplace, asin, ad_type)
              DO UPDATE SET
                spend_7d = EXCLUDED.spend_7d,
                sales_7d = EXCLUDED.sales_7d,
                impressions_7d = EXCLUDED.impressions_7d,
                clicks_7d = EXCLUDED.clicks_7d,
                updated_at = NOW()
            `, [user.id, row.marketplace, row.asin, row.adType, row.spend7d, row.sales7d, row.impressions7d, row.clicks7d]);
          }

          const [cacheTotal] = await AppDataSource.query(`
            SELECT COALESCE(SUM(spend_7d), 0)::float AS total_spend,
                   COALESCE(SUM(sales_7d), 0)::float AS total_sales
            FROM book_spend_cache WHERE user_id = $1
          `, [user.id]);
          await userRepo.update(user.id, {
            spendCache7d: parseFloat(cacheTotal.total_spend),
            salesCache7d: parseFloat(cacheTotal.total_sales),
            spendCacheUpdatedAt: new Date()
          });
        }

        console.log(`✅ [Spend Cache] ${asinRows.length} ASIN salvati, totale: $${totalSpend.toFixed(2)} spesa / $${totalSales.toFixed(2)} vendite`);
      } catch (bgError: any) {
        console.error('❌ [Spend Cache] Errore background:', bgError.message);
      }
    });
  } catch (error: any) {
    console.error('❌ [Spend Cache] Errore:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================
// GET /api/amazon-ads/book-spend-cache - Spesa per ASIN aggregata (per KDP dashboard)
// ================================================
router.get('/book-spend-cache', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await AppDataSource.query(`
      SELECT asin, ad_type, marketplace, spend_7d, sales_7d, impressions_7d, clicks_7d, updated_at
      FROM book_spend_cache
      WHERE user_id = $1
      ORDER BY spend_7d DESC NULLS LAST
    `, [req.userId]);

    // Aggrega per ASIN
    const byAsin: Record<string, {
      totalSpend7d: number;
      totalSales7d: number;
      avgDailySpend: number;
      acos: number | null;
      byAdType: Record<string, number>;
      byMarketplace: Record<string, number>;
    }> = {};
    let latestUpdate: Date | null = null;

    for (const row of rows) {
      const asin = row.asin;
      if (!byAsin[asin]) {
        byAsin[asin] = { totalSpend7d: 0, totalSales7d: 0, avgDailySpend: 0, acos: null, byAdType: { SP: 0, SD: 0, SB: 0 }, byMarketplace: {} };
      }
      const spend = parseFloat(row.spend_7d) || 0;
      const sales = parseFloat(row.sales_7d) || 0;
      byAsin[asin].totalSpend7d += spend;
      byAsin[asin].totalSales7d += sales;
      byAsin[asin].byAdType[row.ad_type] = (byAsin[asin].byAdType[row.ad_type] || 0) + spend;
      byAsin[asin].byMarketplace[row.marketplace] = (byAsin[asin].byMarketplace[row.marketplace] || 0) + spend;
      if (row.updated_at && (!latestUpdate || new Date(row.updated_at) > latestUpdate)) {
        latestUpdate = new Date(row.updated_at);
      }
    }

    for (const asin of Object.keys(byAsin)) {
      byAsin[asin].avgDailySpend = byAsin[asin].totalSpend7d / 7;
      byAsin[asin].acos = byAsin[asin].totalSales7d > 0
        ? (byAsin[asin].totalSpend7d / byAsin[asin].totalSales7d) * 100
        : null;
    }

    res.json({ success: true, updatedAt: latestUpdate, data: byAsin });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================
// GET /api/amazon-ads/monthly-spend
// Legge storico spesa mensile per marketplace dalla cache DB
// ================================================
router.get('/monthly-spend', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repo = AppDataSource.getRepository(MonthlyAdsSpend);
    const rows = await repo.find({
      where: { userId },
      order: { yearMonth: 'ASC' }
    });

    // Raggruppa per marketplace
    const byMarketplace: Record<string, Array<{ yearMonth: string; spend: number; sales: number }>> = {};
    for (const row of rows) {
      if (!byMarketplace[row.marketplace]) byMarketplace[row.marketplace] = [];
      byMarketplace[row.marketplace].push({
        yearMonth: row.yearMonth,
        spend: parseFloat(row.totalSpend as any) || 0,
        sales: parseFloat(row.totalSales as any) || 0
      });
    }

    res.json({ success: true, data: byMarketplace });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================
// POST /api/amazon-ads/backfill-monthly-spend
// Backfill storico spesa ADS per marketplace (ultimi N mesi)
// Fire-and-forget: restituisce 202 subito, elabora in background
// ================================================
const BACKFILL_MARKETPLACES = ['US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'AU'];
let backfillRunning = false;

router.post('/backfill-monthly-spend', async (req: Request, res: Response) => {
  try {
    const adminToken = req.query.adminToken as string;
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const months = Math.min(parseInt(req.query.months as string) || 6, 12);

    if (backfillRunning) {
      return res.status(409).json({ success: false, error: 'Backfill già in corso' });
    }

    // Trova userId dal DB (primo utente — single-user app)
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: {} });
    if (!user) return res.status(404).json({ success: false, error: 'Nessun utente trovato' });

    res.status(202).json({
      success: true,
      message: `Backfill avviato per ${months} mesi × ${BACKFILL_MARKETPLACES.length} marketplace. Controlla i log per il progresso.`
    });

    // Esegui in background
    setImmediate(() => runBackfill(user.id, months));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function runBackfill(userId: string, months: number) {
  if (backfillRunning) return;
  backfillRunning = true;
  console.log(`🔄 [Backfill] Avvio backfill ${months} mesi per ${BACKFILL_MARKETPLACES.length} marketplace`);

  // Calcola i mesi da recuperare (corrente incluso)
  const monthsToFetch: Array<{ yearMonth: string; startDate: string; endDate: string }> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    // Per il mese corrente, usa oggi come endDate
    const isCurrentMonth = (i === 0);
    const endDateObj = isCurrentMonth ? now : new Date(year, month + 1, 0);
    const endDate = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(isCurrentMonth ? endDateObj.getDate() : lastDay).padStart(2, '0')}`;
    monthsToFetch.push({ yearMonth, startDate, endDate });
  }

  let processed = 0;
  let failed = 0;

  for (const marketplace of BACKFILL_MARKETPLACES) {
    if (!isMarketplaceConfigured(marketplace)) {
      console.log(`⚠️ [Backfill] Marketplace ${marketplace} non configurato, skip`);
      continue;
    }

    const apiService = createMarketplaceApiService(marketplace);

    for (const { yearMonth, startDate, endDate } of monthsToFetch) {
      try {
        console.log(`📊 [Backfill] ${marketplace} ${yearMonth} (${startDate} → ${endDate})`);
        const reportId = await apiService.requestReportV3(
          startDate, endDate, 'spTargeting',
          ['cost', 'sales14d']
        );
        const rows = await apiService.waitAndDownloadReport(reportId, 60);

        let totalSpend = 0;
        let totalSales = 0;
        for (const row of rows) {
          totalSpend += parseFloat(row.cost || row.spend || 0);
          totalSales += parseFloat(row.sales14d || row.sales || 0);
        }

        // Upsert
        await AppDataSource.query(`
          INSERT INTO monthly_ads_spend (user_id, marketplace, year_month, total_spend, total_sales, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (user_id, marketplace, year_month)
          DO UPDATE SET total_spend = $4, total_sales = $5, updated_at = NOW()
        `, [userId, marketplace, yearMonth, totalSpend.toFixed(2), totalSales.toFixed(2)]);

        console.log(`✅ [Backfill] ${marketplace} ${yearMonth}: spend=$${totalSpend.toFixed(2)}, sales=$${totalSales.toFixed(2)}`);
        processed++;
      } catch (err: any) {
        console.error(`❌ [Backfill] ${marketplace} ${yearMonth}: ${err.message}`);
        failed++;
      }

      // Pausa tra report dello stesso marketplace per evitare rate limit
      await new Promise(r => setTimeout(r, 2000));
    }

    // Pausa tra marketplace
    await new Promise(r => setTimeout(r, 3000));
  }

  backfillRunning = false;
  console.log(`✅ [Backfill] Completato: ${processed} ok, ${failed} failed`);
}

// ================================================
// POST /api/amazon-ads/update-monthly-spend
// Aggiorna il mese corrente (chiamato dal cron il 1° del mese)
// ================================================
router.post('/update-monthly-spend', async (req: Request, res: Response) => {
  try {
    const adminToken = req.query.adminToken as string;
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: {} });
    if (!user) return res.status(404).json({ success: false, error: 'Nessun utente' });

    res.status(202).json({ success: true, message: 'Aggiornamento mese corrente avviato' });

    // Aggiorna solo il mese corrente in background
    setImmediate(() => runBackfill(user.id, 1));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================
// POST /api/amazon-ads/manual-monthly-spend
// Inserimento manuale dati spesa mensile da CSV esportato da Amazon Ads
// Body: { entries: [{ marketplace, yearMonth, totalSpend, totalSales? }] }
// ================================================
router.post('/manual-monthly-spend', async (req: Request, res: Response) => {
  try {
    const adminToken = req.query.adminToken as string;
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: {} });
    if (!user) return res.status(404).json({ success: false, error: 'Nessun utente' });

    const entries: Array<{ marketplace: string; yearMonth: string; totalSpend: number; totalSales?: number }> = req.body.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, error: 'Body deve contenere entries: [{marketplace, yearMonth, totalSpend, totalSales?}]' });
    }

    let inserted = 0;
    for (const entry of entries) {
      const { marketplace, yearMonth, totalSpend, totalSales = 0 } = entry;
      if (!marketplace || !yearMonth || totalSpend == null) continue;
      await AppDataSource.query(`
        INSERT INTO monthly_ads_spend (user_id, marketplace, year_month, total_spend, total_sales, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, marketplace, year_month)
        DO UPDATE SET total_spend = $4, total_sales = $5, updated_at = NOW()
      `, [user.id, marketplace.toUpperCase(), yearMonth, totalSpend.toFixed(2), totalSales.toFixed(2)]);
      console.log(`✅ [Manual] ${marketplace} ${yearMonth}: spend=$${totalSpend.toFixed(2)}, sales=$${totalSales.toFixed(2)}`);
      inserted++;
    }

    res.json({ success: true, inserted, message: `${inserted} record inseriti/aggiornati` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
