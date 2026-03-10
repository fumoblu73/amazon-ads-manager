import { Router, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { KdpSalesSnapshot } from '../entities/KdpSalesSnapshot';
import { MonthlyRoyalties } from '../entities/MonthlyRoyalties';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { encryptCookies, extractKdpAuthCookies, Cookie } from '../utils/encryption';
import { kdpSyncScheduler } from '../services/kdp-sync-scheduler';

const router = Router();

// ================================================
// POST /api/kdp-sync/cookies - Sincronizza cookie KDP dall'estensione
// ================================================
router.post('/cookies', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { cookies, kdpreportsCookies, marketplace } = req.body;

    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({
        success: false,
        error: 'Cookies array required'
      });
    }

    console.log(`🍪 Received ${cookies.length} cookies from extension for user ${userId}`);

    // Filtra solo i cookie necessari per KDP
    const kdpCookies = extractKdpAuthCookies(cookies as Cookie[]);

    if (kdpCookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid KDP authentication cookies found'
      });
    }

    console.log(`✅ Extracted ${kdpCookies.length} KDP auth cookies`);

    // Cripta i cookie prima di salvarli
    const cookiesJson = JSON.stringify(kdpCookies);
    const encryptedCookies = encryptCookies(cookiesJson);

    // Processa cookie di kdpreports.amazon.com (per le statistiche vendite)
    let encryptedReportsCookies: string | null = null;
    let reportsCookiesCount = 0;

    if (kdpreportsCookies && Array.isArray(kdpreportsCookies) && kdpreportsCookies.length > 0) {
      console.log(`📊 Received ${kdpreportsCookies.length} kdpreports cookies`);

      // Salva tutti i cookie di kdpreports (non filtrarli, potrebbero servire tutti)
      const reportsCookiesJson = JSON.stringify(kdpreportsCookies);
      encryptedReportsCookies = encryptCookies(reportsCookiesJson);
      reportsCookiesCount = kdpreportsCookies.length;

      console.log(`✅ Encrypted ${reportsCookiesCount} kdpreports cookies`);
    } else {
      console.log(`⚠️ No kdpreports cookies received - sales data scraping may not work`);
    }

    // Salva nel database
    const userRepository = AppDataSource.getRepository(User);
    await userRepository.update(userId, {
      kdpCookiesEncrypted: encryptedCookies,
      kdpReportsCookiesEncrypted: encryptedReportsCookies,
      kdpCookiesUpdatedAt: new Date(),
      kdpMarketplace: marketplace || 'US',
      kdpSyncEnabled: true
    });

    console.log(`✅ KDP cookies saved for user ${userId} (${kdpCookies.length} KDP + ${reportsCookiesCount} Reports)`);

    // Opzionale: Avvia sync immediato
    // await kdpScraperService.syncUserData(userId);

    res.json({
      success: true,
      message: 'KDP cookies synchronized successfully',
      data: {
        cookiesCount: kdpCookies.length,
        reportsCookiesCount: reportsCookiesCount,
        marketplace: marketplace || 'US',
        syncEnabled: true,
        hasReportsCookies: reportsCookiesCount > 0
      }
    });
  } catch (error: any) {
    console.error('Cookie sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync KDP cookies',
      details: error.message
    });
  }
});

// ================================================
// POST /api/kdp-sync/auto-sync - Sync KDP automatico al login (server-side Puppeteer)
// ================================================
router.post('/auto-sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'kdpSyncEnabled', 'kdpCookiesEncrypted', 'kdpCookiesUpdatedAt', 'kdpLastSyncAt']
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Verifica se KDP sync è abilitato e cookie presenti
    if (!user.kdpSyncEnabled || !user.kdpCookiesEncrypted) {
      return res.json({
        success: true,
        skipped: true,
        reason: 'no_cookies',
        message: 'KDP sync non configurato (installa estensione Chrome)'
      });
    }

    // Verifica se cookie sono scaduti (> 7 giorni)
    const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    if (user.kdpCookiesUpdatedAt && (Date.now() - user.kdpCookiesUpdatedAt.getTime()) > COOKIE_MAX_AGE_MS) {
      return res.json({
        success: true,
        skipped: true,
        reason: 'cookies_expired',
        message: 'Cookie KDP scaduti (rinnova con estensione Chrome)'
      });
    }

    // Controlla se ultimo sync è recente (< 6 ore)
    const SYNC_COOLDOWN_MS = 6 * 60 * 60 * 1000;
    if (user.kdpLastSyncAt) {
      const hoursSinceSync = (Date.now() - user.kdpLastSyncAt.getTime()) / (1000 * 60 * 60);
      if ((Date.now() - user.kdpLastSyncAt.getTime()) < SYNC_COOLDOWN_MS) {
        return res.json({
          success: true,
          skipped: true,
          reason: 'recent',
          hoursSinceSync: Math.round(hoursSinceSync),
          message: `KDP sync recente (${Math.round(hoursSinceSync)}h fa)`
        });
      }
    }

    // Esegui sync server-side
    console.log(`📚 [KDP Auto-Sync] Starting for user ${user.email}`);
    const result = await kdpSyncScheduler.syncUser(userId);

    // Aggiorna timestamp
    await userRepository.update(userId, { kdpLastSyncAt: new Date() });

    console.log(`✅ [KDP Auto-Sync] User ${user.email}: ${result.books} books, ${result.stats} stats records`);

    res.json({
      success: true,
      skipped: false,
      books: result.books,
      stats: result.stats,
      message: `KDP sync completato: ${result.books} libri, ${result.stats} record`
    });
  } catch (error: any) {
    console.error('❌ [KDP Auto-Sync] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'KDP sync failed',
      details: error.message
    });
  }
});

