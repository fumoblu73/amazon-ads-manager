import { Router, Request, Response } from 'express';
import { automationScheduler } from '../automation/scheduler';
import { EventEmitter } from 'events';

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

  // 3. RISPONDE SUBITO (evita timeout HTTP)
  res.json({
    success: true,
    message: 'Automations queued successfully',
    timestamp: new Date().toISOString(),
    note: 'Execution started in background. Check /api/automation/status for progress.'
  });

  // 4. Triggera esecuzione in background (non aspetta risposta)
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

export default router;
