import { Router, Request, Response } from 'express';
import { automationScheduler } from '../automation/scheduler';
import { authMiddleware } from '../middleware/auth';
import { requireAmazonAuth, AuthRequest } from '../middleware/requireAmazonAuth';
import { submitReportsForAllUsers, submitReportsForUser } from '../services/reportSubmitter';
import { processCompletedReports, processCompletedReportsForUser } from '../services/reportProcessor';

const router = Router();

// Stato esecuzione corrente
let isRunning = false;
let lastExecution: {
  startedAt: Date | null;
  completedAt: Date | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  error: string | null;
} = {
  startedAt: null,
  completedAt: null,
  status: 'idle',
  error: null
};

// ================================================
// ENDPOINT WARM-UP (Chiamato da Cron-Job.org per svegliare Render + DB)
// ================================================
// NOTA: Questo endpoint fa SOLO warm-up del server e del database.
// Le automazioni sono gestite dalla pipeline asincrona a 2 fasi:
//   - Fase 1: /api/automation/submit-reports (submit report in batch)
//   - Fase 2: /api/automation/process-reports (processa report completati)
router.post('/trigger', async (req: Request, res: Response) => {
  // 1. Verifica secret per sicurezza
  const secret = req.query.secret || req.body.secret;
  const expectedSecret = process.env.AUTOMATION_SECRET || 'change-me-in-production';

  if (secret !== expectedSecret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid secret'
    });
  }

  // 2. Pre-warm database (wake up Supabase if paused)
  let dbStatus = 'unknown';
  try {
    const { AppDataSource } = await import('../config/database');
    await AppDataSource.query('SELECT 1');
    dbStatus = 'active';
    console.log('✅ Database pre-warmed successfully');
  } catch (error) {
    console.error('⚠️  Database pre-warm failed, retrying...', error);

    // Retry con backoff di 2 secondi
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const { AppDataSource } = await import('../config/database');
      await AppDataSource.query('SELECT 1');
      dbStatus = 'active (after retry)';
      console.log('✅ Database pre-warmed successfully after retry');
    } catch (retryError) {
      dbStatus = 'failed';
      console.error('❌ Database pre-warm failed after retry:', retryError);
    }
  }

  // 3. Risponde con stato warm-up
  res.json({
    success: true,
    message: 'Server and database warmed up successfully',
    dbStatus,
    timestamp: new Date().toISOString(),
    note: 'Warm-up only. Automations are triggered by /submit-reports and /process-reports.'
  });

  console.log(`🔥 Warm-up completato. DB status: ${dbStatus}`);
});

// ================================================
// ENDPOINT STATUS (Controlla stato esecuzione)
// ================================================
router.get('/status', (req: Request, res: Response) => {
  const schedulerStatus = automationScheduler.getStatus();

  res.json({
    scheduler: schedulerStatus,
    lastExecution: {
      ...lastExecution,
      isRunning,
      duration: lastExecution.startedAt && lastExecution.completedAt
        ? `${((lastExecution.completedAt.getTime() - lastExecution.startedAt.getTime()) / 1000 / 60).toFixed(2)} minutes`
        : null
    },
    currentTime: new Date().toISOString()
  });
});

// ================================================
// ENDPOINT MANUAL TRIGGER (Per test manuali - usa pipeline asincrona)
// ================================================
router.post('/trigger-manual', async (req: Request, res: Response) => {
  // Verifica autenticazione (può essere diverso dal secret cron)
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN || 'admin-token'}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (isRunning) {
    return res.status(409).json({
      error: 'Automations already running',
      status: lastExecution
    });
  }

  // Risponde subito
  res.json({
    success: true,
    message: 'Manual execution started in background (async pipeline)',
    timestamp: new Date().toISOString()
  });

  // Esegue in background con pipeline asincrona
  (async () => {
    isRunning = true;
    lastExecution = {
      startedAt: new Date(),
      completedAt: null,
      status: 'running',
      error: null
    };

    try {
      // FASE 1: Submit report per tutti gli utenti
      console.log('🚀 [Manual] Fase 1: Submit reports per tutti gli utenti...');
      const submitStats = await submitReportsForAllUsers();
      console.log(`📊 [Manual] Fase 1 completata: ${submitStats.reportsSubmitted} report sottomessi`);

      // FASE 2: Polling fino al completamento
      const MAX_POLL_TIME_MS = 20 * 60 * 1000; // 20 min max
      const POLL_INTERVAL_MS = 30000; // 30 secondi
      const startTime = Date.now();
      let pollCount = 0;

      while (Date.now() - startTime < MAX_POLL_TIME_MS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        pollCount++;

        const processStats = await processCompletedReports();
        console.log(`📊 [Manual] Poll #${pollCount}: processed=${processStats.processed}, pending=${processStats.stillPending}`);

        if (processStats.stillPending === 0) {
          console.log('✅ [Manual] Tutti i report processati!');
          break;
        }
      }

      lastExecution.status = 'completed';
      lastExecution.completedAt = new Date();
      const duration = ((Date.now() - lastExecution.startedAt!.getTime()) / 1000 / 60).toFixed(2);
      console.log(`✅ [Manual] Completato in ${duration} minuti`);

    } catch (error) {
      lastExecution.status = 'failed';
      lastExecution.completedAt = new Date();
      lastExecution.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Manual] Errore:', error);
    } finally {
      isRunning = false;
    }
  })();
});