// ================================================
// GET /api/kdp-sync/status - Controlla stato sincronizzazione KDP
// ================================================
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: userId },
      select: ['kdpSyncEnabled', 'kdpCookiesUpdatedAt', 'kdpLastSyncAt', 'kdpMarketplace']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Calcola età dei cookie in giorni
    const now = new Date().getTime();
    const cookieAge = user.kdpCookiesUpdatedAt
      ? Math.floor((now - user.kdpCookiesUpdatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Cookie scadono dopo 7 giorni
    const COOKIE_MAX_AGE = 7;
    const COOKIE_WARNING_AGE = 5; // Avvisa 2 giorni prima

    const cookiesExpired = cookieAge !== null ? cookieAge >= COOKIE_MAX_AGE : true;
    const needsRefresh = cookieAge !== null ? cookieAge >= COOKIE_WARNING_AGE : true;

    res.json({
      success: true,
      data: {
        syncEnabled: user.kdpSyncEnabled,
        cookiesUpdatedAt: user.kdpCookiesUpdatedAt,
        lastSyncAt: user.kdpLastSyncAt,
        marketplace: user.kdpMarketplace,
        cookieAge: cookieAge,
        cookiesExpired,
        needsRefresh,
        daysUntilExpiration: cookieAge !== null ? Math.max(0, COOKIE_MAX_AGE - cookieAge) : 0
      }
    });
  } catch (error: any) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check sync status',
      details: error.message
    });
  }
});

