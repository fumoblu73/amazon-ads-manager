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

export default router;
