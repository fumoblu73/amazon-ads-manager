import { Router, Request, Response } from 'express';
import { automationScheduler } from '../automation/scheduler';

const router = Router();

router.post('/trigger', async (req: Request, res: Response) => {
  const secret = req.query.secret || req.body.secret;
  const expectedSecret = process.env.AUTOMATION_SECRET || 'change-me-in-production';

  if (secret !== expectedSecret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid secret'
    });
  }

  try {
    console.log('🚀 Automazioni triggerate da esterno');
    await automationScheduler.runNow();

    res.json({
      success: true,
      message: 'Automazioni eseguite con successo',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore esecuzione automazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante esecuzione automazioni',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/status', (req: Request, res: Response) => {
  const status = automationScheduler.getStatus();
  res.json({
    scheduler: status,
    lastCheck: new Date().toISOString()
  });
});

export default router;