// ================================================
// POST /api/kdp-sync/sales-data - Riceve dati vendite da scraping client-side
// ================================================
router.post('/sales-data', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { data, marketplace, source } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Sales data required'
      });
    }

    console.log(`📊 Received sales data from extension for user ${userId}`);
    console.log(`   Source: ${source || 'extension-client-scrape'}`);
    console.log(`   Marketplace: ${marketplace || 'US'}`);

    // Estrai dati da overview
    const overview = data.overview?.overviewWidget || {};
    const ordersHistogram = data.orders?.histogram?.data || [];
    const marketplaceDistribution = data.marketplace?.histogram?.data || [];
    // topTitles può arrivare in due formati: topTitlesWidget.topTitles o topEarningTitles
    const topTitlesData = data.topTitles?.topTitlesWidget?.topTitles || data.topTitles?.topEarningTitles || [];
    // Historical months data (last 12 months)
    const historicalMonths = data.historicalMonths || [];

    console.log(`   Overview: ${JSON.stringify(overview)}`);
    console.log(`   Orders histogram entries: ${ordersHistogram.length}`);
    console.log(`   Marketplace entries: ${marketplaceDistribution.length}`);
    console.log(`   Historical months: ${historicalMonths.length}`);

    // Crea snapshot
    const snapshotRepository = AppDataSource.getRepository(KdpSalesSnapshot);

    const snapshot = snapshotRepository.create({
      userId,
      currency: overview.currency || 'USD',
      digitalOrders: overview.digitalOrders || 0,
      printOrders: overview.printOrders || 0,
      kenpRead: overview.kenpRead || 0,
      totalRoyalties: overview.totalRoyalties || 0,
      marketplace: marketplace || 'US',
      source: source || 'extension-client-scrape',
      rawData: data,
      // Trasforma dati marketplace
      marketplaceData: marketplaceDistribution.map((item: any) => ({
        marketplace: item.bin,
        orders: item.values?.Orders || 0,
        royalties: item.values?.Royalties || 0
      })),
      // Trasforma dati ordini giornalieri
      dailyOrders: ordersHistogram.map((item: any) => ({
        date: item.bin,
        orders: item.values?.Orders || 0
      })),
      // Trasforma top titles
      topTitles: topTitlesData.map((item: any) => ({
        asin: item.asin || '',
        title: item.title || '',
        royalties: item.royalties || 0
      })),
      // Historical months data
      historicalMonths: historicalMonths.map((item: any) => ({
        month: item.month || '',
        label: item.label || '',
        totalRoyalties: item.data?.totalRoyalties || 0,
        digitalOrders: item.data?.digitalOrders || 0,
        printOrders: item.data?.printOrders || 0,
        kenpRead: item.data?.kenpRead || 0
      }))
    });

    await snapshotRepository.save(snapshot);

    // Upsert monthly_royalties from marketplaceData for the current month
    if (marketplaceDistribution.length > 0) {
      const KDP_TO_ADS: Record<string, string> = {
        'AMAZON.COM': 'US', 'AMAZON.CO.UK': 'UK', 'AMAZON.DE': 'DE',
        'AMAZON.FR': 'FR', 'AMAZON.IT': 'IT', 'AMAZON.ES': 'ES',
        'AMAZON.CA': 'CA', 'AMAZON.COM.AU': 'AU', 'AMAZON.CO.JP': 'JP',
        'AMAZON.COM.BR': 'BR', 'AMAZON.COM.MX': 'MX', 'AMAZON.IN': 'IN',
        'AMAZON.NL': 'NL',
      };
      const MP_CURRENCY: Record<string, string> = {
        'UK': 'GBP', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR',
        'CA': 'CAD', 'AU': 'AUD', 'JP': 'JPY', 'BR': 'BRL', 'MX': 'MXN', 'IN': 'INR',
      };
      const currentYm = new Date().toISOString().slice(0, 7);
      for (const item of marketplaceDistribution) {
        let mp = (item.bin || '').toUpperCase();
        mp = KDP_TO_ADS[mp] || mp;
        if (!mp) continue;
        const royalties = parseFloat(item.values?.Royalties || 0);
        const currency = MP_CURRENCY[mp] || 'USD';
        await AppDataSource.query(`
          INSERT INTO monthly_royalties (user_id, marketplace, year_month, royalties, currency)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id, marketplace, year_month) DO UPDATE SET
            royalties = EXCLUDED.royalties,
            currency = EXCLUDED.currency,
            updated_at = NOW()
        `, [userId, mp, currentYm, royalties, currency]);
      }
      console.log(`   Monthly royalties upserted for ${marketplaceDistribution.length} marketplaces (${currentYm})`);
    }

    console.log(`✅ Sales snapshot saved for user ${userId}`);
    console.log(`   Total royalties: ${overview.currency || 'USD'} ${overview.totalRoyalties || 0}`);
    console.log(`   Print orders: ${overview.printOrders || 0}`);
    console.log(`   Digital orders: ${overview.digitalOrders || 0}`);

    // Aggiorna timestamp ultima sync
    const userRepository = AppDataSource.getRepository(User);
    await userRepository.update(userId, {
      kdpLastSyncAt: new Date()
    });

    res.json({
      success: true,
      message: 'Sales data saved successfully',
      data: {
        snapshotId: snapshot.id,
        currency: overview.currency,
        totalRoyalties: overview.totalRoyalties,
        printOrders: overview.printOrders,
        digitalOrders: overview.digitalOrders,
        marketplaceCount: marketplaceDistribution.length,
        dailyOrdersCount: ordersHistogram.length
      }
    });
  } catch (error: any) {
    console.error('Sales data save error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save sales data',
      details: error.message
    });
  }
});

// ================================================
// GET /api/kdp-sync/sales-data - Recupera ultimi dati vendite
// ================================================
router.get('/sales-data', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const snapshotRepository = AppDataSource.getRepository(KdpSalesSnapshot);

    // Recupera ultimo snapshot
    const latestSnapshot = await snapshotRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' }
    });

    if (!latestSnapshot) {
      return res.json({
        success: true,
        data: null,
        message: 'No sales data available'
      });
    }

    res.json({
      success: true,
      data: {
        id: latestSnapshot.id,
        currency: latestSnapshot.currency,
        totalRoyalties: latestSnapshot.totalRoyalties,
        printOrders: latestSnapshot.printOrders,
        digitalOrders: latestSnapshot.digitalOrders,
        kenpRead: latestSnapshot.kenpRead,
        marketplace: latestSnapshot.marketplace,
        marketplaceData: latestSnapshot.marketplaceData,
        dailyOrders: latestSnapshot.dailyOrders,
        topTitles: latestSnapshot.topTitles,
        createdAt: latestSnapshot.createdAt
      }
    });
  } catch (error: any) {
    console.error('Sales data fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales data',
      details: error.message
    });
  }
});

// ================================================
// DELETE /api/kdp-sync/cookies - Disabilita sync e rimuovi cookie
// ================================================
router.delete('/cookies', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userRepository = AppDataSource.getRepository(User);

    await userRepository.update(userId, {
      kdpCookiesEncrypted: null,
      kdpReportsCookiesEncrypted: null,
      kdpCookiesUpdatedAt: null,
      kdpSyncEnabled: false
    });

    console.log(`🗑️  KDP cookies removed for user ${userId}`);

    res.json({
      success: true,
      message: 'KDP sync disabled and cookies removed'
    });
  } catch (error: any) {
    console.error('Cookie removal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove cookies',
      details: error.message
    });
  }
});

export default router;