// ================================================
// ENDPOINT PER-USER TRIGGER (User-specific automation)
// Uses async pipeline: submit all reports → poll until done
// ================================================
router.post('/trigger-user', authMiddleware, requireAmazonAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    console.log(`🚀 User ${userId} triggered their automations (async pipeline)`);

    // Respond immediately
    res.json({
      success: true,
      message: 'Your automations have been queued (async pipeline)',
      timestamp: new Date().toISOString(),
      note: 'Reports submitted in batch. Processing as they complete.'
    });

    // Background: submit reports in batch, then poll until all processed
    (async () => {
      try {
        // FASE 1: Submit all reports in batch (fast, ~seconds)
        console.log(`📤 [User ${userId}] FASE 1: Submitting all reports...`);
        const submitStats = await submitReportsForUser(userId);
        console.log(`📤 [User ${userId}] FASE 1 done: ${submitStats.reportsSubmitted} reports submitted, ${submitStats.errors} errors`);

        if (submitStats.reportsSubmitted === 0) {
          console.log(`⚠️ [User ${userId}] No reports submitted, nothing to process`);
          return;
        }

        // FASE 2: Poll every 30s until all reports processed or 15 min timeout
        const MAX_POLL_TIME_MS = 15 * 60 * 1000; // 15 minutes
        const POLL_INTERVAL_MS = 30000; // 30 seconds
        const startTime = Date.now();
        let pollCount = 0;

        while (Date.now() - startTime < MAX_POLL_TIME_MS) {
          pollCount++;
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

          console.log(`📥 [User ${userId}] FASE 2: Poll #${pollCount}...`);
          const processStats = await processCompletedReportsForUser(userId);

          console.log(`   Checked: ${processStats.checked}, Completed: ${processStats.completed}, Processed: ${processStats.processed}, Still pending: ${processStats.stillPending}`);

          if (processStats.stillPending === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            console.log(`✅ [User ${userId}] All reports processed in ${elapsed}s (${pollCount} polls)`);
            return;
          }
        }

        console.warn(`⚠️ [User ${userId}] Timeout after 15 min. Remaining reports will be processed by cron.`);
      } catch (error) {
        console.error(`❌ [User ${userId}] Async pipeline failed:`, error);
      }
    })();

  } catch (error) {
    console.error('Error triggering user automations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger automations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ================================================
// ENDPOINT: GET SCHEDULER CONFIG
// ================================================
// Restituisce la configurazione corrente dello scheduler
router.get('/config', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN || 'admin-token'}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const config = automationScheduler.getConfig();

  res.json({
    success: true,
    config: {
      ...config,
      scheduleExplanation: {
        func1and3: 'Lunedì/Mercoledì/Venerdì alle 10:30 ora italiana (09:30 UTC)',
        func2and4and5: 'Lunedì alle 11:30 ora italiana (10:30 UTC)'
      }
    }
  });
});

