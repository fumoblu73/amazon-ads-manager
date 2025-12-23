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
    const { cookies, marketplace } = req.body;

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

    // Salva nel database
    const userRepository = AppDataSource.getRepository(User);
    await userRepository.update(userId, {
      kdpCookiesEncrypted: encryptedCookies,
      kdpCookiesUpdatedAt: new Date(),
      kdpMarketplace: marketplace || 'US',
      kdpSyncEnabled: true
    });

    console.log(`✅ KDP cookies saved for user ${userId}`);

    // Opzionale: Avvia sync immediato
    // await kdpScraperService.syncUserData(userId);

    res.json({
      success: true,
      message: 'KDP cookies synchronized successfully',
      data: {
        cookiesCount: kdpCookies.length,
        marketplace: marketplace || 'US',
        syncEnabled: true
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

    // Calcola se i cookie sono scaduti (> 7 giorni)
    const cookiesExpired = user.kdpCookiesUpdatedAt
      ? (new Date().getTime() - user.kdpCookiesUpdatedAt.getTime()) > (7 * 24 * 60 * 60 * 1000)
      : true;

    res.json({
      success: true,
      data: {
        syncEnabled: user.kdpSyncEnabled,
        cookiesUpdatedAt: user.kdpCookiesUpdatedAt,
        lastSyncAt: user.kdpLastSyncAt,
        marketplace: user.kdpMarketplace,
        cookiesExpired,
        needsRefresh: cookiesExpired || !user.kdpCookiesUpdatedAt
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
