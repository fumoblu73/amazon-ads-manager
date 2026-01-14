import { Router, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { encryptCookies, extractKdpAuthCookies, Cookie } from '../utils/encryption';

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