// ================================================
// ENDPOINT: UPDATE SCHEDULER CONFIG
// ================================================
// Aggiorna la configurazione dello scheduler
// Body: { func1and3_schedule?, func1and3_enabled?, func2and4and5_schedule?, func2and4and5_enabled? }
router.post('/config', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN || 'admin-token'}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { func1and3_schedule, func1and3_enabled, func2and4and5_schedule, func2and4and5_enabled } = req.body;

  // Validazione cron expression (opzionale ma consigliato)
  const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;

  if (func1and3_schedule !== undefined && !cronRegex.test(func1and3_schedule)) {
    return res.status(400).json({
      error: 'Invalid cron expression for func1and3_schedule',
      hint: 'Format: minute hour day month day-of-week (e.g., "30 9 * * 1,3,5")'
    });
  }

  if (func2and4and5_schedule !== undefined && !cronRegex.test(func2and4and5_schedule)) {
    return res.status(400).json({
      error: 'Invalid cron expression for func2and4and5_schedule',
      hint: 'Format: minute hour day month day-of-week (e.g., "30 10 * * 1")'
    });
  }

  // Aggiorna configurazione
  try {
    const updateData: any = {};
    if (func1and3_schedule !== undefined) updateData.func1and3_schedule = func1and3_schedule;
    if (func1and3_enabled !== undefined) updateData.func1and3_enabled = func1and3_enabled;
    if (func2and4and5_schedule !== undefined) updateData.func2and4and5_schedule = func2and4and5_schedule;
    if (func2and4and5_enabled !== undefined) updateData.func2and4and5_enabled = func2and4and5_enabled;

    automationScheduler.updateConfig(updateData);

    const newConfig = automationScheduler.getConfig();

    res.json({
      success: true,
      message: 'Scheduler configuration updated successfully',
      config: newConfig
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to update configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ================================================
// ENDPOINT: RESTART SCHEDULER
// ================================================
// Ferma e riavvia lo scheduler (utile dopo modifiche)
router.post('/scheduler/restart', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN || 'admin-token'}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    automationScheduler.stop();
    automationScheduler.start();

    res.json({
      success: true,
      message: 'Scheduler restarted successfully',
      status: automationScheduler.getStatus()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to restart scheduler',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ================================================
// ENDPOINT: FASE 1 - SUBMIT REPORTS (Async Architecture)
// ================================================
// Sottomette i report ad Amazon e salva i reportId nel DB.
// Chiamato da cron alle 8:30 UTC (9:30 IT)
router.post('/submit-reports', async (req: Request, res: Response) => {
  const secret = req.query.secret || req.body.secret;
  const expectedSecret = process.env.AUTOMATION_SECRET || 'change-me-in-production';

  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid secret' });
  }

  // Pre-warm database
  try {
    const { AppDataSource } = await import('../config/database');
    await AppDataSource.query('SELECT 1');
    console.log('✅ Database pre-warmed for submit-reports');
  } catch (error) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const { AppDataSource } = await import('../config/database');
      await AppDataSource.query('SELECT 1');
    } catch (retryError) {
      console.error('❌ Database pre-warm failed');
    }
  }

  // Respond immediately
  res.json({
    success: true,
    message: 'Report submission started (Phase 1)',
    timestamp: new Date().toISOString()
  });

  // Run in background
  submitReportsForAllUsers()
    .then((stats) => {
      console.log(`✅ Phase 1 completed: ${stats.reportsSubmitted} reports submitted`);
    })
    .catch((error) => {
      console.error('❌ Phase 1 failed:', error);
    });
});

// ================================================
// ENDPOINT: FASE 2 - PROCESS COMPLETED REPORTS (Async Architecture)
// ================================================
// Controlla report pendenti, scarica completati, esegue automazioni.
// Chiamato internamente da cron ogni 15 minuti
router.post('/process-reports', async (req: Request, res: Response) => {
  const secret = req.query.secret || req.body.secret;
  const expectedSecret = process.env.AUTOMATION_SECRET || 'change-me-in-production';

  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid secret' });
  }

  // Respond immediately
  res.json({
    success: true,
    message: 'Report processing started (Phase 2)',
    timestamp: new Date().toISOString()
  });

  // Run in background
  processCompletedReports()
    .then((stats) => {
      console.log(`✅ Phase 2 completed: ${stats.processed} reports processed, ${stats.stillPending} still pending`);
    })
    .catch((error) => {
      console.error('❌ Phase 2 failed:', error);
    });
});

// ================================================
// ENDPOINT: TEST BID INCREASE (Real API verification)
// ================================================
// Test endpoint to verify real connection to Amazon Ads API
// Increases keyword bids by a specified amount for a given campaign
router.post('/test-bid-increase', authMiddleware, requireAmazonAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId, marketplace, bidIncrease = 0.02, dryRun = true } = req.body;

    if (!campaignId || !marketplace) {
      return res.status(400).json({ error: 'campaignId and marketplace are required' });
    }

    console.log(`\n🧪 TEST BID INCREASE`);
    console.log(`   Campaign: ${campaignId}`);
    console.log(`   Marketplace: ${marketplace}`);
    console.log(`   Bid increase: $${bidIncrease}`);
    console.log(`   Dry run: ${dryRun}`);

    // Create API service for the marketplace
    const { createMarketplaceApiService } = await import('../services/MarketplaceApiFactory');
    const apiService = createMarketplaceApiService(marketplace);

    // Get keywords for this campaign
    const keywords = await apiService.getKeywords(campaignId);
    console.log(`📥 Found ${keywords.length} keywords`);

    const results: any[] = [];

    for (const kw of keywords) {
      const keywordId = kw.keywordId;
      const currentBid = kw.bid;
      const newBid = Math.round((currentBid + bidIncrease) * 100) / 100;
      const keywordText = kw.keywordText || kw.keyword || '(unknown)';
      const matchType = kw.matchType || '(unknown)';

      const entry = {
        keywordId,
        keywordText,
        matchType,
        currentBid,
        newBid,
        status: dryRun ? 'dry_run' : 'pending'
      };

      if (!dryRun) {
        try {
          await apiService.updateKeywordBid(keywordId, newBid);
          entry.status = 'updated';
          console.log(`  ✅ ${keywordText} (${matchType}): $${currentBid} → $${newBid}`);
        } catch (err: any) {
          entry.status = `error: ${err.message}`;
          console.error(`  ❌ ${keywordText}: ${err.message}`);
        }
      } else {
        console.log(`  🔍 [DRY RUN] ${keywordText} (${matchType}): $${currentBid} → $${newBid}`);
      }

      results.push(entry);
    }

    res.json({
      success: true,
      campaignId,
      marketplace,
      dryRun,
      bidIncrease,
      keywordsFound: keywords.length,
      results
    });

  } catch (error: any) {
    console.error('❌ Test bid increase error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ================================================
// ENDPOINT: TEST SINGOLA FUNZIONE SU ASIN (SOLO DEBUG/TEST)
// ================================================
// Endpoint SOLO per testing manuale. NON viene usato dalla pipeline
// di automazione normale. NON modifica frequenze, NON aggiorna lo
// scheduler, NON influenza il flusso cronjob. E' completamente
// isolato: esegue la funzione richiesta e restituisce i risultati.
// Ignora i check di frequenza (shouldExecuteFunction) perche'
// il suo scopo e' testare la funzione on-demand.
router.post('/test-function', authMiddleware, requireAmazonAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { asin, functionNumber, marketplace, diagnosticsOnly, dryRun } = req.body;

    if (!asin || !functionNumber || !marketplace) {
      return res.status(400).json({ error: 'asin, functionNumber (1-5), and marketplace are required' });
    }

    if (functionNumber < 1 || functionNumber > 5) {
      return res.status(400).json({ error: 'functionNumber must be between 1 and 5' });
    }

    console.log(`\n🧪 [TEST-ONLY] Function ${functionNumber} on ASIN ${asin} [${marketplace}]`);

    // Import necessari (isolati, non condizionano il resto del codice)
    const { createUserAmazonApiService } = await import('../services/UserAmazonApiFactory');
    const { AppDataSource } = await import('../config/database');
    const { Campaign } = await import('../models/Campaign');
    const { KdpBook } = await import('../entities/KdpBook');
    const { getUserAutomationSettings } = await import('../automation/rules');
    const { executeFunc1 } = await import('../automation/functions/func1');
    const { executeFunc2 } = await import('../automation/functions/func2');
    const { executeFunc3 } = await import('../automation/functions/func3');
    const { executeFunc4 } = await import('../automation/functions/func4');
    const { executeFunc5 } = await import('../automation/functions/func5');
    const { parseKdpPrice, calculateBookFastAcos } = await import('../utils/printingCost');

    // 1. Crea API service usando i token OAuth dell'utente + endpoint corretto per marketplace
    let apiService = createUserAmazonApiService(userId, marketplace);

    // 1b. [DIAGNOSTICA] Verifica stato token e connessione API
    const { User } = await import('../entities/User');
    const { MARKETPLACE_TO_REGION, API_ENDPOINTS } = await import('../config/amazon');
    const userRepo = AppDataSource.getRepository(User);
    const dbUser = await userRepo.findOne({ where: { id: userId } });

    const regionSource = marketplace || dbUser?.countryCode || 'US';
    const region = MARKETPLACE_TO_REGION[regionSource.toUpperCase()] || 'NA';
    const endpoint = API_ENDPOINTS[region];

    const tokenDiagnostics = {
      userCountryCode: dbUser?.countryCode || 'NOT SET',
      userProfileId: dbUser?.profileId || 'NOT SET',
      resolvedRegion: region,
      resolvedEndpoint: endpoint,
      hasAccessToken: !!(dbUser?.accessToken),
      accessTokenLength: dbUser?.accessToken?.length || 0,
      hasRefreshToken: !!(dbUser?.refreshToken),
      tokenExpiresAt: dbUser?.tokenExpiresAt?.toString() || 'NOT SET',
      tokenExpired: dbUser?.tokenExpiresAt ? new Date() >= new Date(dbUser.tokenExpiresAt) : 'UNKNOWN',
      clientIdSet: !!(process.env.AMAZON_ADS_CLIENT_ID),
      clientIdLength: (process.env.AMAZON_ADS_CLIENT_ID || '').length
    };
    console.log(`🔍 [TEST] Token diagnostics:`, JSON.stringify(tokenDiagnostics, null, 2));

    // Chiamata RAW ad Amazon API per diagnostica completa (senza wrapper che nascondono errori)
    const axios = (await import('axios')).default;
    const CLIENT_ID = process.env.AMAZON_ADS_CLIENT_ID || '';
    let profiles: any[] = [];
    let directAuthResult: any = null;
    let workingAccessToken = dbUser!.accessToken!;

    // Step A: Prova refresh token per avere un token fresco
    try {
      console.log(`🔄 [TEST] Refreshing token...`);
      const refreshResponse = await axios.post('https://api.amazon.com/auth/o2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: dbUser!.refreshToken!,
          client_id: CLIENT_ID,
          client_secret: process.env.AMAZON_ADS_CLIENT_SECRET || ''
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      workingAccessToken = refreshResponse.data.access_token;
      // Salva nuovi token nel DB
      dbUser!.accessToken = refreshResponse.data.access_token;
      dbUser!.refreshToken = refreshResponse.data.refresh_token;
      dbUser!.tokenExpiresAt = new Date(Date.now() + refreshResponse.data.expires_in * 1000);
      await userRepo.save(dbUser!);
      console.log(`✅ [TEST] Token refreshed OK`);
    } catch (refreshErr: any) {
      return res.status(401).json({
        error: 'Token refresh failed',
        diagnostics: {
          ...tokenDiagnostics,
          refreshHttpStatus: refreshErr.response?.status,
          refreshError: refreshErr.response?.data || refreshErr.message,
          clientIdUsed: CLIENT_ID.substring(0, 10) + '...',
          action: 'Refresh token invalid. User needs to re-authenticate via Amazon OAuth.'
        }
      });
    }

    // Step B: Chiama /v2/profiles con il token fresco (RAW, senza wrapper)
    try {
      console.log(`🔍 [TEST] Fetching profiles with fresh token...`);
      const profilesResponse = await axios.get('https://advertising-api.amazon.com/v2/profiles', {
        headers: {
          'Authorization': `Bearer ${workingAccessToken}`,
          'Amazon-Advertising-API-ClientId': CLIENT_ID,
          'Content-Type': 'application/json'
        }
      });
      profiles = profilesResponse.data;
      directAuthResult = {
        success: true,
        tokenRefreshed: true,
        profileCount: profiles.length,
        profiles: profiles.map((p: any) => ({ profileId: p.profileId, countryCode: p.countryCode, name: p.accountInfo?.name }))
      };
      console.log(`✅ [TEST] Found ${profiles.length} profiles`);

      // Trova il profileId corretto per il marketplace richiesto
      const matchingProfile = profiles.find((p: any) => p.countryCode === marketplace);
      if (matchingProfile) {
        directAuthResult.marketplaceProfileId = matchingProfile.profileId.toString();
        console.log(`🎯 [TEST] ProfileId per ${marketplace}: ${matchingProfile.profileId}`);
      }

      // Auto-fix: salva profileId nel DB se mancante
      if (!dbUser!.profileId && matchingProfile) {
        dbUser!.profileId = matchingProfile.profileId;
        dbUser!.countryCode = matchingProfile.countryCode;
        await userRepo.save(dbUser!);
        console.log(`🔧 [TEST] Auto-saved profileId ${matchingProfile.profileId} for ${marketplace}`);
        directAuthResult.autoFixed = { profileId: matchingProfile.profileId, countryCode: matchingProfile.countryCode };
      }
    } catch (profilesErr: any) {
      return res.status(401).json({
        error: 'Profiles fetch failed (with fresh token)',
        diagnostics: {
          ...tokenDiagnostics,
          tokenRefreshOK: true,
          profilesHttpStatus: profilesErr.response?.status,
          profilesError: profilesErr.response?.data || profilesErr.message,
          profilesHeaders: profilesErr.response?.headers || {},
          requestedUrl: 'https://advertising-api.amazon.com/v2/profiles',
          clientIdUsed: CLIENT_ID.substring(0, 10) + '...',
          action: 'Token works for auth but not for API. Check if AMAZON_ADS_CLIENT_ID matches the OAuth app.'
        }
      });
    }

    // Determina il profileId da usare: quello specifico del marketplace ha priorita'
    const marketplaceProfileId = directAuthResult?.marketplaceProfileId || dbUser!.profileId?.toString();
    if (!marketplaceProfileId) {
      return res.status(400).json({
        error: `No profile found for marketplace ${marketplace}`,
        availableProfiles: directAuthResult?.profiles,
        hint: 'User needs to select a profile for this marketplace in the app settings'
      });
    }
    console.log(`🎯 [TEST] Using profileId ${marketplaceProfileId} for marketplace ${marketplace}`);

    // Ricrea apiService con profileId specifico per il marketplace
    apiService = createUserAmazonApiService(userId, marketplace, marketplaceProfileId);

    // Step C: Test rapido v3 API (solo se diagnosticsOnly)
    if (diagnosticsOnly) {
      const authHeaders = {
        'Authorization': `Bearer ${workingAccessToken}`,
        'Amazon-Advertising-API-ClientId': CLIENT_ID,
        'Amazon-Advertising-API-Scope': marketplaceProfileId
      };
      const apiTestResult: any = { endpoint };

      // C1: v3 keywords
      try {
        const resp = await axios.post(`${endpoint}/sp/keywords/list`, { maxResults: 1 }, {
          headers: { ...authHeaders, 'Content-Type': 'application/vnd.spKeyword.v3+json', 'Accept': 'application/vnd.spKeyword.v3+json' }, timeout: 15000
        });
        apiTestResult.v3Keywords = { ok: true, count: resp.data.keywords?.length ?? 0 };
      } catch (e: any) {
        apiTestResult.v3Keywords = { ok: false, status: e.response?.status, body: e.response?.data };
      }

      // C2: v3 targets
      try {
        const resp = await axios.post(`${endpoint}/sp/targets/list`, { maxResults: 1 }, {
          headers: { ...authHeaders, 'Content-Type': 'application/vnd.spTargetingClause.v3+json', 'Accept': 'application/vnd.spTargetingClause.v3+json' }, timeout: 15000
        });
        apiTestResult.v3Targets = { ok: true, count: resp.data.targetingClauses?.length ?? 0 };
      } catch (e: any) {
        apiTestResult.v3Targets = { ok: false, status: e.response?.status, body: e.response?.data };
      }

      // C3: v3 campaigns
      try {
        const resp = await axios.post(`${endpoint}/sp/campaigns/list`, { maxResults: 1 }, {
          headers: { ...authHeaders, 'Content-Type': 'application/vnd.spcampaign.v3+json', 'Accept': 'application/vnd.spcampaign.v3+json' }, timeout: 15000
        });
        apiTestResult.v3Campaigns = { ok: true, count: resp.data.campaigns?.length ?? 0 };
      } catch (e: any) {
        apiTestResult.v3Campaigns = { ok: false, status: e.response?.status, body: e.response?.data };
      }

      return res.json({
        success: true,
        diagnosticsOnly: true,
        marketplace,
        auth: directAuthResult,
        apiTest: apiTestResult
      });
    }

    // 2. Trova le campagne dell'utente per questo ASIN
    const campaignRepo = AppDataSource.getRepository(Campaign);
    let campaigns = await campaignRepo.find({
      where: { userId, advertisedAsin: asin, marketplace }
    });

    // Fallback: se advertisedAsin non e' popolato, cerca tutte le campagne del marketplace
    if (campaigns.length === 0) {
      console.log(`⚠️ [TEST] No campaigns with advertisedAsin=${asin}, trying all campaigns for marketplace ${marketplace}...`);
      campaigns = await campaignRepo.find({
        where: { userId, marketplace }
      });
    }

    if (campaigns.length === 0) {
      return res.status(404).json({
        error: `No campaigns found for user in marketplace ${marketplace}`,
        hint: 'Make sure campaigns are synced from Amazon (check /api/campaigns/sync)'
      });
    }

    console.log(`📊 [TEST] Found ${campaigns.length} campaigns for ASIN ${asin} (marketplace: ${marketplace})`);

    const userConfig = await getUserAutomationSettings(userId);

    // 3-4. Carica dati libro e FAST ACOS (solo per func 2-5, non serve per func1)
    let book: any = null;
    let fastAcosValue: number | null = null;
    let kdpBook: any = null;

    if (functionNumber >= 2) {
      const kdpBookRepo = AppDataSource.getRepository(KdpBook);
      kdpBook = await kdpBookRepo.findOne({ where: { userId, asin } });

      if (!kdpBook || !kdpBook.price || !kdpBook.pageCount) {
        return res.status(404).json({
          error: `Book data not found or incomplete for ASIN ${asin}`,
          book: kdpBook ? { price: kdpBook.price, pageCount: kdpBook.pageCount } : null
        });
      }

      const price = parseKdpPrice(kdpBook.price);
      if (!price) {
        return res.status(400).json({ error: `Cannot parse price "${kdpBook.price}" for ASIN ${asin}` });
      }

      const inkType = (kdpBook.inkType || 'black_white') as any;
      const trimSize = (kdpBook.trimSize || '6x9') as any;
      const royaltyPct = Number(kdpBook.royaltyPercentage) || 60;
      const vatSettings = { useVat: userConfig.useVatInFastAcos, vatPercentage: userConfig.vatPercentage };
      const fastAcosResult = calculateBookFastAcos(price, kdpBook.pageCount, marketplace, inkType, royaltyPct, vatSettings, trimSize);

      if (!fastAcosResult) {
        return res.status(400).json({ error: 'FAST ACOS calculation failed' });
      }

      book = { price, printingCost: fastAcosResult.printingCost, royaltyPercentage: royaltyPct };
      fastAcosValue = fastAcosResult.fastAcos;
      console.log(`📚 [TEST] Book: "${kdpBook.title}" | price=${price} | fastAcos=${fastAcosValue}%`);
    }

    // 5. Pre-scarica il report una volta sola (condiviso tra campagne)
    let preloadedReportData: any[] | undefined;
    if (functionNumber === 1 || functionNumber === 3) {
      try {
        const { formatDateForAmazon } = await import('../utils/timeframe');
        const reportStartDate = new Date();
        reportStartDate.setDate(reportStartDate.getDate() - (userConfig.func1_frequency || 3));
        const startStr = formatDateForAmazon(reportStartDate);
        console.log(`📊 [TEST] Pre-loading report (${startStr} → oggi)...`);
        const reportId = await apiService.requestReport(startStr, ['impressions', 'clicks', 'spend', 'sales']);
        preloadedReportData = await apiService.waitAndDownloadReport(reportId);
        console.log(`✅ [TEST] Report pre-scaricato: ${preloadedReportData.length} righe`);
      } catch (reportErr: any) {
        console.error(`❌ [TEST] Errore pre-loading report:`, reportErr.message);
      }
    }

    // 6. Esegui la funzione su ogni campagna compatibile
    const results: any[] = [];
    const funcNames = ['', 'Progressive Bidding', 'Placement Optimization', 'Targeting Optimization', 'Auto Ad Optimization', 'Campaign Feeding'];

    // Per func5: costruisci mapping di tutte le campagne del libro
    // Usa solo gli ID campagna dal DB (adGroupId non disponibile direttamente)
    let campaignMapping: any = {};
    if (functionNumber === 5) {
      for (const c of campaigns) {
        const cType = _detectCampaignType(c.name);
        campaignMapping[`campaign${cType}Id`] = c.amazonCampaignId;
      }
    }

    for (const campaign of campaigns) {
      const campaignId = campaign.amazonCampaignId;
      const campaignName = campaign.name;
      const campaignType = _detectCampaignType(campaignName);

      // Verifica compatibilita' funzione-tipo campagna
      if (!_isFuncCompatible(functionNumber, campaignType)) {
        const reason = `Func${functionNumber} not applicable to type ${campaignType} (${campaignName})`;
        console.log(`⏩ [TEST] Skip: ${reason}`);
        results.push({ campaignName, campaignId, campaignType, status: 'skipped', reason });
        continue;
      }

      try {
        let result: any;

        switch (functionNumber) {
          case 1:
            result = await executeFunc1(campaignId, campaignType as any, campaignName, marketplace, apiService, {
              bidIncrease: userConfig.func1_bidIncrease,
              frequency: userConfig.func1_frequency,
              maxImpressions: userConfig.func1_impressions,
              maxClicks: userConfig.func1_clicks,
              dryRun: !!dryRun
            }, preloadedReportData);
            break;

          case 2: {
            // Placement attuali non disponibili direttamente, usa default 0
            const placements = { topOfSearch: 0, restOfSearch: 0, productPages: 0 };
            result = await executeFunc2(campaignId, campaignName, marketplace, book, placements, apiService, {
              frequency: userConfig.func2_frequency,
              placementTimeframeWeeks: userConfig.func2_timeframeWeeks
            });
            break;
          }

          case 3:
            result = await executeFunc3(campaignId, campaignType as any, campaignName, marketplace, book, 50000, apiService, {
              frequency: userConfig.func3_frequency,
              timeframeA: userConfig.func3_timeframeA,
              timeframeB: userConfig.func3_timeframeB,
              timeframeC: userConfig.func3_timeframeC,
              clicksPause: userConfig.func3_clicksPause,
              clicks65days: userConfig.func3_clicks65days
            });
            break;

          case 4: {
            // adGroupId: usa quello dalla campagna se disponibile
            const adGroupId = (campaign as any).adGroupId || 'unknown';
            result = await executeFunc4(campaignId, campaignName, marketplace, adGroupId, book, 50000, apiService, {
              frequency: userConfig.func4_frequency,
              timeframeA: userConfig.func4_timeframeA,
              timeframeB: userConfig.func4_timeframeB,
              timeframeC: userConfig.func4_timeframeC,
              clicksNegative: userConfig.func4_clicksNegative,
              spendNegative: userConfig.func4_spendNegative
            });
            break;
          }

          case 5:
            result = await executeFunc5(campaignId, campaignType as any, marketplace, campaignMapping, apiService, {
              frequency: userConfig.func5_frequency,
              minOrders: userConfig.func5_minOrders,
              bidBroad: userConfig.func5_bidBroad,
              bidExact: userConfig.func5_bidExact,
              bidPhrase: userConfig.func5_bidPhrase,
              bidExpanded: userConfig.func5_bidExpanded
            });
            break;
        }

        results.push({ campaignName, campaignId, campaignType, status: 'executed', result });
        console.log(`✅ [TEST] Func${functionNumber} completed on ${campaignName}`);
      } catch (error: any) {
        results.push({ campaignName, campaignId, campaignType, status: 'error', error: error.message });
        console.error(`❌ [TEST] Func${functionNumber} failed on ${campaignName}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      testOnly: true,
      functionNumber,
      functionName: funcNames[functionNumber],
      asin,
      marketplace,
      auth: directAuthResult,
      ...(kdpBook ? { book: { title: kdpBook.title, price: book?.price, fastAcos: fastAcosValue } } : {}),
      campaignsFound: campaigns.length,
      results
    });

  } catch (error: any) {
    console.error('❌ [TEST] Test function error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper interni SOLO per test-function (prefisso _ per evitare conflitti)
function _detectCampaignType(name: string): 1 | 2 | 3 | 4 | 5 {
  const lower = name.toLowerCase();
  if (lower.includes('auto') || lower.includes('automatic')) return 5;
  if (lower.includes('product')) return 2;
  if (lower.includes('super')) return 3;
  return 1;
}

function _isFuncCompatible(funcNum: number, campaignType: 1 | 2 | 3 | 4 | 5): boolean {
  switch (funcNum) {
    case 1: return campaignType !== 5;
    case 2: return true;
    case 3: return campaignType !== 5;
    case 4: return campaignType === 5;
    case 5: return true;
    default: return false;
  }
}

export default router;
