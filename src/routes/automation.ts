import { Router, Request, Response } from 'express';
import { automationScheduler } from '../automation/scheduler';
import { EventEmitter } from 'events';
import { runAutomationRules, runAutomationRulesForUser } from '../automation/rules';
import { authMiddleware } from '../middleware/auth';
import { requireAmazonAuth, AuthRequest } from '../middleware/requireAmazonAuth';

const router = Router();

// Event emitter per gestire automazioni in background
const automationQueue = new EventEmitter();

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
// ENDPOINT TRIGGER AUTOMAZIONI (Chiamato da Cron-Job.org)
// ================================================
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

  // 2. Controlla se c'è già un'esecuzione in corso
  if (isRunning) {
    return res.status(409).json({
      success: false,
      message: 'Automations already running',
      status: lastExecution
    });
  }

  // 3. Pre-warm database (wake up Supabase if paused)
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

  // 4. RISPONDE SUBITO (evita timeout HTTP)
  res.json({
    success: true,
    message: 'Automations queued successfully',
    dbStatus,
    timestamp: new Date().toISOString(),
    note: 'Execution started in background. Check /api/automation/status for progress.'
  });

  // 5. Triggera esecuzione in background (non aspetta risposta)
  console.log('🚀 Triggering automations in background...');
  automationQueue.emit('run');
});

// ================================================
// WORKER IN BACKGROUND
// ================================================
automationQueue.on('run', async () => {
  // Marca come in esecuzione
  isRunning = true;
  lastExecution = {
    startedAt: new Date(),
    completedAt: null,
    status: 'running',
    error: null
  };

  console.log('════════════════════════════════════════');
  console.log('🤖 Background Worker: Starting automations');
  console.log(`⏰ Started at: ${lastExecution.startedAt.toISOString()}`);
  console.log('════════════════════════════════════════');

  try {
    // Esegue TUTTE le automazioni (può richiedere anche 10 minuti)
    await automationScheduler.runNow();

    // Marca come completato
    lastExecution.status = 'completed';
    lastExecution.completedAt = new Date();
    lastExecution.error = null;

    const duration = lastExecution.completedAt.getTime() - lastExecution.startedAt!.getTime();
    const durationMinutes = (duration / 1000 / 60).toFixed(2);

    console.log('════════════════════════════════════════');
    console.log('✅ Background Worker: Completed successfully');
    console.log(`⏱️  Duration: ${durationMinutes} minutes`);
    console.log(`⏰ Completed at: ${lastExecution.completedAt.toISOString()}`);
    console.log('════════════════════════════════════════');

  } catch (error) {
    // Gestisce errori
    lastExecution.status = 'failed';
    lastExecution.completedAt = new Date();
    lastExecution.error = error instanceof Error ? error.message : 'Unknown error';

    console.error('════════════════════════════════════════');
    console.error('❌ Background Worker: Failed');
    console.error(`⏰ Failed at: ${lastExecution.completedAt.toISOString()}`);
    console.error('Error:', error);
    console.error('════════════════════════════════════════');

  } finally {
    // Rilascia lock
    isRunning = false;
  }
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
// ENDPOINT MANUAL TRIGGER (Per test manuali)
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

  res.json({
    success: true,
    message: 'Manual execution started in background',
    timestamp: new Date().toISOString()
  });

  automationQueue.emit('run');
});

// ================================================
// ENDPOINT PER-USER TRIGGER (User-specific automation)
// ================================================
router.post('/trigger-user', authMiddleware, requireAmazonAuth, async (req: AuthRequest, res: Response) => {
  try {
    console.log(`🚀 User ${req.userId} triggered their automations`);

    // Respond immediately
    res.json({
      success: true,
      message: 'Your automations have been queued',
      timestamp: new Date().toISOString(),
      note: 'Execution started in background. Check /api/automation/status for global progress.'
    });

    // Run user's automations in background (don't wait)
    runAutomationRulesForUser(req.userId!)
      .then(() => {
        console.log(`✅ Completed automations for user ${req.userId}`);
      })
      .catch((error) => {
        console.error(`❌ Failed automations for user ${req.userId}:`, error);
      });

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

export default router;
